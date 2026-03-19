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

  it("prefers semantic primary content over full body chrome", () => {
    const markdown = transformHtmlToMarkdown({
      html: `
        <html>
          <body>
            <nav>
              <a href="/docs">Docs</a>
              <a href="/blog">Blog</a>
            </nav>
            <main>
              <h1>Guide Title</h1>
              <p>This is the page content users actually want to read.</p>
              <p>It includes enough body text to qualify as primary content.</p>
              <p>Additional details keep the extraction comfortably above the threshold.</p>
            </main>
            <footer>
              <a href="/privacy">Privacy</a>
            </footer>
          </body>
        </html>
      `
    });

    expect(markdown).toContain("# Guide Title");
    expect(markdown).not.toContain("Docs");
    expect(markdown).not.toContain("Privacy");
  });

  it("removes empty links and images without descriptive alt text", () => {
    const markdown = transformHtmlToMarkdown({
      html: `
        <html>
          <body>
            <main>
              <h1>Title</h1>
              <a href="/empty"><svg aria-hidden="true"></svg></a>
              <img src="/blank.png" alt="" />
              <a href="/logo"><img src="/logo.png" alt="Company logo" /></a>
              <p>Body copy.</p>
            </main>
          </body>
        </html>
      `,
      url: "https://example.com/docs"
    });

    expect(markdown).not.toContain("/empty");
    expect(markdown).not.toContain("/blank.png");
    expect(markdown).toContain("[![Company logo](https://example.com/logo.png)](https://example.com/logo)");
  });

  it("prefers readability output when semantic containers are mostly navigation chrome", () => {
    const markdown = transformHtmlToMarkdown({
      html: `
        <html>
          <body>
            <main>
              <p>Menu</p>
              <ul>
                <li><a href="/docs/start">Getting Started</a></li>
                <li><a href="/docs/install">Installation</a></li>
                <li><a href="/docs/config">Configuration</a></li>
                <li><a href="/docs/cache">Caching</a></li>
                <li><a href="/docs/deploy">Deploying</a></li>
                <li><a href="/docs/upgrade">Upgrading</a></li>
              </ul>
              <p>Versions Releases API Guides Reference Tutorials Examples Integrations Deployments</p>
              <p>Search Feedback Community Support Changelog Templates Enterprise Pricing</p>
            </main>
            <div class="content">
              <h1>Ship with confidence</h1>
              <p>This guide explains how teams can ship production changes safely and quickly.</p>
              <p>It covers previews, testing workflows, rollback procedures, and deployment checks.</p>
              <p>Each section focuses on practical actions rather than navigation chrome.</p>
            </div>
          </body>
        </html>
      `
    });

    expect(markdown).toContain("Ship with confidence");
    expect(markdown).toContain("This guide explains how teams can ship production changes safely and quickly.");
    expect(markdown).not.toContain("Getting Started");
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
