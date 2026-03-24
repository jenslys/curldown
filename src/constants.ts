export const VERSION = "1.0.5";

export const DEFAULT_STATIC_TIMEOUT_MS = 15_000;
export const DEFAULT_DYNAMIC_TIMEOUT_MS = 30_000;

export const DEFAULT_REMOVE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "template",
  "svg",
  "canvas",
  "iframe",
  "wbr",
  "button",
  "input",
  "select",
  "textarea",
  "[role='button']",
  "[role='toolbar']",
  "[role='separator']"
] as const;
