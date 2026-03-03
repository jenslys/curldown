import { realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

function resolvePathStrict(pathInput: string): string {
  return realpathSync(pathInput);
}

/**
 * Determine whether `argvPath` points at the current module entrypoint.
 * Resolves symlinks for both paths so global installs that expose a symlinked bin still execute.
 */
export function isMainModuleFor(
  moduleUrl: string,
  argvPath: string | undefined = process.argv[1]
): boolean {
  if (argvPath === undefined) {
    return false;
  }

  try {
    const invokedPath = resolvePathStrict(argvPath);
    const modulePath = resolvePathStrict(fileURLToPath(moduleUrl));
    return invokedPath === modulePath;
  } catch {
    return pathToFileURL(argvPath).href === moduleUrl;
  }
}
