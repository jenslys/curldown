import { Command } from "commander";

import {
  DEFAULT_DYNAMIC_TIMEOUT_MS,
  DEFAULT_STATIC_TIMEOUT_MS,
  VERSION
} from "./constants.js";
import { InputError } from "./errors.js";
import type { CliArgs, OutputFormat } from "./types.js";

export interface RawCliOptions {
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

function collectRepeatable(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

export function buildProgram(): Command {
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

/**
 * Validate and normalize parsed CLI arguments into the canonical runtime shape.
 * Fails fast with {@link InputError} on malformed input.
 */
export function normalizeArgs(urlInput: string | undefined, options: RawCliOptions): CliArgs {
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
