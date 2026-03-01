import { load } from "cheerio";
import { createRequire } from "node:module";
import TurndownService from "turndown";

import { DEFAULT_REMOVE_SELECTORS } from "./constants.js";
import { ConversionError } from "./errors.js";
import type { TransformInput } from "./types.js";

const require = createRequire(import.meta.url);
const turndownPluginGfm = require("@joplin/turndown-plugin-gfm") as {
  gfm: Parameters<TurndownService["use"]>[0];
};

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "_"
});
turndown.use(turndownPluginGfm.gfm);

/**
 * Convert fetched HTML into markdown.
 * The function removes default non-content nodes before running Turndown
 * with GitHub Flavored Markdown extensions.
 */
export function transformHtmlToMarkdown(input: TransformInput): string {
  const $ = load(input.html);

  $(DEFAULT_REMOVE_SELECTORS.join(",")).remove();

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

/** Extract document title from HTML head when available. */
export function extractHtmlTitle(html: string): string | undefined {
  const $ = load(html);
  const title = $("title").first().text().trim();
  return title || undefined;
}
