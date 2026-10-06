import { describe, expect, it } from "vitest";
import { convert } from "../src/index";

/**
 * HTML sanitization / XSS requirement (unit spec: toSlackHtml must never
 * pass through raw HTML found in the Markdown input verbatim — it must be
 * escaped to its literal text representation). Fixed tag set this unit is
 * allowed to ever emit, from the conversion table:
 * b, i, s, del, a (href only), ul, ol, li, blockquote, code, pre, hr,
 * plus br (attribute-less line break) added by
 * .ai-dlc/preserve-line-breaks/unit-01-html-line-breaks.md (§5).
 * This set must match SANITIZE_ALLOWED_TAGS in apps/web and apps/extension.
 */

const ALLOWED_TAGS = new Set([
  "br",
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
]);

/** Every opening/self-closing tag in `html` must be in ALLOWED_TAGS, and an
 * `<a>` tag may only ever carry an `href` attribute. */
function assertOnlyAllowedTagsAndAttributes(html: string): void {
  const tagPattern = /<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^<>]*)?)\/?>/g;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(html)) !== null) {
    const [, tagName, rawAttrs] = match;
    const lowerTag = tagName.toLowerCase();
    expect(ALLOWED_TAGS.has(lowerTag)).toBe(true);

    const attrNames = [...rawAttrs.matchAll(/([a-zA-Z-]+)\s*=/g)].map((m) =>
      m[1].toLowerCase()
    );
    if (lowerTag === "a") {
      for (const attr of attrNames) {
        expect(attr).toBe("href");
      }
    } else {
      expect(attrNames).toHaveLength(0);
    }
  }
}

describe("toSlackHtml sanitization against raw-HTML / attribute injection", () => {
  it("escapes a raw <script> tag instead of emitting it live", () => {
    const result = convert("<script>alert(1)</script>");

    expect(result.html).not.toContain("<script");
    expect(result.html).not.toContain("</script>");
    assertOnlyAllowedTagsAndAttributes(result.html);
  });

  it("escapes a raw <img onerror=...> attribute-injection attempt", () => {
    const result = convert('<img src=x onerror="alert(1)">');

    expect(result.html).not.toContain("onerror=");
    expect(result.html).not.toContain("<img");
    assertOnlyAllowedTagsAndAttributes(result.html);
  });

  it("escapes a raw <a href=\"javascript:...\"> attempt rather than emitting a live javascript: link", () => {
    const result = convert('<a href="javascript:alert(1)">click</a>');

    expect(result.html).not.toContain("javascript:");
    assertOnlyAllowedTagsAndAttributes(result.html);
  });

  it("never emits a tag or attribute outside the fixed set for a mixed document of real markdown plus multiple raw-HTML injection attempts", () => {
    const markdown = [
      "# Title",
      "",
      "Hello **world**, this is *safe*.",
      "",
      "<script>alert(1)</script>",
      "",
      '<img src=x onerror="alert(1)">',
      "",
      '<svg onload="alert(1)"></svg>',
      "",
      "- [normal link](https://example.com)",
    ].join("\n");

    const result = convert(markdown);

    expect(result.html).not.toContain("<script");
    expect(result.html).not.toContain("onerror=");
    expect(result.html).not.toContain("onload=");
    expect(result.html).not.toContain("javascript:");
    expect(result.html).not.toContain("<svg");
    assertOnlyAllowedTagsAndAttributes(result.html);

    // Legitimate content must still come through untouched.
    expect(result.html).toContain("<b>Title</b>");
    expect(result.html).toContain("<b>world</b>");
    expect(result.html).toContain("<i>safe</i>");
    expect(result.html).toContain('<a href="https://example.com">normal link</a>');
  });

  it("strips a raw <br onerror=...> tag from the input instead of passing it through", () => {
    const result = convert('a <br onerror="alert(1)"> b');

    expect(result.html).not.toContain("onerror");
    expect(result.html).not.toContain("<br");
    assertOnlyAllowedTagsAndAttributes(result.html);
  });

  it("strips a plain raw <br> tag from the input (raw HTML is never passed through)", () => {
    expect(convert("a <br> b").html).toBe("a  b");
    expect(convert("<br>").html).toBe("");
  });

  it("emits only attribute-less <br> tags for Markdown line breaks", () => {
    const result = convert("a\nb  \nc\n\nd");

    expect(result.html).toBe("a<br>b<br>c<br><br>d");
    assertOnlyAllowedTagsAndAttributes(result.html);
  });
});
