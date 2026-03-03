import { vi } from "vitest";

import type { FetchResult, RunDependencies } from "../src/types.js";

export const staticHtmlResult: FetchResult = {
  body: "<html><head><title>Static Title</title></head><body><h1>Hello</h1></body></html>",
  finalUrl: "https://example.com/static",
  status: 200,
  contentType: "text/html; charset=utf-8"
};

export const dynamicHtmlResult: FetchResult = {
  body: "<html><head><title>Dynamic Title</title></head><body><h1>Dynamic</h1></body></html>",
  finalUrl: "https://example.com/dynamic",
  status: 200,
  contentType: "text/html; charset=utf-8"
};

export function createDeps(overrides?: Partial<RunDependencies>): RunDependencies {
  return {
    fetchStatic: vi.fn(async () => staticHtmlResult),
    fetchDynamic: vi.fn(async () => dynamicHtmlResult),
    transformHtmlToMarkdown: vi.fn(() => "# Hello\n"),
    writeOutput: vi.fn(async () => undefined),
    stderrWrite: vi.fn(),
    ...overrides
  };
}
