#!/usr/bin/env node
import { Command, CommanderError } from "commander";
import { pathToFileURL } from "node:url";

import {
  DEFAULT_DYNAMIC_TIMEOUT_MS,
  DEFAULT_STATIC_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  VERSION
} from "./constants.js";
import { asCurldownError, InputError } from "./errors.js";
import { fetchDynamicHtml } from "./fetch-dynamic.js";
import { fetchStaticHtml } from "./fetch-static.js";
import { writeOutput } from "./output.js";
import { transformHtmlToMarkdown } from "./transform.js";
import type { CliArgs, ExitCode, RunDependencies } from "./types.js";

interface RawCliOptions {
  dynamic?: boolean;
  output?: string;
  timeoutMs?: string;
  userAgent?: string;
  header?: string[];
  removeSelector?: string[];
}

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
    .option("-o, --output <path>", "Write markdown to a file instead of stdout")
    .option("--timeout-ms <number>", "Timeout in milliseconds")
    .option("--user-agent <string>", "Override request user-agent")
    .option("--header <key:value>", "Set custom request header", collectRepeatable, [])
    .option(
      "--remove-selector <css>",
      "Remove matching selector(s) before markdown conversion",
      collectRepeatable,
      []
    )
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

function parseTimeout(rawTimeout: string | undefined, dynamic: boolean): number {
  if (rawTimeout === undefined) {
    return dynamic ? DEFAULT_DYNAMIC_TIMEOUT_MS : DEFAULT_STATIC_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(rawTimeout, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new InputError(`Invalid --timeout-ms value \"${rawTimeout}\". Must be a positive integer.`);
  }

  return parsed;
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

  return {
    url: parsedUrl.toString(),
    dynamic,
    outputPath: options.output,
    timeoutMs: parseTimeout(options.timeoutMs, dynamic),
    userAgent: options.userAgent?.trim() || DEFAULT_USER_AGENT,
    headers: parseHeaders(options.header ?? []),
    removeSelectors: (options.removeSelector ?? []).map((selector) => selector.trim()).filter(Boolean)
  };
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
    const fetchInput = {
      url: args.url,
      timeoutMs: args.timeoutMs,
      userAgent: args.userAgent,
      headers: args.headers
    };

    const html = args.dynamic
      ? await deps.fetchDynamic(fetchInput)
      : await deps.fetchStatic(fetchInput);

    const markdown = deps.transformHtmlToMarkdown({
      html,
      removeSelectors: args.removeSelectors
    });

    await deps.writeOutput({
      markdown,
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
