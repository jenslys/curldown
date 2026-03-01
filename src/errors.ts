import type { ExitCode } from "./types.js";

/**
 * Base error for all domain failures in curldown.
 * Each subclass maps directly to a CLI exit code.
 */
export class CurldownError extends Error {
  readonly exitCode: ExitCode;

  constructor(message: string, exitCode: ExitCode, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.exitCode = exitCode;
  }
}

/** Invalid CLI usage or invalid input values. */
export class InputError extends CurldownError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 1, options);
  }
}

/** Static network fetch failure from Node fetch. */
export class FetchError extends CurldownError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 2, options);
  }
}

/** Browser-rendering failure in dynamic mode. */
export class DynamicError extends CurldownError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 3, options);
  }
}

/** Failure while writing markdown to stdout or file output. */
export class OutputError extends CurldownError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 4, options);
  }
}

/** Failure in HTML cleanup or markdown conversion. */
export class ConversionError extends CurldownError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 5, options);
  }
}

/**
 * Convert unknown thrown values into typed curldown errors so the CLI
 * always returns a deterministic exit code.
 */
export function asCurldownError(error: unknown): CurldownError {
  if (error instanceof CurldownError) {
    return error;
  }

  if (error instanceof Error) {
    return new ConversionError(error.message, { cause: error });
  }

  return new ConversionError("Unknown error while processing page content.");
}
