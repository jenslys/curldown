import { writeFile } from "node:fs/promises";

import { OutputError } from "./errors.js";
import type { WriteOutputInput } from "./types.js";

/**
 * Emit markdown to stdout (default) or to a target file.
 * Throws {@link OutputError} when writing fails.
 */
export async function writeOutput(input: WriteOutputInput): Promise<void> {
  if (input.outputPath) {
    try {
      await writeFile(input.outputPath, input.content, "utf8");
      return;
    } catch (error) {
      throw new OutputError(
        `Failed writing markdown to ${input.outputPath}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  try {
    process.stdout.write(input.content);
  } catch (error) {
    throw new OutputError(
      `Failed writing markdown to stdout: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}
