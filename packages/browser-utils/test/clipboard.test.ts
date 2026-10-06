import { afterEach, describe, expect, it, vi } from "vitest";
import { copyPlainText, copySlackRichText } from "../src/index";

/**
 * Vitest cases for copySlackRichText / copyPlainText, per unit spec Success
 * Criteria: rich-success path (returns "rich"), fallback path when
 * ClipboardItem/multi-MIME write throws (returns "plain-fallback" and still
 * calls writeText with the mrkdwn string), and the plain copyPlainText path.
 * navigator.clipboard (and ClipboardItem, which jsdom does not implement)
 * are mocked via vi.stubGlobal.
 */

class FakeClipboardItem {
  constructor(public readonly items: Record<string, unknown>) {}
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("copySlackRichText", () => {
  it('resolves "rich" and writes both text/html and text/plain via navigator.clipboard.write on success', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal("ClipboardItem", FakeClipboardItem);
    vi.stubGlobal("navigator", { clipboard: { write, writeText } });

    const outcome = await copySlackRichText(
      "<b>bold</b>",
      "*bold*"
    );

    expect(outcome).toBe("rich");
    expect(write).toHaveBeenCalledTimes(1);
    expect(writeText).not.toHaveBeenCalled();
  });

  it('falls back to writeText(mrkdwn) and resolves "plain-fallback" when the rich write throws', async () => {
    const write = vi.fn().mockRejectedValue(new Error("ClipboardItem unsupported"));
    const writeText = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal("ClipboardItem", FakeClipboardItem);
    vi.stubGlobal("navigator", { clipboard: { write, writeText } });

    const outcome = await copySlackRichText("<b>bold</b>", "*bold*");

    expect(outcome).toBe("plain-fallback");
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("*bold*");
  });

  it('falls back to writeText(mrkdwn) and resolves "plain-fallback" when ClipboardItem is unsupported (undefined)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    // No global ClipboardItem stubbed at all -> simulates an unsupported browser.
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const outcome = await copySlackRichText("<b>bold</b>", "*bold*");

    expect(outcome).toBe("plain-fallback");
    expect(writeText).toHaveBeenCalledWith("*bold*");
  });
});

describe("copyPlainText", () => {
  it("calls navigator.clipboard.writeText with the given text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await copyPlainText("plain text to copy");

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("plain text to copy");
  });
});
