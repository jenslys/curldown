import { chromium } from "playwright";

import { DynamicError } from "./errors.js";
import type { FetchInput, FetchResult } from "./types.js";

/**
 * Render a page in headless Chromium and return the resulting HTML snapshot.
 * Throws {@link DynamicError} if browser startup, navigation, or capture fails.
 */
export async function fetchDynamicHtml(input: FetchInput): Promise<FetchResult> {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      extraHTTPHeaders: input.headers
    });

    try {
      const page = await context.newPage();
      const response = await page.goto(input.url, {
        timeout: input.timeoutMs,
        waitUntil: "domcontentloaded"
      });
      const body = await page.content();
      return {
        body,
        finalUrl: page.url(),
        status: response?.status() ?? 200,
        contentType: response?.headers()["content-type"]
      };
    } finally {
      await context.close();
    }
  } catch (error) {
    throw new DynamicError(
      `Dynamic fetch failed for ${input.url}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error instanceof Error ? error : undefined }
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
