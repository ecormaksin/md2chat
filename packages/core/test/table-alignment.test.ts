import { describe, expect, it } from "vitest";
import { convert } from "../src/index";

/**
 * Dedicated coverage for the table (row 13) column-alignment algorithm
 * pinned in unit-01-core-conversion-library.md:
 *
 * - pad each column to the Unicode display width of its widest cell
 * - left-align by default, honoring GFM `:---` / `---:` / `:---:` markers
 * - columns joined with " | "
 * - a cell with an escaped literal `\|` renders as a literal `|`
 *
 * These byte-for-byte expected strings were derived by implementing the
 * pinned algorithm in an isolated script and running it against the same
 * fixture data, not hand-counted, to avoid transcription error in the
 * executable spec itself.
 */

describe("GFM table column-alignment algorithm", () => {
  it("byte-for-byte output for a 3-column table with left/center/right alignment markers", () => {
    const markdown = [
      "| Item | Qty | Price |",
      "|:-----|:---:|------:|",
      "| Pen | 5 | 1.50 |",
      "| Ruler | 100 | 0.99 |",
    ].join("\n");

    const expectedRows = [
      "Item  | Qty | Price",
      "Pen   |  5  |  1.50",
      "Ruler | 100 |  0.99",
    ];

    const result = convert(markdown);

    expect(result.mrkdwn).toBe(
      "```\n" + expectedRows.join("\n") + "\n```"
    );
    expect(result.html).toBe(
      "<pre><code>" + expectedRows.join("\n") + "</code></pre>"
    );
  });

  it("a cell with an escaped pipe (\\|) renders the literal | character without breaking column alignment", () => {
    const markdown = ["| a\\|b | c |", "| --- | --- |", "| 1 | 2 |"].join(
      "\n"
    );

    const expectedRows = ["a|b | c", "1   | 2"];

    const result = convert(markdown);

    expect(result.mrkdwn).toBe(
      "```\n" + expectedRows.join("\n") + "\n```"
    );
    expect(result.html).toBe(
      "<pre><code>" + expectedRows.join("\n") + "</code></pre>"
    );
  });

  /**
   * Table (row 13) spec, pinned algorithm: "a cell containing a hard line
   * break renders as a single space in the padded output." A literal
   * `<br>` HTML tag inside a table cell parses (via remark-gfm) as a
   * `{type: "html", value: "<br>"}` node sandwiched between two text nodes
   * in that cell's children — table source lines cannot contain a
   * markdown-syntax hard break (two trailing spaces + newline), since each
   * row is exactly one source line, so this is the actual, reachable
   * fixture for that pinned rule. `phrasingNodePlainText`'s `case "html":
   * return ""` currently drops it to the empty string instead of a space,
   * concatenating the surrounding words ("a" + "" + "b" -> "ab").
   */
  it("a table cell containing a literal <br> tag renders as a single space, per the pinned algorithm, not an empty string", () => {
    const markdown = ["| a<br>b | c |", "| --- | --- |", "| x | y |"].join(
      "\n"
    );

    const expectedRows = ["a b | c", "x   | y"];

    const result = convert(markdown);

    expect(result.mrkdwn).not.toContain("ab | c");
    expect(result.mrkdwn).toBe(
      "```\n" + expectedRows.join("\n") + "\n```"
    );
    expect(result.html).toBe(
      "<pre><code>" + expectedRows.join("\n") + "</code></pre>"
    );
  });
});
