import { FetchError } from "./errors.js";
import type { FetchInput, FetchResult } from "./types.js";

/**
 * Fetch raw HTML using Node's native fetch implementation.
 * Throws {@link FetchError} for transport, status, or body-read failures.
 */
export async function fetchStaticHtml(input: FetchInput): Promise<FetchResult> {
  const headers = new Headers(input.headers);

  let response: Response;
  try {
    response = await fetch(input.url, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(input.timeoutMs)
    });
  } catch (error) {
    throw new FetchError(
      `Static fetch failed for ${input.url}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error instanceof Error ? error : undefined }
    );
  }

  if (!response.ok) {
    throw new FetchError(
      `Static fetch failed for ${input.url}: HTTP ${response.status} ${response.statusText}`
    );
  }

  try {
    const body = await response.text();
    return {
      body,
      finalUrl: response.url || input.url,
      status: response.status,
      contentType: response.headers.get("content-type") ?? undefined
    };
  } catch (error) {
    throw new FetchError(
      `Failed reading response body for ${input.url}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}
