import { convert } from "@md2chat/core";
import DOMPurify from "dompurify";

/**
 * Extension surface's copy of apps/web/src/pipeline.ts's pattern (per
 * unit-03-chrome-extension.md → "Sharing UI between web and extension" —
 * apps/web and apps/extension are separate Vite build targets that each
 * import @md2chat/core directly; UI code is duplicated file-for-file,
 * never imported cross-app, so this is not a re-derivation of the pattern).
 *
 * Defense-in-depth HTML sanitizer allowlist. This MUST stay identical to the
 * fixed tag set that @md2chat/core's toSlackHtml() already limits itself
 * to (see packages/core/src/index.ts, blockToHtml/inlineNodeToHtml) — see
 * unit-03-chrome-extension.md → Success Criteria, "the preview pane never
 * executes injected script", which requires two independent layers using
 * the *same* fixed tag set so a bug in either layer alone cannot produce a
 * DOM XSS.
 */
export const SANITIZE_ALLOWED_TAGS = [
  "b",
  "i",
  "s",
  "del",
  "a",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "hr",
  "br"
] as const;

export const SANITIZE_ALLOWED_ATTR = ["href"] as const;

/**
 * Input-size guard, mirrored from apps/web/src/pipeline.ts (see that file's
 * comment for the benchmark numbers behind this threshold): above this many
 * characters, convert() + DOMPurify.sanitize() can run well past the 100ms
 * live-preview budget, so renderPreview() skips conversion entirely and
 * callers show LARGE_INPUT_MESSAGE instead.
 */
export const MAX_INPUT_LENGTH = 20_000;

/** Shown in place of the live preview when input exceeds MAX_INPUT_LENGTH. */
export const LARGE_INPUT_MESSAGE =
  "This document is too large to preview live. Shorten it, or use the copy actions once it's under the size limit.";

export interface RenderedPreview {
  /** SlackMrkdwnOutput.text — used only for the "Copy mrkdwn" action. */
  mrkdwn: string;
  /** SlackHtmlFragment.html, as returned by @md2chat/core, pre-sanitization. */
  html: string;
  /** `html`, run through DOMPurify's allowlist — this is what gets inserted into the DOM. */
  sanitizedHtml: string;
  /**
   * True when `markdown.length` exceeded MAX_INPUT_LENGTH and conversion was
   * skipped. When true, mrkdwn/html/sanitizedHtml are all "" — callers must
   * show LARGE_INPUT_MESSAGE instead of using them.
   */
  tooLarge: boolean;
}

/**
 * The full conversion + sanitization pipeline, extracted as a pure function
 * so it can be measured/tested (see test/performance-budget.test.ts)
 * independently of DOM event wiring and debounce timers. This is the only
 * place apps/extension calls into @md2chat/core — never re-implement any
 * of its parsing/formatting logic here.
 */
export function renderPreview(markdown: string): RenderedPreview {
  if (markdown.length > MAX_INPUT_LENGTH) {
    return { mrkdwn: "", html: "", sanitizedHtml: "", tooLarge: true };
  }
  const { mrkdwn, html } = convert(markdown);
  const sanitizedHtml = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...SANITIZE_ALLOWED_TAGS],
    ALLOWED_ATTR: [...SANITIZE_ALLOWED_ATTR]
  });
  return { mrkdwn, html, sanitizedHtml, tooLarge: false };
}
