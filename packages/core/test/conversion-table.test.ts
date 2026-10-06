import { describe, expect, it } from "vitest";
import { convert } from "../src/index";

/**
 * Executable spec for the 14-row conversion table in
 * .ai-dlc/md-for-slack/unit-01-core-conversion-library.md.
 *
 * Each row gets one dedicated mrkdwn case and one dedicated HTML case
 * (test.each below expands to 14 + 14 = 28 individual Vitest test cases),
 * satisfying the "dedicated Vitest case per table row (14 rows minimum)"
 * success criteria for both output formats.
 */

interface ConversionTableRow {
  row: number;
  name: string;
  markdown: string;
  mrkdwn: string;
  html: string;
}

const CONVERSION_TABLE_ROWS: ConversionTableRow[] = [
  {
    row: 1,
    name: "heading",
    markdown: "# Heading",
    mrkdwn: "*Heading*",
    html: "<b>Heading</b>",
  },
  {
    row: 2,
    name: "bold",
    markdown: "**bold**",
    mrkdwn: "*bold*",
    html: "<b>bold</b>",
  },
  {
    row: 3,
    name: "italic",
    markdown: "*italic*",
    mrkdwn: "_italic_",
    html: "<i>italic</i>",
  },
  {
    row: 4,
    name: "strikethrough",
    markdown: "~~strike~~",
    mrkdwn: "~strike~",
    html: "<s>strike</s>",
  },
  {
    row: 5,
    name: "link",
    markdown: "[label](https://url.example/page)",
    mrkdwn: "<https://url.example/page|label>",
    html: '<a href="https://url.example/page">label</a>',
  },
  {
    row: 6,
    name: "image",
    markdown: "![alt](https://url.example/image.png)",
    mrkdwn: "<https://url.example/image.png|alt>",
    html: '<a href="https://url.example/image.png">alt (image)</a>',
  },
  {
    row: 7,
    name: "bullet list",
    markdown: "- item",
    mrkdwn: "• item",
    html: "<ul><li>item</li></ul>",
  },
  {
    row: 8,
    name: "numbered list",
    markdown: "1. item",
    mrkdwn: "1. item",
    html: "<ol><li>item</li></ol>",
  },
  {
    row: 9,
    name: "task list",
    markdown: "- [ ] todo\n- [x] done",
    mrkdwn: "☐ todo\n☑ done",
    html: "<ul><li>☐ todo</li><li>☑ done</li></ul>",
  },
  {
    row: 10,
    name: "blockquote",
    markdown: "> quote",
    mrkdwn: "> quote",
    html: "<blockquote>quote</blockquote>",
  },
  {
    row: 11,
    name: "inline code",
    markdown: "`code`",
    mrkdwn: "`code`",
    html: "<code>code</code>",
  },
  {
    row: 12,
    name: "code block",
    markdown: "```js\nconst x = 1;\n```",
    mrkdwn: "```\nconst x = 1;\n```",
    html: "<pre><code>const x = 1;</code></pre>",
  },
  {
    row: 13,
    name: "table",
    // Widths chosen so no column needs right-padding on its last cell,
    // keeping this row's expected strings free of trailing whitespace.
    // See table-alignment.test.ts for the full column-alignment algorithm
    // coverage (multi-column, alignment markers, byte-for-byte).
    markdown: "| a | b |\n| --- | --- |\n| ccc | d |",
    mrkdwn: "```\na   | b\nccc | d\n```",
    html: "<pre><code>a   | b\nccc | d</code></pre>",
  },
  {
    row: 14,
    name: "divider",
    markdown: "---",
    mrkdwn: "─".repeat(40),
    html: "<hr>",
  },
];

describe("conversion table — mrkdwn output", () => {
  it.each(CONVERSION_TABLE_ROWS)(
    "row $row ($name): $markdown -> mrkdwn",
    ({ markdown, mrkdwn }) => {
      expect(convert(markdown).mrkdwn).toBe(mrkdwn);
    }
  );
});

describe("conversion table — HTML output", () => {
  it.each(CONVERSION_TABLE_ROWS)(
    "row $row ($name): $markdown -> html",
    ({ markdown, html }) => {
      expect(convert(markdown).html).toBe(html);
    }
  );
});
