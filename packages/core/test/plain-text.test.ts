import { describe, expect, it } from "vitest";
import { convert } from "../src/index";

/**
 * Slack's composer reads `text/plain` instead of `text/html` when the former
 * contains markup such as `*bold*` or a `1.` list line, which turns list markers and links into
 * literal text. plainText must therefore carry no markup.
 */

describe("plainText carries no Slack markup", () => {
  it.each([
    ["**b** _i_ ~~s~~ `c`", "b i s c"],
    ["# heading", "heading"],
    ["> quoted", "quoted"],
    ["```\ncode\n```", "code"],
    ["- a\n  - b", "• a\n◦ b"],
    ["1. a\n2. b", "1) a\n2) b"],
    ["3. a\n   - b", "3) a\n◦ b"],
    ["- [ ] a", "☐ a"],
    ["a & <b>", "a & "],
  ])("%j", (markdown, expected) => {
    expect(convert(markdown).plainText).toBe(expected);
  });

  it("keeps the link target as `label (url)`", () => {
    expect(convert("[label](https://example.com/a)").plainText).toBe(
      "label (https://example.com/a)"
    );
    expect(convert("**[label](https://example.com/)**").plainText).toBe(
      "label (https://example.com/)"
    );
  });

  it("does not repeat a URL used as its own label", () => {
    expect(convert("https://example.com/").plainText).toBe(
      "https://example.com/"
    );
  });

  it("drops the target of a disallowed URL scheme", () => {
    expect(convert("[label](javascript:alert(1))").plainText).toBe("label");
  });

  it("leaves mrkdwn output unchanged", () => {
    expect(convert("1. a").mrkdwn).toBe("1. a");
    expect(convert("**[label](https://example.com/)**").mrkdwn).toBe(
      "*<https://example.com/|label>*"
    );
  });
});
