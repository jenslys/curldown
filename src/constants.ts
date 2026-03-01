export const VERSION = "0.1.0";

export const DEFAULT_STATIC_TIMEOUT_MS = 15_000;
export const DEFAULT_DYNAMIC_TIMEOUT_MS = 30_000;
export const DEFAULT_USER_AGENT = `curldown/${VERSION} (+https://www.npmjs.com/package/curldown)`;

export const DEFAULT_REMOVE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "template",
  "svg",
  "canvas",
  "iframe"
] as const;
