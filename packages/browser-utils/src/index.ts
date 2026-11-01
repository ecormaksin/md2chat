/**
 * Shared browser clipboard helpers for "Copy for Slack" / "Copy mrkdwn".
 * See .ai-dlc/md-for-slack/unit-01-core-conversion-library.md → "Shared
 * browser clipboard helper (packages/browser-utils)" for the full spec.
 *
 * Kept out of @md2chat/core deliberately: writing to the clipboard
 * requires navigator.clipboard, a DOM/browser global, and @md2chat/core
 * must stay Node-testable and DOM-free.
 */

export type CopyOutcome = "rich" | "plain-fallback";

/**
 * Attempts a rich copy (HTML + markup-free plain text) via
 * navigator.clipboard.write([new ClipboardItem(...)]).
 * Falls back to navigator.clipboard.writeText(mrkdwn) on any failure
 * (unsupported ClipboardItem, insecure context, etc.).
 *
 * `plainText` must carry no Slack markup: Slack's composer reads `text/plain`
 * instead of `text/html` when the former contains markup such as `*bold*`
 * or a `1.` list line.
 */
export async function copySlackRichText(
  html: string,
  plainText: string,
  mrkdwn: string
): Promise<CopyOutcome> {
  try {
    if (typeof ClipboardItem === "undefined") {
      throw new Error("ClipboardItem is not supported in this browser");
    }
    const item = new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([plainText], { type: "text/plain" }),
    });
    await navigator.clipboard.write([item]);
    return "rich";
  } catch {
    await navigator.clipboard.writeText(mrkdwn);
    return "plain-fallback";
  }
}

/**
 * Writes plain text to the clipboard via navigator.clipboard.writeText.
 */
export async function copyPlainText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
