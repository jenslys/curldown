import { beforeEach, describe, expect, it, vi } from "vitest";

const goto = vi.fn();
const content = vi.fn();
const newPage = vi.fn();
const closeContext = vi.fn();
const newContext = vi.fn();
const closeBrowser = vi.fn();
const launch = vi.fn();

vi.mock("playwright", () => ({
  chromium: {
    launch
  }
}));

describe("fetchDynamicHtml", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    goto.mockResolvedValue(undefined);
    content.mockResolvedValue("<html><body><h1>Rendered</h1></body></html>");
    newPage.mockResolvedValue({ goto, content });
    closeContext.mockResolvedValue(undefined);
    newContext.mockResolvedValue({ newPage, close: closeContext });
    closeBrowser.mockResolvedValue(undefined);
    launch.mockResolvedValue({ newContext, close: closeBrowser });
  });

  it("renders and returns page HTML", async () => {
    const { fetchDynamicHtml } = await import("../src/fetch-dynamic.js");

    const html = await fetchDynamicHtml({
      url: "https://example.com",
      timeoutMs: 10_000,
      userAgent: "curldown-test",
      headers: { "x-test": "1" }
    });

    expect(html).toContain("Rendered");
    expect(launch).toHaveBeenCalledTimes(1);
    expect(newContext).toHaveBeenCalledWith({
      userAgent: "curldown-test",
      extraHTTPHeaders: { "x-test": "1" }
    });
    expect(goto).toHaveBeenCalledWith("https://example.com", {
      timeout: 10_000,
      waitUntil: "domcontentloaded"
    });
    expect(closeContext).toHaveBeenCalledTimes(1);
    expect(closeBrowser).toHaveBeenCalledTimes(1);
  });
});
