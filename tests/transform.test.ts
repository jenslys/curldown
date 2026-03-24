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

  it("strips interactive page chrome from primary content", () => {
    const markdown = transformHtmlToMarkdown({
      html: `
        <html>
          <body>
            <main>
              <h1>Guide Title</h1>
              <div role="toolbar" aria-label="Actions">
                <button>Ask about this page</button>
                <button>Copy for LLM</button>
                <button>View as Markdown</button>
              </div>
              <p>This is the content users actually want to keep.</p>
              <p>Additional detail keeps the main content above the extraction threshold.</p>
              <h2><span role="button">Anchor icon</span>Section</h2>
            </main>
          </body>
        </html>
      `
    });

    expect(markdown).toContain("# Guide Title");
    expect(markdown).toContain("## Section");
    expect(markdown).toContain("This is the content users actually want to keep.");
    expect(markdown).not.toContain("Ask about this page");
    expect(markdown).not.toContain("Copy for LLM");
    expect(markdown).not.toContain("View as Markdown");
    expect(markdown).not.toContain("Anchor icon");
  });

  it("normalizes complex table cells into markdown-safe text", () => {
    const markdown = transformHtmlToMarkdown({
      html: `
        <html>
          <body>
            <main>
              <h1>Supported resources</h1>
              <p>This page contains a complex table that should still convert cleanly.</p>
              <table>
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>code</code></td>
                    <td>
                      The customer-facing code. Valid characters include:
                      <ul>
                        <li>Lower case letters (a-z)</li>
                        <li>Upper case letters (A-Z)</li>
                        <li>Digits (0-9)</li>
                      </ul>
                    </td>
                  </tr>
                </tbody>
              </table>
            </main>
          </body>
        </html>
      `
    });

    expect(markdown).toContain("| Field | Description |");
    expect(markdown).toContain("Valid characters include:");
    expect(markdown).toContain("Valid characters include: - Lower case letters (a-z) - Upper case letters (A-Z) - Digits (0-9)");
    expect(markdown).not.toContain("<table");
    expect(markdown).not.toContain("joplin-table-wrapper");
  });

  it("fails when body content is empty after cleanup", () => {
    expect(() =>
      transformHtmlToMarkdown({
        html: "<html><body><script>1</script></body></html>"
      })
    ).toThrow(ConversionError);
  });
});
