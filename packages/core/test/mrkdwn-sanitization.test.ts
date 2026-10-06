import { describe, expect, it } from "vitest";
import { convert } from "../src/index";

/**
 * mrkdwn sanitization requirements (pre-delivery review findings, HIGH):
 *
 * 1. `&`, `<`, `>` in ordinary text must be escaped in mrkdwn output the
 *    same way the HTML renderer already escapes them — Slack's mrkdwn
 *    format treats `<...>` as the start of its own live link/mention
 *    syntax, so an unescaped `<`/`>` is not inert the way it might look.
 * 2. A raw-HTML-shaped mdast "html" node (e.g. `<!here>`, `<!channel>`,
 *    `<@U...>`, `<#C...>`) must not be passed through live — it is a real
 *    Slack directive once pasted, not inert HTML text.
 * 3. mrkdwn link/image URLs must go through the same scheme allowlist as
 *    the HTML renderer (drop the `<url|label>` wrapper, keep the label, for
 *    a disallowed scheme), and a literal `|` in an allowed URL must not be
 *    able to inject an extra separator into Slack's `<url|label>` syntax.
 */

describe("toMrkdwn escaping of &, <, > in ordinary text", () => {
  it("escapes &, <, > the same way the HTML renderer does", () => {
    const result = convert("5 < 10 & 3 > 1");

    expect(result.mrkdwn).toContain("&lt;");
    expect(result.mrkdwn).toContain("&amp;");
    expect(result.mrkdwn).toContain("&gt;");
    expect(result.mrkdwn).toBe("5 &lt; 10 &amp; 3 &gt; 1");
  });
});

describe("toMrkdwn neutralization of raw-HTML-shaped Slack mention syntax", () => {
  it("escapes <!here> instead of passing it through as a live mention", () => {
    const result = convert("please read this <!here>");

    expect(result.mrkdwn).not.toContain("<!here>");
    expect(result.mrkdwn).toBe("please read this &lt;!here&gt;");
  });

  it("escapes <!channel> instead of passing it through as a live mention", () => {
    const result = convert("<!channel> attention everyone");

    expect(result.mrkdwn).not.toContain("<!channel>");
    expect(result.mrkdwn).toContain("&lt;!channel&gt;");
  });
});

describe("toMrkdwn link/image URL scheme allowlist and pipe escaping", () => {
  it("neutralizes a javascript: URL in link syntax, dropping the <url|label> wrapper", () => {
    const result = convert("[click me](javascript:alert(1))");

    expect(result.mrkdwn).not.toContain("javascript:");
    expect(result.mrkdwn).not.toContain("<");
    expect(result.mrkdwn).toBe("click me");
  });

  it("neutralizes a javascript: URL in image syntax, dropping the <url|label> wrapper", () => {
    const result = convert("![x](javascript:alert(1))");

    expect(result.mrkdwn).not.toContain("javascript:");
    expect(result.mrkdwn).not.toContain("<");
    expect(result.mrkdwn).toBe("x");
  });

  it("still emits a live <url|label> construct for allowlisted schemes", () => {
    expect(convert("[e](https://example.com)").mrkdwn).toBe(
      "<https://example.com|e>"
    );
  });

  it("percent-encodes a literal | in the URL so it cannot inject an extra <url|label> separator", () => {
    const result = convert(
      "[legit](https://good.com|https://evil.com)"
    );

    expect(result.mrkdwn).toBe(
      "<https://good.com%7Chttps://evil.com|legit>"
    );
    // Exactly one unescaped "|" — the genuine url/label separator.
    expect(result.mrkdwn.split("|")).toHaveLength(2);
  });
});
