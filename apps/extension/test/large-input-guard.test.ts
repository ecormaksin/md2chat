import { describe, expect, it } from "vitest";
import { LARGE_INPUT_MESSAGE, MAX_INPUT_LENGTH, renderPreview } from "../src/pipeline";

/**
 * Same input-size guard regression test as apps/web/test/large-input-guard.test.ts,
 * run against this app's own renderPreview (see that file's comment for the
 * full rationale — this app mirrors apps/web's pipeline.ts file-for-file).
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
