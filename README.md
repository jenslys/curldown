# curldown

Fetch a webpage and return clean Markdown for AI workflows.

`curldown` is CLI-first:

- Static mode: `fetch` HTML -> Cheerio cleanup -> Turndown markdown.
- Dynamic mode: headless Chromium (Playwright) -> HTML -> markdown.
- `--auto` tries static first and falls back to dynamic when static output is thin.
- Direct markdown responses are passed through (including `.md` URLs served as `text/plain`).
- `--format json` emits markdown plus metadata for agent pipelines.

## Install

```bash
npm install -g @jenslys/curldown
```

## Quick Start

```bash
# Print markdown to stdout
curldown https://example.com

# JS-heavy pages
curldown https://example.com --dynamic

# Auto fallback to dynamic when static output looks incomplete
curldown https://example.com --auto

# JSON output for AI pipelines
curldown https://example.com --format json

# Write output to a file
curldown https://example.com --output page.md
```

## CLI

```bash
curldown <url> [options]
```

## Options

- `--auto` Try static first and fallback to dynamic when static output is thin.
- `--dynamic` Use Playwright Chromium to render before extraction.
- `--format <type>` Output format: `markdown` (default) or `json`.
- `-o, --output <path>` Write output to file instead of stdout.
- `--timeout-ms <number>` Request/render timeout in milliseconds.
- `--header <key:value>` Custom request header (repeatable).
- `--help` Show help.
- `--version` Show version.

## JSON Output Shape

`--format json` returns:

- `url`
- `final_url`
- `title`
- `markdown`
- `content_type`
- `status`
- `fetched_at`
- `word_count`
- `sha256`
- `used_dynamic`

## Local Development

```bash
bun install
bun run build
bun run test
node dist/cli.js https://example.com
```

## AGENTS.md Snippet (Optional)

Paste this into your `AGENTS.md` if you want agents to always use `curldown` for website content retrieval:

```md
## Website Content Retrieval

- Use `curldown` for website/article page retrieval in agent workflows.
- Do not use `curldown` for raw code files or repository file blobs (for those, fetch the file directly).
- Default command: `curldown <url>`.
- Prefer `curldown <url> --auto` when page rendering might be uncertain.
- Use `curldown <url> --format json` when downstream steps need structured metadata.
- Prefer stdout output unless a task explicitly requires a file (`--output <path>`).
- Do not use ad-hoc HTML scraping or direct browser automation when `curldown` can handle it.
```
