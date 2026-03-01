import { describe, expect, it } from "vitest";

import { ConversionError } from "../src/errors.js";
import { transformHtmlToMarkdown } from "../src/transform.js";

describe("transformHtmlToMarkdown", () => {
  it("removes default non-content tags and converts body to markdown", () => {
    const markdown = transformHtmlToMarkdown({
      html: `
        <html>
          <body>
            <h1>Title</h1>
            <script>alert('x')</script>
            <p>Hello <strong>world</strong></p>
          </body>
        </html>
      `,
      removeSelectors: []
    });

    expect(markdown).toContain("# Title");
    expect(markdown).toContain("Hello **world**");
    expect(markdown).not.toContain("alert");
  });

  it("removes user-provided selectors", () => {
    const markdown = transformHtmlToMarkdown({
      html: `
        <body>
          <article><p>Keep this</p></article>
          <div class="cookie-banner"><p>Drop this</p></div>
        </body>
      `,
      removeSelectors: [".cookie-banner"]
    });

    expect(markdown).toContain("Keep this");
    expect(markdown).not.toContain("Drop this");
  });

  it("fails when body content is empty after cleanup", () => {
    expect(() =>
      transformHtmlToMarkdown({
        html: "<html><body><script>1</script></body></html>",
        removeSelectors: []
      })
    ).toThrow(ConversionError);
  });
});
