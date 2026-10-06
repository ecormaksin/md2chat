import { describe, expect, it } from "vitest";
import { renderPreview as renderExtensionPreview } from "../src/pipeline";
import { renderPreview as renderWebPreview } from "../../web/src/pipeline";

/**
 * Pins unit-03-chrome-extension.md's Success Criterion: "Typing Markdown
 * ... updates its Slack Preview live, using the same @md2chat/core
 * output as unit-02-web-app produces for the same input (verified by
 * feeding the same sample Markdown into both surfaces and comparing output
 * byte-for-byte)."
 *
 * apps/extension/src/pipeline.ts and apps/web/src/pipeline.ts are
 * intentionally separate files (see this unit's Notes / discovery.md →
 * "Sharing UI between web and extension" — logic is shared only via the
 * @md2chat/core npm package, never by one app importing the other's
 * source), so this parity holds by construction: both call the identical
 * convert() from @md2chat/core with the identical DOMPurify allowlist.
 * This test pins that structural guarantee explicitly rather than leaving
 * it implicit, since it is a named Success Criterion for this unit.
 */
const FIXTURES: string[] = [
  "# Heading\n\nSome **bold** and _italic_ text.",
  "- one\n- two\n- three\n\n1. first\n2. second",
  "See the [changelog](https://example.com/changelog) for `inline code` and:\n\n" +
    "> a blockquote\n\n---\n\n~~strikethrough~~ text."
];

describe("cross-surface parity: apps/extension vs apps/web renderPreview", () => {
  for (const [index, fixture] of FIXTURES.entries()) {
    it(`fixture ${index + 1}: produces byte-for-byte identical html and mrkdwn`, () => {
      const extensionResult = renderExtensionPreview(fixture);
      const webResult = renderWebPreview(fixture);

      expect(extensionResult.html).toBe(webResult.html);
      expect(extensionResult.mrkdwn).toBe(webResult.mrkdwn);
      expect(extensionResult.sanitizedHtml).toBe(webResult.sanitizedHtml);
    });
  }
});
