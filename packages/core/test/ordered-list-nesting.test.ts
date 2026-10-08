import { describe, expect, it } from "vitest";
import { convert } from "../src/index";

/**
 * CommonMark nests a list under an ordered item only when it is indented to
 * the item's content column ("1. " → 3 spaces). Editors and coding agents
 * often indent such nested lists by just 2 spaces, which CommonMark parses as
 * a separate top-level list. The converter treats a list line indented at
 * least 2 spaces deeper than an ordered item's marker as nested in that item.
 */
describe("lists nested under ordered items with 2-space indentation", () => {
  it.each([
    ["bullet under ordered", "1. a\n  - b\n  - c\n2. d", "1. a\n   - b\n   - c\n2. d"],
    ["three levels", "1. a\n  - b\n    - c", "1. a\n   - b\n     - c"],
    ["ordered under ordered", "1. a\n  1. b", "1. a\n   1. b"],
    ["two-digit marker, 2 spaces", "10. a\n  - b", "10. a\n    - b"],
    ["two-digit marker, 3 spaces", "10. a\n   - b", "10. a\n    - b"],
    ["nested under the second item", "1. a\n2. b\n  - c", "1. a\n2. b\n   - c"],
    ["CRLF line endings", "1. a\r\n  - b\r\n2. c", "1. a\n   - b\n2. c"]
  ])("%s renders like the CommonMark-indented equivalent", (_name, input, canonical) => {
    expect(convert(input)).toEqual(convert(canonical));
  });

  it("renders the nested bullet inside the ordered item", () => {
    expect(convert("1. a\n  - b\n2. c").html).toBe(
      "<ol><li>a<ul><li>b</li></ul></li><li>c</li></ol>"
    );
  });

  it("keeps a paragraph after the list at the top level", () => {
    expect(convert("1. a\n  - b\n\nafter").html).toBe(
      "<ol><li>a<ul><li>b</li></ul></li></ol><br>after"
    );
  });

  it("leaves a 1-space indented line under an ordered item unchanged", () => {
    expect(convert("1. a\n - b").html).toBe("<ol><li>a</li></ol><br><ul><li>b</li></ul>");
  });

  it("leaves 1-space sibling bullets under a bullet item unchanged", () => {
    expect(convert("- a\n - b").html).toBe("<ul><li>a</li><li>b</li></ul>");
  });

  it("does not rewrite list-like lines inside a fenced code block", () => {
    expect(convert("```\n1. a\n  - b\n```").html).toBe("<pre><code>1. a\n  - b</code></pre>");
  });
});
