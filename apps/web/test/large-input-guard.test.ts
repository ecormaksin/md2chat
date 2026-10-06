import { describe, expect, it } from "vitest";
import { LARGE_INPUT_MESSAGE, MAX_INPUT_LENGTH, renderPreview } from "../src/pipeline";

/**
 * Regression test for the input-size guard added to src/pipeline.ts:
 * convert() + DOMPurify.sanitize() can run well past the 100ms live-preview
 * budget on pathological input (see performance-budget.test.ts and this
 * fix's review finding), so renderPreview() must skip the expensive
 * conversion entirely once `markdown.length` exceeds MAX_INPUT_LENGTH,
 * rather than attempt it synchronously on the main thread.
 */
describe("renderPreview input-size guard", () => {
  it("converts normally when input is at or under MAX_INPUT_LENGTH", () => {
    const markdown = "**bold**";
    const result = renderPreview(markdown);

    expect(result.tooLarge).toBe(false);
    expect(result.sanitizedHtml).toContain("<b>bold</b>");
    expect(result.mrkdwn).toBe("*bold*");
  });

  it("skips conversion and reports tooLarge once input exceeds MAX_INPUT_LENGTH", () => {
    const markdown = "a".repeat(MAX_INPUT_LENGTH + 1);
    const result = renderPreview(markdown);

    expect(result.tooLarge).toBe(true);
    expect(result.html).toBe("");
    expect(result.mrkdwn).toBe("");
    expect(result.sanitizedHtml).toBe("");
  });

  it("exposes a non-empty, distinct notice message for callers to render", () => {
    expect(LARGE_INPUT_MESSAGE.length).toBeGreaterThan(0);
    expect(LARGE_INPUT_MESSAGE).not.toBe("Your Slack-ready preview will appear here");
  });
});
