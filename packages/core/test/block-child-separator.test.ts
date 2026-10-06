import { describe, expect, it } from "vitest";
import { convert } from "../src/index";

/**
 * HTML word-concatenation bug for multi-block containers (unit spec, row 10
 * "Blockquote" and row 7/8/9 lists): `renderBlockquoteHtml` and
 * `renderListItemHtml` must never join their rendered block-level children
 * with `""` (empty string), or e.g. a two-paragraph blockquote renders as
 * "paragraph oneparagraph two" with the words run together.
 *
 * Separator convention: originally pinned as a single space (`" "`) because
 * `<br>` was outside the fixed allowed-tag set. Superseded by
 * .ai-dlc/preserve-line-breaks/unit-01-html-line-breaks.md (Technical
 * Specification §2/§3): paragraphs inside a blockquote or a loose list item
 * are now separated by `<br><br>`, and a soft line break renders as `<br>`,
 * using the same separator rule as top-level blocks.
 */

describe("HTML block-child separator for multi-paragraph containers", () => {
  it("separates a multi-paragraph blockquote's paragraphs with <br><br> instead of concatenating them", () => {
    const markdown = "> paragraph one\n>\n> paragraph two\n";
    const result = convert(markdown);

    // mrkdwn output is out of scope for the <br> change (regression guard).
    expect(result.mrkdwn).toBe("> paragraph one\n>\n> paragraph two");

    expect(result.html).not.toContain("paragraph oneparagraph two");
    expect(result.html).toBe(
      "<blockquote>paragraph one<br><br>paragraph two</blockquote>"
    );
  });

  it("separates a loose list item's multiple paragraphs with <br><br> instead of concatenating them", () => {
    const markdown = "- paragraph one\n\n  paragraph two\n";
    const result = convert(markdown);

    // mrkdwn output is out of scope for the <br> change (regression guard).
    expect(result.mrkdwn).toBe("• paragraph one paragraph two");

    expect(result.html).not.toContain("paragraph oneparagraph two");
    expect(result.html).toBe(
      "<ul><li>paragraph one<br><br>paragraph two</li></ul>"
    );
  });

  it("renders a soft line break inside a blockquote paragraph as <br>", () => {
    const result = convert("> line one\n> line two\n>\n> paragraph two");

    expect(result.html).toBe(
      "<blockquote>line one<br>line two<br><br>paragraph two</blockquote>"
    );
  });

  it("renders a soft line break inside a loose list item paragraph as <br>", () => {
    const result = convert("- line one\n  line two\n\n  paragraph two");

    expect(result.html).toBe(
      "<ul><li>line one<br>line two<br><br>paragraph two</li></ul>"
    );
  });
});
