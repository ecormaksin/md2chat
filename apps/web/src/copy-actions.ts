import { copyPlainText, copySlackRichText } from "@md2chat/browser-utils";
import DOMPurify from "dompurify";
import { SANITIZE_ALLOWED_ATTR, SANITIZE_ALLOWED_TAGS } from "./pipeline";

/**
 * Thin, independently-mockable wrapper around @md2chat/browser-utils'
 * copySlackRichText / copyPlainText. apps/web must never re-implement
 * ClipboardItem feature-detection/fallback logic itself (see
 * unit-02-web-app.md → Boundaries) — this module only translates the
 * helper's CopyOutcome into the UI-facing status the click handlers render.
 */
export type CopyStatus = { kind: "copied" } | { kind: "plain-fallback" };

/**
 * "Copy for Slack": writes both text/html and text/plain in one clipboard
 * call via copySlackRichText, using @md2chat/core's SlackHtmlFragment.html
 * and SlackMrkdwnOutput.text. The html is run through the same DOMPurify
 * allowlist used for the DOM preview (src/pipeline.ts SANITIZE_ALLOWED_TAGS)
 * before it reaches the clipboard — the clipboard write is the tool's actual
 * output artifact (what gets pasted into Slack/Gmail/Word/etc.), so it gets
 * the same defense-in-depth as the preview pane rather than relying solely
 * on @md2chat/core's own escaping/allowlist.
 */
export async function handleCopyForSlack(
  html: string,
  mrkdwn: string
): Promise<CopyStatus> {
  const sanitizedHtml = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...SANITIZE_ALLOWED_TAGS],
    ALLOWED_ATTR: [...SANITIZE_ALLOWED_ATTR]
  });
  const outcome = await copySlackRichText(sanitizedHtml, mrkdwn);
  return outcome === "rich" ? { kind: "copied" } : { kind: "plain-fallback" };
}

/** "Copy mrkdwn": writes only the plain-text mrkdwn string. */
export async function handleCopyMrkdwn(mrkdwn: string): Promise<CopyStatus> {
  await copyPlainText(mrkdwn);
  return { kind: "copied" };
}
