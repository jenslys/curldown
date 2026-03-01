export type ExitCode = 0 | 1 | 2 | 3 | 4 | 5;

export interface CliArgs {
  url: string;
  dynamic: boolean;
  outputPath?: string;
  timeoutMs: number;
  userAgent?: string;
  headers: Record<string, string>;
  removeSelectors: string[];
}

export interface FetchInput {
  url: string;
  timeoutMs: number;
  userAgent?: string;
  headers: Record<string, string>;
}

export interface TransformInput {
  html: string;
  removeSelectors: string[];
}

export interface WriteOutputInput {
  markdown: string;
  outputPath?: string;
}

export interface RunDependencies {
  /** Static HTML fetch implementation used when --dynamic is not set. */
  fetchStatic: (input: FetchInput) => Promise<string>;
  /** Browser-rendered HTML fetch implementation used when --dynamic is set. */
  fetchDynamic: (input: FetchInput) => Promise<string>;
  /** Canonical HTML -> markdown transformation pipeline. */
  transformHtmlToMarkdown: (input: TransformInput) => string;
  /** Canonical markdown output sink (stdout or file). */
  writeOutput: (input: WriteOutputInput) => Promise<void>;
  /** Error output writer, injectable for tests. */
  stderrWrite: (message: string) => void;
}
