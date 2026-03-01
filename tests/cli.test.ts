import { describe, expect, it, vi } from "vitest";

import { run } from "../src/cli.js";
import {
  ConversionError,
  DynamicError,
  FetchError,
  OutputError
} from "../src/errors.js";
import type { RunDependencies } from "../src/types.js";

function createDeps(overrides?: Partial<RunDependencies>): RunDependencies {
  return {
    fetchStatic: vi.fn(async () => "<html><body><h1>Hello</h1></body></html>"),
    fetchDynamic: vi.fn(async () => "<html><body><h1>Dynamic</h1></body></html>"),
    transformHtmlToMarkdown: vi.fn(() => "# Hello\n"),
    writeOutput: vi.fn(async () => undefined),
    stderrWrite: vi.fn(),
    ...overrides
  };
}

describe("run", () => {
  it("uses static fetch path by default", async () => {
    const deps = createDeps();

    const exitCode = await run(["https://example.com"], deps);

    expect(exitCode).toBe(0);
    expect(deps.fetchStatic).toHaveBeenCalledTimes(1);
    expect(deps.fetchDynamic).not.toHaveBeenCalled();

    const staticCall = vi.mocked(deps.fetchStatic).mock.calls[0]?.[0];
    expect(staticCall?.timeoutMs).toBe(15_000);
  });

  it("uses dynamic fetch path when --dynamic is set", async () => {
    const deps = createDeps();

    const exitCode = await run(["https://example.com", "--dynamic"], deps);

    expect(exitCode).toBe(0);
    expect(deps.fetchDynamic).toHaveBeenCalledTimes(1);
    expect(deps.fetchStatic).not.toHaveBeenCalled();

    const dynamicCall = vi.mocked(deps.fetchDynamic).mock.calls[0]?.[0];
    expect(dynamicCall?.timeoutMs).toBe(30_000);
  });

  it("validates URL protocol", async () => {
    const deps = createDeps();

    const exitCode = await run(["ftp://example.com"], deps);

    expect(exitCode).toBe(1);
    expect(deps.stderrWrite).toHaveBeenCalledOnce();
  });

  it("validates timeout", async () => {
    const deps = createDeps();

    const exitCode = await run(["https://example.com", "--timeout-ms", "0"], deps);

    expect(exitCode).toBe(1);
    expect(deps.stderrWrite).toHaveBeenCalledOnce();
  });

  it("validates header format", async () => {
    const deps = createDeps();

    const exitCode = await run(["https://example.com", "--header", "authorization"], deps);

    expect(exitCode).toBe(1);
    expect(deps.stderrWrite).toHaveBeenCalledOnce();
  });

  it("maps fetch errors to exit code 2", async () => {
    const deps = createDeps({
      fetchStatic: vi.fn(async () => {
        throw new FetchError("fetch failed");
      })
    });

    const exitCode = await run(["https://example.com"], deps);

    expect(exitCode).toBe(2);
  });

  it("maps dynamic errors to exit code 3", async () => {
    const deps = createDeps({
      fetchDynamic: vi.fn(async () => {
        throw new DynamicError("dynamic failed");
      })
    });

    const exitCode = await run(["https://example.com", "--dynamic"], deps);

    expect(exitCode).toBe(3);
  });

  it("maps output errors to exit code 4", async () => {
    const deps = createDeps({
      writeOutput: vi.fn(async () => {
        throw new OutputError("cannot write");
      })
    });

    const exitCode = await run(["https://example.com"], deps);

    expect(exitCode).toBe(4);
  });

  it("maps conversion errors to exit code 5", async () => {
    const deps = createDeps({
      transformHtmlToMarkdown: vi.fn(() => {
        throw new ConversionError("empty markdown");
      })
    });

    const exitCode = await run(["https://example.com"], deps);

    expect(exitCode).toBe(5);
  });

  it("passes headers to fetch layer", async () => {
    const deps = createDeps();

    const exitCode = await run(
      [
        "https://example.com",
        "--header",
        "authorization:Bearer token",
        "--header",
        "x-test:123"
      ],
      deps
    );

    expect(exitCode).toBe(0);

    const staticCall = vi.mocked(deps.fetchStatic).mock.calls[0]?.[0];
    expect(staticCall?.headers).toEqual({
      authorization: "Bearer token",
      "x-test": "123"
    });
  });
});
