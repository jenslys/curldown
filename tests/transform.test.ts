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
      `
    });

    expect(markdown).toContain("# Title");
    expect(markdown).toContain("Hello **world**");
    expect(markdown).not.toContain("alert");
  });

  it("uses GFM strikethrough conversion", () => {
    const markdown = transformHtmlToMarkdown({
      html: `
        <body>
          <p><del>Deprecated</del> feature</p>
        </body>
      `
    });

    expect(markdown).toContain("~~Deprecated~~ feature");
  });

  it("fails when body content is empty after cleanup", () => {
    expect(() =>
      transformHtmlToMarkdown({
        html: "<html><body><script>1</script></body></html>"
      })
    ).toThrow(ConversionError);
  });
});
