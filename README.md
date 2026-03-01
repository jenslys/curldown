# curldown

Fetch a webpage and return clean Markdown.

`curldown` is a CLI-first tool for AI agents and scripts:

- Static mode: `fetch` HTML -> Cheerio cleanup -> Turndown markdown.
- Dynamic mode: headless Chromium (Playwright) -> HTML -> markdown.

## Install

```bash
npm install -g curldown
```

## Quick Start

```bash
# Print markdown to stdout
curldown https://example.com

# JS-heavy pages
curldown https://example.com --dynamic

# Write to file
curldown https://example.com --output page.md
```

## CLI

```bash
curldown <url> [options]
```

## Options

- `--dynamic` Use Playwright Chromium to render before extraction.
- `-o, --output <path>` Write markdown to file instead of stdout.
- `--timeout-ms <number>` Request/render timeout in milliseconds.
- `--user-agent <string>` Override request user-agent.
- `--header <key:value>` Custom request header (repeatable).
- `--remove-selector <css>` Remove selector(s) before conversion (repeatable).
- `--help` Show help.
- `--version` Show version.

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

- Always use `curldown` to fetch web pages for agent workflows.
- Default command: `curldown <url>`.
- If the page is JS-rendered or incomplete, retry with: `curldown <url> --dynamic`.
- Prefer stdout output unless a task explicitly requires a file (`--output <path>`).
- Do not use ad-hoc HTML scraping or direct browser automation when `curldown` can handle it.
```

## Exit Codes

- `0` success
- `1` input/usage error
- `2` static fetch/network error
- `3` dynamic render/browser error
- `4` output write error
- `5` conversion pipeline error
