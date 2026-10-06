import { describe, expect, it } from "vitest";
import { convert } from "../src/index";

/**
 * Pre-delivery review finding (HIGH): renderListHtml() emitted <ol> with no
 * `start` attribute, so a custom ordered-list start number was silently
 * dropped in HTML output while the mrkdwn sibling (listItemMarkerMrkdwn,
 * `list.start ?? 1`) already numbered correctly — diverging between the two
 * output formats for the same input.
 */

describe("ordered list custom start number", () => {
  it("HTML <ol> carries a start attribute matching the list's actual start value", () => {
    const result = convert("10. tenth\n11. eleventh");

    expect(result.html).toBe(
      '<ol start="10"><li>tenth</li><li>eleventh</li></ol>'
    );
  });

  it("mrkdwn output numbers from the same custom start value", () => {
    const result = convert("10. tenth\n11. eleventh");

    expect(result.mrkdwn).toBe("10. tenth\n11. eleventh");
  });

  it("omits the start attribute (defaults to 1) for an ordinary ordered list", () => {
    const result = convert("1. first\n2. second");

    expect(result.html).toBe("<ol><li>first</li><li>second</li></ol>");
  });
});
