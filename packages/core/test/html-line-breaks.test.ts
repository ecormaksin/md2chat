import { describe, expect, it } from "vitest";
import { convert } from "../src/index";

/**
 * Executable spec for the `<br>` line-break representation in
 * toSlackHtml() — see .ai-dlc/preserve-line-breaks/unit-01-html-line-breaks.md
 * (Technical Specification §1–§4).
 *
 * Block separator rule (§2), shared by top-level, blockquote and list-item
 * children:
 * - previous block is inline-like (paragraph / heading / fallback text)
 *   -> `<br><br>`
 * - previous block is itself a block element (list, blockquote, code/table
 *   `<pre>`, thematicBreak `<hr>`) -> `<br>`
 * - blocks that render to "" (raw html, ...) are dropped before deciding.
 */

const fence = "```";

describe("inline line breaks", () => {
  it("renders a soft line break as <br>", () => {
    expect(convert("1行目\n2行目").html).toBe("1行目<br>2行目");
  });

  it("renders a hard line break (trailing spaces) as <br>", () => {
    expect(convert("a  \nb").html).toBe("a<br>b");
  });

  it("renders a hard line break (backslash) as <br>", () => {
    expect(convert("a\\\nb").html).toBe("a<br>b");
  });

  it.each([
    ["CRLF", "a\r\nb"],
    ["CR", "a\rb"],
  ])("treats a %s line ending as a single line break", (_label, markdown) => {
    expect(convert(markdown).html).toBe("a<br>b");
  });

  it("escapes text before inserting <br> (the <br> itself is never escaped)", () => {
    expect(convert("a & <b\nc").html).toBe("a &amp; &lt;b<br>c");
  });

  it("renders a soft break inside inline formatting as <br>", () => {
    expect(convert("**a\nb**").html).toBe("<b>a<br>b</b>");
  });

  it("replaces a newline inside an inline code span with a single space", () => {
    expect(convert("`a\nb`").html).toBe("<code>a b</code>");
  });

  it("replaces a newline inside an image alt with a single space", () => {
    expect(convert("![x\ny](http://e)").html).toBe(
      '<a href="http://e">x y (image)</a>'
    );
  });
});

describe("block separators — Technical Specification §2 expected examples", () => {
  it.each([
    ["a\n\nb", "a<br><br>b"],
    ["a\n\n- x", "a<br><br><ul><li>x</li></ul>"],
    ["- x\n\nb", "<ul><li>x</li></ul><br>b"],
    [`${fence}\nc\n${fence}\n\n---`, "<pre><code>c</code></pre><br><hr>"],
    ["> q1\n> q2", "<blockquote>q1<br>q2</blockquote>"],
    ["> p1\n>\n> p2", "<blockquote>p1<br><br>p2</blockquote>"],
  ])("%j -> %j", (markdown, html) => {
    expect(convert(markdown).html).toBe(html);
  });
});

describe("block separators — adjacency of every block kind", () => {
  const table = "| a |\n| - |\n| b |";
  const tableHtml = "<pre><code>a\nb</code></pre>";
  const code = `${fence}\nc\n${fence}`;
  const codeHtml = "<pre><code>c</code></pre>";

  // Each of paragraph / heading / list / blockquote / code / table /
  // thematicBreak appears at least once as the previous block and at least
  // once as the next block.
  it.each([
    ["paragraph -> heading", "a\n\n# h", "a<br><br><b>h</b>"],
    ["paragraph -> table", `a\n\n${table}`, `a<br><br>${tableHtml}`],
    ["heading -> heading", "# h1\n## h2", "<b>h1</b><br><br><b>h2</b>"],
    ["heading -> list", "# h\n\n- x", "<b>h</b><br><br><ul><li>x</li></ul>"],
    [
      "heading -> blockquote",
      "# h\n\n> q",
      "<b>h</b><br><br><blockquote>q</blockquote>",
    ],
    [
      "list -> list",
      "- x\n\n1. y",
      "<ul><li>x</li></ul><br><ol><li>y</li></ol>",
    ],
    [
      "list -> blockquote",
      "- x\n\n> q",
      "<ul><li>x</li></ul><br><blockquote>q</blockquote>",
    ],
    [
      "blockquote -> code",
      `> q\n\n${code}`,
      `<blockquote>q</blockquote><br>${codeHtml}`,
    ],
    ["blockquote -> paragraph", "> q\n\nb", "<blockquote>q</blockquote><br>b"],
    ["code -> table", `${code}\n\n${table}`, `${codeHtml}<br>${tableHtml}`],
    ["code -> paragraph", `${code}\n\nb`, `${codeHtml}<br>b`],
    ["table -> thematicBreak", `${table}\n\n---`, `${tableHtml}<br><hr>`],
    ["table -> paragraph", `${table}\n\nb`, `${tableHtml}<br>b`],
    ["thematicBreak -> paragraph", "---\n\nb", "<hr><br>b"],
    ["thematicBreak -> heading", "***\n\n# h", "<hr><br><b>h</b>"],
    ["paragraph -> code", `a\n\n${code}`, `a<br><br>${codeHtml}`],
    ["paragraph -> thematicBreak", "a\n\n***", "a<br><br><hr>"],
  ])("%s", (_label, markdown, html) => {
    expect(convert(markdown).html).toBe(html);
  });

  it("drops blocks that render to an empty string before deciding the separator", () => {
    expect(convert("a\n\n<div>x</div>\n\nb").html).toBe("a<br><br>b");
    expect(convert("- x\n\n<!-- c -->\n\nb").html).toBe(
      "<ul><li>x</li></ul><br>b"
    );
  });

  it("collapses multiple blank lines into a single paragraph break (html) and leaves mrkdwn unchanged", () => {
    const result = convert("a\n\n\n\nb");

    expect(result.html).toBe("a<br><br>b");
    expect(result.mrkdwn).toBe("a\n\nb");
  });

  it("treats CRLF paragraph breaks the same as LF", () => {
    expect(convert("a\r\n\r\nb").html).toBe("a<br><br>b");
  });
});

