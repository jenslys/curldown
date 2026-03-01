import { chromium } from "playwright";

import { DynamicError } from "./errors.js";
import type { FetchInput } from "./types.js";

/**
 * Render a page in headless Chromium and return the resulting HTML snapshot.
 * Throws {@link DynamicError} if browser startup, navigation, or capture fails.
 */
export async function fetchDynamicHtml(input: FetchInput): Promise<string> {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: input.userAgent,
      extraHTTPHeaders: input.headers
    });

    try {
      const page = await context.newPage();
      await page.goto(input.url, {
        timeout: input.timeoutMs,
        waitUntil: "domcontentloaded"
      });
      return await page.content();
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
