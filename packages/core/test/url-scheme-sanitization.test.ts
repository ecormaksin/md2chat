import { describe, expect, it } from "vitest";
import { convert } from "../src/index";

/**
 * XSS via URL scheme in ORDINARY Markdown link/image syntax (unit spec:
 * intent-level "no DOM XSS" criterion — see .ai-dlc/md-for-slack/intent.md,
 * "スクリプト実行やDOM XSSが発生しない"). This is distinct from
 * html-sanitization.test.ts, which covers raw HTML blocks in the Markdown
 * source; here the Markdown source is ordinary `[label](url)` /
 * `![alt](url)` syntax — no raw HTML involved — but the URL itself carries
 * a dangerous scheme (`javascript:`, `data:`, etc.).
 *
 * Pinned neutralization convention (test-writer decision, RED phase, retry
 * cycle 1): `toSlackHtml` allowlists exactly `http:`, `https:`, and
 * `mailto:` (case-insensitive) as link/image URL schemes. A link or image
 * whose URL scheme is not on the allowlist is neutralized by dropping the
 * `<a href="...">...</a>` wrapper entirely and emitting only its inner
 * content as plain rendered text (still HTML-escaped, still recursing into
 * nested inline formatting for a link's children) — i.e. it degrades to
 * exactly what would be emitted if the `[...](...)` markup were not a link
 * at all. An image degrades the same way to its `alt (image)` text, minus
 * the anchor. This keeps the fix local to `case "link"` / `case "image"` in
 * `inlineNodeToHtml` and requires no new tag outside the unit's fixed
 * allowed-tag set.
 */

describe("toSlackHtml URL scheme allowlist for ordinary Markdown link/image syntax", () => {
  it("neutralizes a javascript: URL in ordinary [label](url) link syntax", () => {
    const result = convert("[click me](javascript:alert(1))");

    expect(result.html).not.toContain("javascript:");
    expect(result.html).not.toContain("<a ");
    expect(result.html).toBe("click me");
  });

  it("neutralizes a javascript: URL in ordinary ![alt](url) image syntax", () => {
    const result = convert("![x](javascript:alert(document.cookie))");

    expect(result.html).not.toContain("javascript:");
    expect(result.html).not.toContain("<a ");
    expect(result.html).toBe("x (image)");
  });

  it("neutralizes a data: URL in ordinary [label](url) link syntax", () => {
    const result = convert(
      "[x](data:text/html,<script>alert(1)</script>)"
    );

    expect(result.html).not.toContain("<a ");
    expect(result.html).not.toContain("<script");
    expect(result.html).toBe("x");
  });

  it("neutralizes a data: URL in ordinary ![alt](url) image syntax", () => {
    const result = convert("![x](data:text/html,alert(1))");

    expect(result.html).not.toContain("<a ");
    expect(result.html).toBe("x (image)");
  });

  it("is case-insensitive when matching disallowed schemes (JaVaScRiPt:)", () => {
    const result = convert("[click me](JaVaScRiPt:alert(1))");

    expect(result.html.toLowerCase()).not.toContain("javascript:");
    expect(result.html).not.toContain("<a ");
    expect(result.html).toBe("click me");
  });

  it("still emits a live <a href> for allowlisted schemes: http, https, mailto", () => {
    expect(convert("[e](https://example.com)").html).toBe(
      '<a href="https://example.com">e</a>'
    );
    expect(convert("[e](http://example.com)").html).toBe(
      '<a href="http://example.com">e</a>'
    );
    expect(convert("[e](mailto:test@example.com)").html).toBe(
      '<a href="mailto:test@example.com">e</a>'
    );
  });

  it("preserves nested inline formatting when neutralizing a link's children", () => {
    const result = convert("[**bold click**](javascript:alert(1))");

    expect(result.html).not.toContain("<a ");
    expect(result.html).not.toContain("javascript:");
    expect(result.html).toBe("<b>bold click</b>");
  });
});

/**
 * Retry cycle 2 (RED phase): reviewer rejected the unit again after retry 1
 * fixed 2 of 3 originally-flagged bugs, finding a NEW variant of the
 * URL-scheme bypass above. `SCHEME_PREFIX_PATTERN` requires the URL
 * string's *first character* to be a letter to detect a scheme prefix;
 * anything else (a leading space, a leading tab) is treated as
 * scheme-less/relative and passed through as a live link unconditionally.
 * A tab character *inside* the scheme word also breaks the pattern's
 * contiguous-letters assumption, so the colon it expects right after the
 * letters is never found either.
 *
 * This does not affect the ordinary `[label](url)` destination form —
 * CommonMark's bare destination syntax cannot contain a raw space or tab
 * at all (remark-gfm would stop parsing the destination at the space).
 * It *does* affect the angle-bracket destination form, `[label](<url>)`,
 * which CommonMark explicitly permits to contain spaces and tabs inside
 * the `<...>` delimiters. `[x](< javascript:alert(1)>)` and
 * `[x](<java\tscript:alert(1)>)` both slip past the current regex and
 * render as a live `<a href>` whose href, once a browser (or the WHATWG
 * URL Standard's own leading/trailing-trim and internal
 * tab/newline-stripping normalization) resolves it, is exploitable
 * `javascript:` scheme.
 *
 * A raw newline inside `<...>` is not constructible as a link at all —
 * remark-gfm does not parse an angle-bracket destination containing a
 * line break as a link, so it falls back to literal, non-live text with
 * no href anywhere; there is nothing to pin here.
 *
 * Same neutralization convention as retry cycle 1 (drop the `<a href>`
 * wrapper, keep inner content as plain rendered text) applies to the new
 * negative cases below.
 */
describe("toSlackHtml URL scheme allowlist for angle-bracket <url> link destination syntax", () => {
  it("neutralizes a javascript: URL hidden behind a leading space inside <...>", () => {
    const result = convert("[x](< javascript:alert(1)>)");

    expect(result.html).not.toContain("<a ");
    expect(result.html).not.toContain("javascript:");
    expect(result.html).toBe("x");
  });

  it("neutralizes a javascript: URL split by a tab character inside <...>", () => {
    const result = convert("[x](<java\tscript:alert(1)>)");

    expect(result.html).not.toContain("<a ");
    expect(result.html).not.toContain("javascript:");
    expect(result.html).toBe("x");
  });

  it("neutralizes a javascript: URL hidden behind a leading tab inside <...>", () => {
    const result = convert("[x](<\tjavascript:alert(1)>)");

    expect(result.html).not.toContain("<a ");
    expect(result.html).not.toContain("javascript:");
    expect(result.html).toBe("x");
  });

  it("neutralizes a javascript: URL followed by a trailing space inside <...>", () => {
    const result = convert("[x](<javascript:alert(1) >)");

    expect(result.html).not.toContain("<a ");
    expect(result.html).not.toContain("javascript:");
    expect(result.html).toBe("x");
  });

  it("neutralizes a javascript: URL followed by a trailing tab inside <...>", () => {
    const result = convert("[x](<javascript:alert(1)\t>)");

    expect(result.html).not.toContain("<a ");
    expect(result.html).not.toContain("javascript:");
    expect(result.html).toBe("x");
  });

  it("still emits a live, correct <a href> for a legitimate angle-bracket URL", () => {
    const result = convert("[x](<https://example.com>)");

    expect(result.html).toBe('<a href="https://example.com">x</a>');
  });
});