describe("line breaks inside blockquotes and list items", () => {
  it("separates a blockquote's list and following paragraph with a single <br>", () => {
    expect(convert("> - x\n>\n> b").html).toBe(
      "<blockquote><ul><li>x</li></ul><br>b</blockquote>"
    );
  });

  it("renders a soft break inside a list item as <br>", () => {
    expect(convert("- a\n  b").html).toBe("<ul><li>a<br>b</li></ul>");
  });

  it("separates a loose list item's paragraph and code block with <br><br>", () => {
    expect(convert(`- a\n\n  ${fence}\n  c\n  ${fence}`).html).toBe(
      "<ul><li>a<br><br><pre><code>c</code></pre></li></ul>"
    );
  });

  it("does not insert a separator before a nested list", () => {
    expect(convert("- a\n  b\n  - c").html).toBe(
      "<ul><li>a<br>b<ul><li>c</li></ul></li></ul>"
    );
  });
});

describe("<pre><code> keeps raw newlines", () => {
  it("keeps \\n inside a fenced code block", () => {
    expect(convert(`${fence}\nl1\nl2\n${fence}`).html).toBe(
      "<pre><code>l1\nl2</code></pre>"
    );
  });

  it("keeps \\n between table rows", () => {
    expect(convert("| a | b |\n| --- | --- |\n| ccc | d |").html).toBe(
      "<pre><code>a   | b\nccc | d</code></pre>"
    );
  });
});

describe("validation document — no raw line endings outside <pre>", () => {
  const markdown = [
    "# Title",
    "",
    "soft line one",
    "soft line two  ",
    "hard break after this, `inline\ncode` and ![alt\ntext](https://e.example/i.png)",
    "",
    "> quote one",
    "> quote two",
    ">",
    "> quote para",
    "",
    "- item one",
    "  continued",
    "",
    "  item para",
    "- item two",
    "  - nested",
    "",
    "1. ordered",
    "",
    fence,
    "code line 1",
    "code line 2",
    fence,
    "",
    "| a | b |",
    "| --- | --- |",
    "| 1 | 2 |",
    "",
    "---",
    "",
    "<div>raw</div>",
    "",
    "a[^1]",
    "",
    "[^1]: foot",
    "    line2",
    "",
    "    para2",
  ].join("\r\n");

  it("contains neither \\r nor \\n once <pre>…</pre> sections are removed", () => {
    const { html } = convert(markdown);
    const outsidePre = html.replace(/<pre>[\s\S]*?<\/pre>/g, "");

    expect(outsidePre).not.toContain("\r");
    expect(outsidePre).not.toContain("\n");
    expect(html).toContain("<br>");
  });

  it("renders the fallback footnote definition's line break as <br>", () => {
    const { html } = convert("a[^1]\n\n[^1]: foot\n    line2\n\n    para2");

    expect(html).not.toContain("\n");
    expect(html).toContain("foot<br>line2");
  });
});
