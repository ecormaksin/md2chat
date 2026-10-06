import { describe, expect, it } from "vitest";
import { renderPreview } from "../src/pipeline";

/**
 * Builds a ~500-word Markdown fixture mixing headings, bold/italic, links,
 * and both ordered/unordered lists — a realistic mixed-content document, not
 * just repeated plain text — per unit-02-web-app.md's performance budget
 * criterion ("...for a 500-word input").
 */
function buildFixture(): string {
  const lines: string[] = ["# Release Notes", ""];
  for (let section = 0; section < 10; section += 1) {
    lines.push(`## Section ${section + 1}`, "");
    lines.push(
      `This section covers **important fixes** and _notable improvements_ shipped this ` +
        `cycle. See the [full changelog](https://example.com/log/${section}) for details on ` +
        `every change that landed, including edge cases and follow-up work tracked separately.`
    );
    lines.push("");
    lines.push("- **Fixed** a login regression affecting some users");
    lines.push("- _Improved_ page load time across the board");
    lines.push("- Updated the [documentation](https://example.com/docs) with new examples");
    lines.push("");
    lines.push("1. Reviewed the change");
    lines.push("2. Deployed to staging");
    lines.push("3. Verified in production");
    lines.push("");
  }
  return lines.join("\n");
}

describe("renderPreview performance budget", () => {
  it("completes the convert + DOMPurify sanitize pipeline within 100ms for a ~500-word input", () => {
    const fixture = buildFixture();
    const wordCount = fixture.split(/\s+/).filter(Boolean).length;
    // Sanity check on the fixture itself, not the thing under test.
    expect(wordCount).toBeGreaterThanOrEqual(450);

    const start = performance.now();
    const result = renderPreview(fixture);
    const elapsed = performance.now() - start;

    // Sanity check the pipeline actually did work, not a no-op.
    expect(result.sanitizedHtml.length).toBeGreaterThan(0);
    expect(result.mrkdwn.length).toBeGreaterThan(0);

    expect(elapsed).toBeLessThan(100);
  });
});
