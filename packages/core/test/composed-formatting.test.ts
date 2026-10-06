import { describe, expect, it } from "vitest";
import { convert } from "../src/index";

/**
 * Composed/nested-formatting regression cases (unit spec Success Criteria:
 * "At least 3 composed/nested-formatting regression tests").
 *
 * Block-level separators between independent top-level blocks (e.g. the
 * blank line/newline convention between a heading and a following table)
 * are not pinned by the unit spec, so those assertions use toContain() plus
 * an ordering check instead of a full toBe() on the whole output. Purely
 * inline compositions (no ambiguous block separator involved) use exact
 * toBe() assertions, same as the conversion-table cases.
 */

describe("composed/nested formatting regressions", () => {
  it("bold link inside a list item", () => {
    const markdown = "- [**click here**](https://example.com/page)";
    const result = convert(markdown);

    expect(result.mrkdwn).toBe("• <https://example.com/page|*click here*>");
    expect(result.html).toBe(
      '<ul><li><a href="https://example.com/page"><b>click here</b></a></li></ul>'
    );
  });

  it("heading followed immediately by a table", () => {
    const markdown = "# Title\n\n| a | b |\n| --- | --- |\n| 1 | 2 |";
    const result = convert(markdown);

    const expectedMrkdwnTable = "```\na | b\n1 | 2\n```";
    const expectedHtmlTable = "<pre><code>a | b\n1 | 2</code></pre>";

    expect(result.mrkdwn).toContain("*Title*");
    expect(result.mrkdwn).toContain(expectedMrkdwnTable);
    expect(result.mrkdwn.indexOf("*Title*")).toBeLessThan(
      result.mrkdwn.indexOf(expectedMrkdwnTable)
    );

    expect(result.html).toContain("<b>Title</b>");
    expect(result.html).toContain(expectedHtmlTable);
    expect(result.html.indexOf("<b>Title</b>")).toBeLessThan(
      result.html.indexOf(expectedHtmlTable)
    );
  });

  it("italic text inside a blockquote", () => {
    const markdown = "> some _italic_ text";
    const result = convert(markdown);

    expect(result.mrkdwn).toBe("> some _italic_ text");
    expect(result.html).toBe(
      "<blockquote>some <i>italic</i> text</blockquote>"
    );
  });

  it("nested bullet list uses •, then ◦, then ▪ by nesting depth", () => {
    const markdown = "- level1\n  - level2\n    - level3";
    const result = convert(markdown);

    const mrkdwnOut = result.mrkdwn;
    const level1Index = mrkdwnOut.indexOf("• level1");
    const level2Index = mrkdwnOut.indexOf("◦ level2");
    const level3Index = mrkdwnOut.indexOf("▪ level3");

    expect(level1Index).toBeGreaterThanOrEqual(0);
    expect(level2Index).toBeGreaterThan(level1Index);
    expect(level3Index).toBeGreaterThan(level2Index);

    // Three nesting levels -> three <ul> wrappers in the HTML output.
    expect(result.html.match(/<ul>/g)?.length).toBe(3);
    expect(result.html).toContain("<li>level1");
    expect(result.html).toContain("<li>level2");
    expect(result.html).toContain("<li>level3</li>");
  });
});
