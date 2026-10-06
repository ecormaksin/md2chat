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
 * Attempts a rich copy (HTML + plain-text mrkdwn) via
 * navigator.clipboard.write([new ClipboardItem(...)]).
 * Falls back to navigator.clipboard.writeText(mrkdwn) on any failure
 * (unsupported ClipboardItem, insecure context, etc.).
 */
export async function copySlackRichText(
  html: string,
  mrkdwn: string
): Promise<CopyOutcome> {
  try {
    if (typeof ClipboardItem === "undefined") {
      throw new Error("ClipboardItem is not supported in this browser");
    }
    const item = new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([mrkdwn], { type: "text/plain" }),
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
