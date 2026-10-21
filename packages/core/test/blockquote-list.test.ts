import { describe, expect, it } from "vitest";
import { convert } from "../src/index";

/**
 * Slack's quote holds inline content only, so a <ul>/<ol> pasted inside a
 * <blockquote> loses its list markers. Lists inside a blockquote render in
 * HTML as text lines with the same markers as mrkdwn.
 */

describe("list inside a blockquote", () => {
  it("nested bullet list keeps depth markers", () => {
    const result = convert("> - a\n>   - b");

    expect(result.mrkdwn).toBe("> • a\n> ◦ b");
    expect(result.html).toBe("<blockquote>• a<br>◦ b</blockquote>");
  });

  it("ordered list with nested bullets and custom start", () => {
    const result = convert("> 3. a\n>    - b\n> 4. c");

    expect(result.html).toBe("<blockquote>3. a<br>◦ b<br>4. c</blockquote>");
  });

  it("task list and inline formatting", () => {
    const result = convert("> - [ ] **todo**\n> - [x] done");

    expect(result.html).toBe("<blockquote>☐ <b>todo</b><br>☑ done</blockquote>");
  });

  it("loose list keeps blank lines between items", () => {
    const result = convert("> - a\n>\n> - b");

    expect(result.html).toBe("<blockquote>• a<br><br>• b</blockquote>");
  });

  it("paragraph before the list is separated by a blank line", () => {
    const result = convert("> q\n>\n> - a");

    expect(result.html).toBe("<blockquote>q<br><br>• a</blockquote>");
  });

  it("list outside a blockquote is unchanged", () => {
    expect(convert("- a\n  - b").html).toBe(
      "<ul><li>a<ul><li>b</li></ul></li></ul>"
    );
  });
});
