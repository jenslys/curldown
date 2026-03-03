import { describe, expect, it, vi } from "vitest";

import { run } from "../src/cli.js";
import {
  ConversionError,
  DynamicError,
  FetchError,
  OutputError
} from "../src/errors.js";
import { createDeps } from "./cli-fixtures.js";

export function registerCliRunErrorsSuite(): void {
  describe("run validation and error mapping", () => {
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
  });
}
