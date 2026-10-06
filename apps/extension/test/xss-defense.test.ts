import { describe, expect, it } from "vitest";
import { renderPreview, SANITIZE_ALLOWED_TAGS } from "../src/pipeline";

/**
 * Defense-in-depth regression test for unit-03-chrome-extension.md's
 * Success Criterion "the preview pane never executes injected script from
 * user input" — same cases as apps/web/test/xss-defense.test.ts, run
 * against this app's own renderPreview, pinning that the second,
 * independent DOMPurify layer here (src/pipeline.ts) strips these payloads
 * on its own even though @md2chat/core's toSlackHtml() already refuses
 * to emit them.
 */

/**
 * Mirror of the fixed tag set @md2chat/core's toSlackHtml() may emit
 * (packages/core/test/html-sanitization.test.ts ALLOWED_TAGS), including
 * `br` added by .ai-dlc/preserve-line-breaks/unit-01-html-line-breaks.md (§5).
 */
const CORE_ALLOWED_TAGS = [
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
];

describe("renderPreview defense-in-depth sanitization", () => {
  it("strips a raw <script> tag injected directly into an inline HTML node", () => {
    const { sanitizedHtml } = renderPreview(
      "before <script>alert(1)</script> after"
    );
    expect(sanitizedHtml.toLowerCase()).not.toContain("<script");
    expect(sanitizedHtml.toLowerCase()).not.toContain("</script");
  });

  it("never carries an onerror handler through to the sanitized output", () => {
    const { sanitizedHtml } = renderPreview('before <img src=x onerror="alert(1)"> after');
    expect(sanitizedHtml.toLowerCase()).not.toContain("onerror");
    expect(sanitizedHtml.toLowerCase()).not.toContain("<img");
  });

  it("only ever contains tags from the fixed allowlist", () => {
    const { sanitizedHtml } = renderPreview(
      "# Heading\n\n**bold** _italic_ ~~strike~~ `code`\n\n" +
        "- one\n- two\n\n> quote\n\n[link](https://example.com)\n\n---\n\n```\nblock\n```"
    );
    const tagsUsed = [...sanitizedHtml.matchAll(/<\/?([a-z0-9]+)[ >]/gi)].map((m) =>
      (m[1] ?? "").toLowerCase()
    );
    const allowed = new Set(CORE_ALLOWED_TAGS);
    for (const tag of tagsUsed) {
      expect(allowed.has(tag), `unexpected tag <${tag}> in sanitized output`).toBe(true);
    }
  });

  it("strips a javascript: URL scheme even if it somehow reached this layer", () => {
    const { sanitizedHtml } = renderPreview("[click me](javascript:alert(1))");
    expect(sanitizedHtml.toLowerCase()).not.toContain("javascript:");
  });

  it("SANITIZE_ALLOWED_TAGS matches the core allowed tag set (including br)", () => {
    expect([...SANITIZE_ALLOWED_TAGS].sort()).toEqual([...CORE_ALLOWED_TAGS].sort());
  });

  it("strips a raw <br onerror=...> tag from the input", () => {
    const { sanitizedHtml } = renderPreview('a <br onerror="alert(1)"> b');
    expect(sanitizedHtml.toLowerCase()).not.toContain("onerror");
    expect(sanitizedHtml.toLowerCase()).not.toContain("<br");
  });
});
