import { createHash } from "node:crypto";

import { ConversionError } from "./errors.js";
import { extractHtmlTitle } from "./transform.js";
import type { CliArgs, FetchResult, RunDependencies } from "./types.js";

interface PreparedContent {
  markdown: string;
  title?: string;
  source: FetchResult;
  passthrough: boolean;
}

const MARKDOWN_CONTENT_TYPES = new Set([
  "text/markdown",
  "text/x-markdown",
  "application/markdown",
  "application/x-markdown"
]);
const PLAINTEXT_CONTENT_TYPE = "text/plain";
const MARKDOWN_FILE_EXTENSIONS = [
  ".md",
  ".markdown",
  ".mdown",
  ".mkd",
  ".mkdn",
  ".mdtxt",
  ".mdx"
];

function normalizeMarkdown(markdown: string): string {
  const trimmed = markdown.trim();
  if (!trimmed) {
    throw new ConversionError("Content was fetched but markdown output is empty.");
  }

  return `${trimmed}\n`;
}

function inferTitleFromMarkdown(markdown: string): string | undefined {
  const firstHeading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return firstHeading || undefined;
}

function isMarkdownContentType(contentType: string | undefined): boolean {
  if (!contentType) {
    return false;
  }

  const normalized = contentType.toLowerCase().split(";")[0]?.trim() ?? "";
  return MARKDOWN_CONTENT_TYPES.has(normalized);
}

function isPlainTextContentType(contentType: string | undefined): boolean {
  if (!contentType) {
    return false;
  }

  const normalized = contentType.toLowerCase().split(";")[0]?.trim() ?? "";
  return normalized === PLAINTEXT_CONTENT_TYPE;
}

function hasMarkdownFileExtension(urlValue: string): boolean {
  let pathname: string;
  try {
    pathname = new URL(urlValue).pathname;
  } catch {
    return false;
  }

  const normalizedPath = pathname.toLowerCase();
  return MARKDOWN_FILE_EXTENSIONS.some((extension) => normalizedPath.endsWith(extension));
}

function shouldTreatAsMarkdownPassthrough(result: FetchResult): boolean {
  if (isMarkdownContentType(result.contentType)) {
    return true;
  }

  return isPlainTextContentType(result.contentType) && hasMarkdownFileExtension(result.finalUrl);
}

function countWords(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
}

export function shouldAutoFallback(markdown: string): boolean {
  const trimmed = markdown.trim();
  if (!trimmed) {
    return true;
  }

  const lower = trimmed.toLowerCase();
  if (/enable javascript|javascript is required|checking your browser|just a moment|please wait/.test(lower)) {
    return true;
  }

  const nonEmptyLines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
  return countWords(trimmed) < 30 && nonEmptyLines <= 2;
}

export function prepareContentFromFetchResult(
  result: FetchResult,
  deps: RunDependencies
): PreparedContent {
  if (shouldTreatAsMarkdownPassthrough(result)) {
    const markdown = normalizeMarkdown(result.body);
    return {
      markdown,
      title: inferTitleFromMarkdown(markdown),
      source: result,
      passthrough: true
    };
  }

  const markdown = deps.transformHtmlToMarkdown({ html: result.body });
  return {
    markdown,
    title: extractHtmlTitle(result.body),
    source: result,
    passthrough: false
  };
}

export function formatOutput(args: CliArgs, content: PreparedContent, usedDynamic: boolean): string {
  if (args.format === "markdown") {
    return content.markdown;
  }

  const payload = {
    url: args.url,
    final_url: content.source.finalUrl,
    title: content.title ?? null,
    markdown: content.markdown,
    content_type: content.source.contentType ?? null,
    status: content.source.status,
    fetched_at: new Date().toISOString(),
    word_count: countWords(content.markdown),
    sha256: createHash("sha256").update(content.markdown).digest("hex"),
    used_dynamic: usedDynamic
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
}
