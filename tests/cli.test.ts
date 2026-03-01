import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { isMainModule, run } from "../src/cli.js";
import {
  ConversionError,
  DynamicError,
  FetchError,
  OutputError
} from "../src/errors.js";
import type { FetchResult, RunDependencies } from "../src/types.js";

const staticHtmlResult: FetchResult = {
  body: "<html><head><title>Static Title</title></head><body><h1>Hello</h1></body></html>",
  finalUrl: "https://example.com/static",
  status: 200,
  contentType: "text/html; charset=utf-8"
};

const dynamicHtmlResult: FetchResult = {
  body: "<html><head><title>Dynamic Title</title></head><body><h1>Dynamic</h1></body></html>",
  finalUrl: "https://example.com/dynamic",
  status: 200,
  contentType: "text/html; charset=utf-8"
};

function createDeps(overrides?: Partial<RunDependencies>): RunDependencies {
  return {
    fetchStatic: vi.fn(async () => staticHtmlResult),
    fetchDynamic: vi.fn(async () => dynamicHtmlResult),
    transformHtmlToMarkdown: vi.fn(() => "# Hello\n"),
    writeOutput: vi.fn(async () => undefined),
    stderrWrite: vi.fn(),
    ...overrides
  };
}

describe("isMainModule", () => {
  it("returns true for a symlink path targeting the CLI module", () => {
    const modulePath = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
    const tempDir = mkdtempSync(join(tmpdir(), "curldown-main-check-"));
    const symlinkPath = join(tempDir, "curldown-link.js");

    try {
      symlinkSync(modulePath, symlinkPath);
      expect(isMainModule(symlinkPath)).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("returns false for non-module paths", () => {
    expect(isMainModule("/tmp/not-curldown-entry.js")).toBe(false);
  });
});

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

  it("uses auto fallback to dynamic when static markdown is thin", async () => {
    const deps = createDeps({
      fetchStatic: vi.fn(async () => ({
        ...staticHtmlResult,
        body: "<html><body><div>STATIC</div></body></html>"
      })),
      fetchDynamic: vi.fn(async () => ({
        ...dynamicHtmlResult,
        body: "<html><body><article>DYNAMIC</article></body></html>"
      })),
      transformHtmlToMarkdown: vi.fn((input) =>
        input.html.includes("STATIC") ? "Loading...\n" : "# Fully Rendered\n\nEnough content here.\n"
      )
    });

    const exitCode = await run(["https://example.com", "--auto"], deps);

    expect(exitCode).toBe(0);
    expect(deps.fetchStatic).toHaveBeenCalledTimes(1);
    expect(deps.fetchDynamic).toHaveBeenCalledTimes(1);

    const output = vi.mocked(deps.writeOutput).mock.calls[0]?.[0]?.content;
    expect(output).toContain("Fully Rendered");
  });

  it("does not fallback in auto mode when static response is markdown", async () => {
    const deps = createDeps({
      fetchStatic: vi.fn(async () => ({
        body: "# Source Markdown\n\nDirect content.\n",
        finalUrl: "https://example.com/source.md",
        status: 200,
        contentType: "text/markdown; charset=utf-8"
      })),
      transformHtmlToMarkdown: vi.fn(() => {
        throw new Error("should not run transform for markdown passthrough");
      })
    });

    const exitCode = await run(["https://example.com", "--auto"], deps);

    expect(exitCode).toBe(0);
    expect(deps.fetchDynamic).not.toHaveBeenCalled();
    expect(deps.transformHtmlToMarkdown).not.toHaveBeenCalled();

    const output = vi.mocked(deps.writeOutput).mock.calls[0]?.[0]?.content;
    expect(output).toContain("# Source Markdown");
  });

  it("emits JSON output when --format json is used", async () => {
    const deps = createDeps();

    const exitCode = await run(["https://example.com", "--format", "json"], deps);

    expect(exitCode).toBe(0);
    const output = vi.mocked(deps.writeOutput).mock.calls[0]?.[0]?.content;
    expect(output).toBeTypeOf("string");

    const parsed = JSON.parse(output ?? "{}");
    expect(parsed.url).toBe("https://example.com/");
    expect(parsed.final_url).toBe("https://example.com/static");
    expect(parsed.status).toBe(200);
    expect(parsed.used_dynamic).toBe(false);
    expect(parsed.markdown).toContain("# Hello");
    expect(parsed.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(parsed.word_count).toBeGreaterThan(0);
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

  it("validates format", async () => {
    const deps = createDeps();

    const exitCode = await run(["https://example.com", "--format", "xml"], deps);

    expect(exitCode).toBe(1);
    expect(deps.stderrWrite).toHaveBeenCalledOnce();
  });

  it("rejects --auto with --dynamic", async () => {
    const deps = createDeps();

    const exitCode = await run(["https://example.com", "--auto", "--dynamic"], deps);

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
