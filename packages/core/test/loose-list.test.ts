import { describe, expect, it } from "vitest";
import { convert } from "../src/index";

/**
 * A loose list (items separated by blank lines, mdast `list.spread`) must keep
 * a blank line between its items in both output formats instead of packing
 * them together like a tight list.
 */

describe("loose list keeps blank lines between items", () => {
  it("bullet list with nested items", () => {
    const result = convert("- **a**\n    - b\n\n- c\n    - **d**");

    expect(result.mrkdwn).toBe("• *a*\n◦ b\n\n• c\n◦ *d*");
    expect(result.html).toBe(
      "<ul><li><b>a</b><ul><li>b</li></ul></li></ul><br>" +
        "<ul><li>c<ul><li><b>d</b></li></ul></li></ul>"
    );
  });

  it("ordered list continues numbering across split wrappers", () => {
    const result = convert("1. a\n\n2. b\n\n3. c");

    expect(result.mrkdwn).toBe("1. a\n\n2. b\n\n3. c");
    expect(result.html).toBe(
      '<ol><li>a</li></ol><br><ol start="2"><li>b</li></ol><br><ol start="3"><li>c</li></ol>'
    );
  });

  it("tight list stays packed", () => {
    const result = convert("- a\n- b");

    expect(result.mrkdwn).toBe("• a\n• b");
    expect(result.html).toBe("<ul><li>a</li><li>b</li></ul>");
  });
});
