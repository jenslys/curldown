#!/usr/bin/env node
import { createHash } from "node:crypto";
import { Command, CommanderError } from "commander";
import { pathToFileURL } from "node:url";

import {
  DEFAULT_DYNAMIC_TIMEOUT_MS,
  DEFAULT_STATIC_TIMEOUT_MS,
  VERSION
} from "./constants.js";
import { asCurldownError, ConversionError, InputError } from "./errors.js";
import { fetchDynamicHtml } from "./fetch-dynamic.js";
import { fetchStaticHtml } from "./fetch-static.js";
import { writeOutput } from "./output.js";
import { extractHtmlTitle, transformHtmlToMarkdown } from "./transform.js";
import type {
  CliArgs,
  ExitCode,
  FetchResult,
  OutputFormat,
  RunDependencies
} from "./types.js";

interface RawCliOptions {
  auto?: boolean;
  dynamic?: boolean;
  format?: string;
  output?: string;
  timeoutMs?: string;
  header?: string[];
}

interface TimeoutConfig {
  timeoutMs: number;
  dynamicTimeoutMs: number;
}

interface PreparedContent {
  markdown: string;
  title?: string;
  source: FetchResult;
  passthrough: boolean;
}

const MARKDOWN_CONTENT_TYPES = new Set([
  "text/markdown",
  "text/x-markdown",
  "application/markdown",
  "application/x-markdown"
]);

const defaultDependencies: RunDependencies = {
  fetchStatic: fetchStaticHtml,
  fetchDynamic: fetchDynamicHtml,
  transformHtmlToMarkdown,
  writeOutput,
  stderrWrite: (message: string) => process.stderr.write(message)
};

function collectRepeatable(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

function buildProgram(): Command {
  return new Command()
    .name("curldown")
    .description("Fetch URL content and convert it to markdown.")
    .version(VERSION)
    .argument("<url>", "The URL to fetch")
    .option("--dynamic", "Use headless Chromium (Playwright) to render the page")
    .option("--auto", "Try static first and fallback to dynamic when static output is thin")
    .option("--format <type>", "Output format: markdown|json", "markdown")
    .option("-o, --output <path>", "Write output to a file instead of stdout")
    .option("--timeout-ms <number>", "Timeout in milliseconds")
    .option("--header <key:value>", "Set custom request header", collectRepeatable, [])
    .showHelpAfterError()
    .exitOverride();
}

function parseHeaders(rawHeaders: string[]): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const rawHeader of rawHeaders) {
    const separatorIndex = rawHeader.indexOf(":");
    if (separatorIndex <= 0 || separatorIndex === rawHeader.length - 1) {
      throw new InputError(`Invalid --header value \"${rawHeader}\". Use key:value format.`);
    }

    const key = rawHeader.slice(0, separatorIndex).trim();
    const value = rawHeader.slice(separatorIndex + 1).trim();

    if (!key || !value) {
      throw new InputError(`Invalid --header value \"${rawHeader}\". Header key and value are required.`);
    }

    headers[key] = value;
  }

  return headers;
}

function parseFormat(rawFormat: string): OutputFormat {
  if (rawFormat === "markdown" || rawFormat === "json") {
    return rawFormat;
  }

  throw new InputError(`Invalid --format value \"${rawFormat}\". Use \"markdown\" or \"json\".`);
}

function parseTimeouts(
  rawTimeout: string | undefined,
  dynamic: boolean,
  auto: boolean
): TimeoutConfig {
  if (rawTimeout === undefined) {
    if (dynamic) {
      return {
        timeoutMs: DEFAULT_DYNAMIC_TIMEOUT_MS,
        dynamicTimeoutMs: DEFAULT_DYNAMIC_TIMEOUT_MS
      };
    }

    if (auto) {
      return {
        timeoutMs: DEFAULT_STATIC_TIMEOUT_MS,
        dynamicTimeoutMs: DEFAULT_DYNAMIC_TIMEOUT_MS
      };
    }

    return {
      timeoutMs: DEFAULT_STATIC_TIMEOUT_MS,
      dynamicTimeoutMs: DEFAULT_DYNAMIC_TIMEOUT_MS
    };
  }

  const parsed = Number.parseInt(rawTimeout, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new InputError(`Invalid --timeout-ms value \"${rawTimeout}\". Must be a positive integer.`);
  }

  return {
    timeoutMs: parsed,
    dynamicTimeoutMs: parsed
  };
}

function normalizeMarkdown(markdown: string): string {
  const trimmed = markdown.trim();
  if (!trimmed) {
    throw new ConversionError("Content was fetched but markdown output is empty.");
  }

  return `${trimmed}\n`;
}

function inferTitleFromMarkdown(markdown: string): string | undefined {
  const firstHeading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return firstHeading || undefined;
}

function isMarkdownContentType(contentType: string | undefined): boolean {
  if (!contentType) {
    return false;
  }

  const normalized = contentType.toLowerCase().split(";")[0]?.trim() ?? "";
  return MARKDOWN_CONTENT_TYPES.has(normalized);
}

function countWords(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
}

