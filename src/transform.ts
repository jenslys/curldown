import { load } from "cheerio";
import TurndownService from "turndown";

import { DEFAULT_REMOVE_SELECTORS } from "./constants.js";
import { ConversionError } from "./errors.js";
import type { TransformInput } from "./types.js";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "_"
});

/** Normalize selector input by trimming, dropping empties, and removing duplicates. */
function uniqueSelectors(selectors: string[]): string[] {
  return [...new Set(selectors.map((selector) => selector.trim()).filter(Boolean))];
}

/**
 * Convert fetched HTML into markdown.
 * The function removes default non-content nodes and optional caller-provided
 * selectors before running Turndown conversion.
 */
export function transformHtmlToMarkdown(input: TransformInput): string {
  const $ = load(input.html);

  const selectorsToRemove = uniqueSelectors([
    ...DEFAULT_REMOVE_SELECTORS,
    ...input.removeSelectors
  ]);

  if (selectorsToRemove.length > 0) {
    $(selectorsToRemove.join(",")).remove();
  }

  const bodyHtml = $("body").length > 0 ? $("body").html() ?? "" : $.root().html() ?? "";
  if (bodyHtml.trim().length === 0) {
    throw new ConversionError("No HTML body content found to convert.");
  }

  const markdown = turndown.turndown(bodyHtml).trim();
  if (markdown.length === 0) {
    throw new ConversionError("HTML was fetched but produced empty markdown output.");
  }

  return `${markdown}\n`;
}
