#!/usr/bin/env node
import { CommanderError } from "commander";

import { buildProgram, normalizeArgs } from "./cli-args.js";
import { formatOutput, prepareContentFromFetchResult, shouldAutoFallback } from "./cli-content.js";
import { isMainModuleFor } from "./cli-main-module.js";
import { asCurldownError } from "./errors.js";
import { fetchDynamicHtml } from "./fetch-dynamic.js";
import { fetchStaticHtml } from "./fetch-static.js";
import { writeOutput } from "./output.js";
import { transformHtmlToMarkdown } from "./transform.js";
import type { RawCliOptions } from "./cli-args.js";
import type { ExitCode, RunDependencies } from "./types.js";

const defaultDependencies: RunDependencies = {
  fetchStatic: fetchStaticHtml,
  fetchDynamic: fetchDynamicHtml,
  transformHtmlToMarkdown,
  writeOutput,
  stderrWrite: (message: string) => process.stderr.write(message)
};

/**
 * Execute one curldown CLI invocation and return process exit code.
 * `argv` should not include the Node executable or script path.
 */
export async function run(argv: string[], deps: RunDependencies = defaultDependencies): Promise<ExitCode> {
  const program = buildProgram();

  let options: RawCliOptions;
  let urlArg: string | undefined;

  try {
    const parsedProgram = program.parse(argv, { from: "user" });
    options = parsedProgram.opts<RawCliOptions>();
    [urlArg] = parsedProgram.args as string[];
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.code === "commander.helpDisplayed" || error.code === "commander.version") {
        return 0;
      }

      deps.stderrWrite(`${error.message}\n`);
      return 1;
    }

    const curldownError = asCurldownError(error);
    deps.stderrWrite(`${curldownError.message}\n`);
    return curldownError.exitCode;
  }

  try {
    const args = normalizeArgs(urlArg, options);

    let usedDynamic = false;
    let content;

    if (args.auto) {
      const staticResult = await deps.fetchStatic({
        url: args.url,
        timeoutMs: args.timeoutMs,
        headers: args.headers
      });

      content = prepareContentFromFetchResult(staticResult, deps);

      if (!content.passthrough && shouldAutoFallback(content.markdown)) {
        const dynamicResult = await deps.fetchDynamic({
          url: args.url,
          timeoutMs: args.dynamicTimeoutMs,
          headers: args.headers
        });

        content = prepareContentFromFetchResult(dynamicResult, deps);
        usedDynamic = true;
      }
    } else if (args.dynamic) {
      const dynamicResult = await deps.fetchDynamic({
        url: args.url,
        timeoutMs: args.dynamicTimeoutMs,
        headers: args.headers
      });

      content = prepareContentFromFetchResult(dynamicResult, deps);
      usedDynamic = true;
    } else {
      const staticResult = await deps.fetchStatic({
        url: args.url,
        timeoutMs: args.timeoutMs,
        headers: args.headers
      });

      content = prepareContentFromFetchResult(staticResult, deps);
    }

    const output = formatOutput(args, content, usedDynamic);

    await deps.writeOutput({
      content: output,
      outputPath: args.outputPath
    });

    return 0;
  } catch (error) {
    const curldownError = asCurldownError(error);
    deps.stderrWrite(`${curldownError.message}\n`);
    return curldownError.exitCode;
  }
}

export function isMainModule(argvPath: string | undefined = process.argv[1]): boolean {
  return isMainModuleFor(import.meta.url, argvPath);
}

if (isMainModule()) {
  void run(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
