import { describe, expect, it } from "vitest";
import { convert } from "../src/index";

/**
 * Pre-delivery review finding (HIGH, performance): renderTableText() was
 * computed twice per convert() call (once from blockToMrkdwn, once from
 * blockToHtml) on the same mdast Table node. Fixed via a module-level
 * WeakMap<Table, string> keyed by node identity. This is a behavior
 * regression guard, not a timing test (timing tests are flaky) — it just
 * confirms the cache doesn't change output and doesn't leak stale layout
 * across separate convert() calls on different tables.
 */

describe("table rendering with memoized layout", () => {
  it("mrkdwn and html still render the same, correct table layout", () => {
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
    ].join("\n");

    const result = convert(markdown);

    expect(result.mrkdwn).toBe("```\n" + expectedRows + "\n```");
    expect(result.html).toBe("<pre><code>" + expectedRows + "</code></pre>");
  });

  it("does not leak cached layout between separate convert() calls on different tables", () => {
    const first = convert(
      ["| a | b |", "| --- | --- |", "| 1 | 2 |"].join("\n")
    );
    const second = convert(
      ["| longer-header | b |", "| --- | --- |", "| x | y |"].join("\n")
    );

    expect(first.mrkdwn).toBe("```\na | b\n1 | 2\n```");
    expect(second.mrkdwn).toBe(
      "```\nlonger-header | b\nx             | y\n```"
    );
  });
});
