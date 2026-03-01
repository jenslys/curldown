export type ExitCode = 0 | 1 | 2 | 3 | 4 | 5;
export type OutputFormat = "markdown" | "json";

export interface CliArgs {
  url: string;
  auto: boolean;
  dynamic: boolean;
  format: OutputFormat;
  outputPath?: string;
  timeoutMs: number;
  dynamicTimeoutMs: number;
  headers: Record<string, string>;
}

export interface FetchInput {
  url: string;
  timeoutMs: number;
  headers: Record<string, string>;
}

export interface FetchResult {
  body: string;
  finalUrl: string;
  status: number;
  contentType?: string;
}

export interface TransformInput {
  html: string;
}

export interface WriteOutputInput {
  content: string;
  outputPath?: string;
}

export interface RunDependencies {
  /** Static HTML fetch implementation used when --dynamic is not set. */
  fetchStatic: (input: FetchInput) => Promise<FetchResult>;
  /** Browser-rendered HTML fetch implementation used when --dynamic is set. */
  fetchDynamic: (input: FetchInput) => Promise<FetchResult>;
  /** Canonical HTML -> markdown transformation pipeline. */
  transformHtmlToMarkdown: (input: TransformInput) => string;
  /** Canonical markdown output sink (stdout or file). */
  writeOutput: (input: WriteOutputInput) => Promise<void>;
  /** Error output writer, injectable for tests. */
  stderrWrite: (message: string) => void;
}
