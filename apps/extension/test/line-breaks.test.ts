import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * End-to-end check that the `<br>` line-break representation emitted by
 * @md2chat/core survives this app's DOMPurify layer — both for the live
 * preview and for the html handed to the clipboard by "Copy for Slack".
 * See .ai-dlc/preserve-line-breaks/unit-01-html-line-breaks.md (§5).
 * @md2chat/browser-utils is mocked so the html actually passed to
 * copySlackRichText (after re-sanitization) can be inspected.
 */

const copySlackRichText = vi.fn();
const copyPlainText = vi.fn();

vi.mock("@md2chat/browser-utils", () => ({
  copySlackRichText: (html: string, mrkdwn: string) => copySlackRichText(html, mrkdwn),
  copyPlainText: (text: string) => copyPlainText(text)
}));

beforeEach(() => {
  copySlackRichText.mockReset();
  copyPlainText.mockReset();
});

describe("line breaks through the sanitization pipeline", () => {
  it("keeps <br> in renderPreview's sanitizedHtml", async () => {
    const { renderPreview } = await import("../src/pipeline");

    expect(renderPreview("a\nb").sanitizedHtml).toContain("<br>");
  });

  it("passes html containing <br> to copySlackRichText from handleCopyForSlack", async () => {
    copySlackRichText.mockResolvedValue("rich");
    const { renderPreview } = await import("../src/pipeline");
    const { handleCopyForSlack } = await import("../src/copy-actions");
    const { html, mrkdwn } = renderPreview("a\nb\n\nc");

    await handleCopyForSlack(html, mrkdwn);

    expect(copySlackRichText).toHaveBeenCalledTimes(1);
    const [copiedHtml] = copySlackRichText.mock.calls[0] ?? [];
    expect(copiedHtml).toContain("<br>");
  });
});
