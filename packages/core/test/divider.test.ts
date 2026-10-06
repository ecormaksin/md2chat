import { describe, expect, it } from "vitest";
import { convert } from "../src/index";

describe("divider (row 14)", () => {
  it("mrkdwn output is exactly 40 U+2500 BOX DRAWINGS LIGHT HORIZONTAL characters and nothing else", () => {
    const result = convert("---");

    expect(result.mrkdwn).toBe("─".repeat(40));
    expect(result.mrkdwn).toHaveLength(40);
    expect([...result.mrkdwn].every((ch) => ch === "─")).toBe(true);
  });
});
