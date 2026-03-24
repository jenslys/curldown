import { Readability } from "@mozilla/readability";
import { load } from "cheerio";
import { JSDOM } from "jsdom";
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

const tableCellTurndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "_"
});
tableCellTurndown.use(turndownPluginGfm.gfm);

const FALLBACK_BASE_URL = "https://curldown.local/";
const PRIMARY_CONTENT_SELECTOR = "main, article, [role='main']";
const MIN_PRIMARY_CONTENT_TEXT_LENGTH = 200;
const COMPLEX_TABLE_CELL_SELECTOR = "ul, ol, blockquote, pre, h1, h2, h3, h4, h5, h6, hr";

function getNormalizedTextLength(value: string | null | undefined): number {
  return value?.replace(/\s+/g, " ").trim().length ?? 0;
}

function cleanupFragmentHtml(html: string): string {
  const $ = load(html);

  $(DEFAULT_REMOVE_SELECTORS.join(",")).remove();
  normalizeComplexTables($);

  $("img").each((_, element) => {
    const alt = $(element).attr("alt")?.trim() ?? "";
    if (!alt) {
      $(element).remove();
    }
  });

  $("a").each((_, element) => {
    const link = $(element);
    const textLength = getNormalizedTextLength(link.text());
    const hasAltImage = link
      .find("img")
      .toArray()
      .some((image) => getNormalizedTextLength($(image).attr("alt")) > 0);

    if (textLength === 0 && !hasAltImage) {
      link.remove();
    }
  });

  return $.root().html() ?? "";
}

function normalizeComplexTables($: ReturnType<typeof load>): void {
  $("table")
    .find(`th:has(${COMPLEX_TABLE_CELL_SELECTOR}), td:has(${COMPLEX_TABLE_CELL_SELECTOR})`)
    .each((_, cell) => {
      const markdown = normalizeTableCellMarkdown(tableCellTurndown.turndown($(cell).html() ?? ""));
      $(cell).empty().text(markdown);
    });
}

function normalizeTableCellMarkdown(markdown: string): string {
  return markdown
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .trim();
}

function extractBodyHtml(document: Document): string {
  return document.body?.innerHTML ?? document.documentElement?.innerHTML ?? "";
}

function selectSemanticPrimaryHtml(document: Document): string | undefined {
  const candidates = Array.from(document.querySelectorAll(PRIMARY_CONTENT_SELECTOR));
  const bestCandidate = candidates
    .map((element) => ({
      html: element.innerHTML,
      textLength: getNormalizedTextLength(element.textContent)
    }))
    .filter((candidate) => candidate.textLength > 0)
    .sort((left, right) => right.textLength - left.textLength)[0];

  if (!bestCandidate || bestCandidate.textLength < MIN_PRIMARY_CONTENT_TEXT_LENGTH) {
    return undefined;
  }

  return bestCandidate.html;
}

function selectReadabilityHtml(document: Document): string | undefined {
  const article = new Readability(document).parse();
  if (!article || getNormalizedTextLength(article.textContent) === 0) {
    return undefined;
  }

  return article.content ?? undefined;
}

function toMarkdownCandidate(html: string | undefined): string | undefined {
  if (!html) {
    return undefined;
  }

  const cleanedHtml = cleanupFragmentHtml(html);
  if (cleanedHtml.trim().length === 0) {
    return undefined;
  }

  const markdown = turndown.turndown(cleanedHtml).trim();
  return markdown.length > 0 ? markdown : undefined;
}

function getFirstMeaningfulMarkdownLine(markdown: string): string | undefined {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
}

function startsWithPrimaryHeading(markdown: string): boolean {
  return /^#\s+\S/.test(getFirstMeaningfulMarkdownLine(markdown) ?? "");
}

/**
 * Convert fetched HTML into markdown.
 * The function prefers semantic primary-content containers, falls back to
 * Readability for unstructured pages, and only converts the full body when
 * no stronger content signal exists.
 */
export function transformHtmlToMarkdown(input: TransformInput): string {
  const dom = new JSDOM(input.html, {
    url: input.url ?? FALLBACK_BASE_URL
  });
  const { document } = dom.window;

  const semanticMarkdown = toMarkdownCandidate(selectSemanticPrimaryHtml(document));
  const readabilityMarkdown = toMarkdownCandidate(
    selectReadabilityHtml(new JSDOM(input.html, { url: input.url ?? FALLBACK_BASE_URL }).window.document)
  );
  const fallbackMarkdown = toMarkdownCandidate(extractBodyHtml(document));

  const markdown =
    semanticMarkdown && startsWithPrimaryHeading(semanticMarkdown) && !startsWithPrimaryHeading(readabilityMarkdown ?? "")
      ? semanticMarkdown
      : readabilityMarkdown ?? semanticMarkdown ?? fallbackMarkdown;

  if (!markdown) {
    throw new ConversionError("No HTML body content found to convert.");
  }

  return `${markdown}\n`;
}

/** Extract document title from HTML head when available. */
export function extractHtmlTitle(html: string): string | undefined {
  const $ = load(html);
  const title = $("title").first().text().trim();
  return title || undefined;
}