function shouldAutoFallback(markdown: string): boolean {
  const trimmed = markdown.trim();
  if (!trimmed) {
    return true;
  }

  const lower = trimmed.toLowerCase();
  if (/enable javascript|javascript is required|checking your browser|just a moment|please wait/.test(lower)) {
    return true;
  }

  const nonEmptyLines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
  return countWords(trimmed) < 30 && nonEmptyLines <= 2;
}

/**
 * Validate and normalize parsed CLI arguments into the canonical runtime shape.
 * Fails fast with {@link InputError} on malformed input.
 */
function normalizeArgs(urlInput: string | undefined, options: RawCliOptions): CliArgs {
  if (!urlInput) {
    throw new InputError("A URL argument is required.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlInput);
  } catch (error) {
    throw new InputError(`Invalid URL \"${urlInput}\".`, {
      cause: error instanceof Error ? error : undefined
    });
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new InputError(
      `Unsupported URL protocol \"${parsedUrl.protocol}\". Only http:// and https:// are supported.`
    );
  }

  const dynamic = options.dynamic ?? false;
  const auto = options.auto ?? false;
  if (dynamic && auto) {
    throw new InputError("--dynamic and --auto cannot be used together.");
  }

  const timeouts = parseTimeouts(options.timeoutMs, dynamic, auto);

  return {
    url: parsedUrl.toString(),
    auto,
    dynamic,
    format: parseFormat(options.format ?? "markdown"),
    outputPath: options.output,
    timeoutMs: timeouts.timeoutMs,
    dynamicTimeoutMs: timeouts.dynamicTimeoutMs,
    headers: parseHeaders(options.header ?? [])
  };
}

function prepareContentFromFetchResult(
  result: FetchResult,
  deps: RunDependencies
): PreparedContent {
  if (isMarkdownContentType(result.contentType)) {
    const markdown = normalizeMarkdown(result.body);
    return {
      markdown,
      title: inferTitleFromMarkdown(markdown),
      source: result,
      passthrough: true
    };
  }

  const markdown = deps.transformHtmlToMarkdown({ html: result.body });
  return {
    markdown,
    title: extractHtmlTitle(result.body),
    source: result,
    passthrough: false
  };
}

function formatOutput(args: CliArgs, content: PreparedContent, usedDynamic: boolean): string {
  if (args.format === "markdown") {
    return content.markdown;
  }

  const payload = {
    url: args.url,
    final_url: content.source.finalUrl,
    title: content.title ?? null,
    markdown: content.markdown,
    content_type: content.source.contentType ?? null,
    status: content.source.status,
    fetched_at: new Date().toISOString(),
    word_count: countWords(content.markdown),
    sha256: createHash("sha256").update(content.markdown).digest("hex"),
    used_dynamic: usedDynamic
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
}

/**
 * Execute one curldown CLI invocation and return process exit code.
 * `argv` should not include the Node executable or script path.
 */
export async function run(argv: string[], deps: RunDependencies = defaultDependencies): Promise<ExitCode> {
  const program = buildProgram();

  let options: RawCliOptions;
  let urlArg: string | undefined;

  try {
    const parsedProgram = program.parse(argv, { from: "user" });
    options = parsedProgram.opts<RawCliOptions>();
    [urlArg] = parsedProgram.args as string[];
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.code === "commander.helpDisplayed" || error.code === "commander.version") {
        return 0;
      }

      deps.stderrWrite(`${error.message}\n`);
      return 1;
    }

    const curldownError = asCurldownError(error);
    deps.stderrWrite(`${curldownError.message}\n`);
    return curldownError.exitCode;
  }

  try {
    const args = normalizeArgs(urlArg, options);

    let usedDynamic = false;
    let content: PreparedContent;

    if (args.auto) {
      const staticResult = await deps.fetchStatic({
        url: args.url,
        timeoutMs: args.timeoutMs,
        headers: args.headers
      });

      content = prepareContentFromFetchResult(staticResult, deps);

      if (!content.passthrough && shouldAutoFallback(content.markdown)) {
        const dynamicResult = await deps.fetchDynamic({
          url: args.url,
          timeoutMs: args.dynamicTimeoutMs,
          headers: args.headers
        });

        content = prepareContentFromFetchResult(dynamicResult, deps);
        usedDynamic = true;
      }
    } else if (args.dynamic) {
      const dynamicResult = await deps.fetchDynamic({
        url: args.url,
        timeoutMs: args.dynamicTimeoutMs,
        headers: args.headers
      });

      content = prepareContentFromFetchResult(dynamicResult, deps);
      usedDynamic = true;
    } else {
      const staticResult = await deps.fetchStatic({
        url: args.url,
        timeoutMs: args.timeoutMs,
        headers: args.headers
      });

      content = prepareContentFromFetchResult(staticResult, deps);
    }

    const output = formatOutput(args, content, usedDynamic);

    await deps.writeOutput({
      content: output,
      outputPath: args.outputPath
    });

    return 0;
  } catch (error) {
    const curldownError = asCurldownError(error);
    deps.stderrWrite(`${curldownError.message}\n`);
    return curldownError.exitCode;
  }
}

const isMain =
  process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  void run(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
