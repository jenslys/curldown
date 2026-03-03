import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { isMainModule } from "../src/cli.js";

export function registerCliMainModuleSuite(): void {
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
}
