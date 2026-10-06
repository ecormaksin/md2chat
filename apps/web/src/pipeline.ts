import { convert } from "@md2chat/core";
import DOMPurify from "dompurify";

/**
 * Defense-in-depth HTML sanitizer allowlist. This MUST stay identical to the
 * fixed tag set that @md2chat/core's toSlackHtml() already limits itself
 * to (see packages/core/src/index.ts, blockToHtml/inlineNodeToHtml) — see
 * unit-02-web-app.md → Success Criteria, "preview pane never executes
 * injected script", which requires two independent layers using the *same*
 * fixed tag set so a bug in either layer alone cannot produce a DOM XSS.
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
 * Input-size guard: above this many characters, convert() + DOMPurify.sanitize()
 * can run well past the 100ms live-preview budget (benchmarked: a 500-item
 * flat list ~162ms, a 500x15 table ~555ms, a 200-level deeply-nested list
 * ~510ms — all of which are comfortably above this threshold in raw character
 * count). Rather than run the expensive pipeline synchronously on the main
 * thread for input this large, renderPreview() skips conversion entirely and
 * callers show LARGE_INPUT_MESSAGE instead. Chosen high enough that a long,
 * realistic document (e.g. a full README) won't trip it, low enough to catch
 * the pathological cases above.
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
 * place apps/web calls into @md2chat/core — never re-implement any of its
 * parsing/formatting logic here.
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
