import { describe, expect, it, vi } from "vitest";

import { run } from "../src/cli.js";
import { createDeps, dynamicHtmlResult, staticHtmlResult } from "./cli-fixtures.js";

export function registerCliRunPathsSuite(): void {
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

    it("passes through text/plain markdown files by url extension", async () => {
      const deps = createDeps({
        fetchStatic: vi.fn(async () => ({
          body: "# Raw Markdown\n\nBody text.\n",
          finalUrl: "https://raw.githubusercontent.com/org/repo/main/README.md",
          status: 200,
          contentType: "text/plain; charset=utf-8"
        })),
        transformHtmlToMarkdown: vi.fn(() => {
          throw new Error("should not run transform for plain text markdown passthrough");
        })
      });

      const exitCode = await run(["https://example.com"], deps);

      expect(exitCode).toBe(0);
      expect(deps.transformHtmlToMarkdown).not.toHaveBeenCalled();
      const output = vi.mocked(deps.writeOutput).mock.calls[0]?.[0]?.content;
      expect(output).toContain("# Raw Markdown");
    });

    it("does not fallback in auto mode for text/plain markdown files by url extension", async () => {
      const deps = createDeps({
        fetchStatic: vi.fn(async () => ({
          body: "# Raw Markdown\n\nBody text.\n",
          finalUrl: "https://raw.githubusercontent.com/org/repo/main/README.md",
          status: 200,
          contentType: "text/plain; charset=utf-8"
        })),
        transformHtmlToMarkdown: vi.fn(() => {
          throw new Error("should not run transform for plain text markdown passthrough");
        })
      });

      const exitCode = await run(["https://example.com", "--auto"], deps);

      expect(exitCode).toBe(0);
      expect(deps.fetchDynamic).not.toHaveBeenCalled();
      expect(deps.transformHtmlToMarkdown).not.toHaveBeenCalled();
      const output = vi.mocked(deps.writeOutput).mock.calls[0]?.[0]?.content;
      expect(output).toContain("# Raw Markdown");
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
}
