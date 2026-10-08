import type {
  Blockquote,
  Code,
  Delete,
  Emphasis,
  Heading,
  Html,
  Image,
  InlineCode,
  Link,
  List,
  ListItem,
  Paragraph,
  PhrasingContent,
  Root,
  RootContent,
  Strong,
  Table,
  TableCell,
  Text,
} from "mdast";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import stringWidth from "string-width";
import { nestShallowListsUnderOrderedItems } from "./list-indentation.js";

/**
 * Result of converting a Markdown document into both Slack output formats.
 * See .ai-dlc/md-for-slack/unit-01-core-conversion-library.md for the full
 * conversion table this module implements. The HTML line-break representation
 * (`<br>` for line breaks and block separators) is overridden by
 * .ai-dlc/preserve-line-breaks/.
 */
export interface ConvertResult {
  /** SlackMrkdwnOutput.text */
  mrkdwn: string;
  /** SlackHtmlFragment.html — Slack-paste-compatible rich text */
  html: string;
}

const processor = remark().use(remarkGfm);

/**
 * Parses raw Markdown into an mdast Root using remark + remark-gfm, after
 * re-indenting 2-space lists nested under ordered items (see
 * list-indentation.ts).
 */
export function parse(markdown: string): Root {
  return processor.parse(nestShallowListsUnderOrderedItems(markdown));
}

/**
 * Renders an mdast Root into Slack mrkdwn plain text.
 */
export function toMrkdwn(ast: Root): string {
  return ast.children
    .map((child) => blockToMrkdwn(child, 0))
    .filter((text) => text.length > 0)
    .join("\n\n");
}

/**
 * Renders an mdast Root into a Slack-paste-compatible HTML fragment.
 */
export function toSlackHtml(ast: Root): string {
  return renderHtmlBlocks(ast.children, 0);
}

/**
 * Convenience wrapper: parse() followed by both renderers.
 */
export function convert(markdown: string): ConvertResult {
  const ast = parse(markdown);
  return {
    mrkdwn: toMrkdwn(ast),
    html: toSlackHtml(ast),
  };
}

// ---------------------------------------------------------------------------
// HTML escaping helpers
// ---------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Any of `\r\n`, `\r`, `\n` counts as one line break.
const LINE_BREAK_PATTERN = /\r\n?|\n/g;

/**
 * Converts line breaks in already-escaped HTML text into `<br>` tags. Must run
 * after escapeHtml() so the emitted `<br>` itself is never escaped.
 */
function lineBreaksToBr(escapedHtml: string): string {
  return escapedHtml.replace(LINE_BREAK_PATTERN, "<br>");
}

/**
 * Collapses line breaks into a single space, for contexts that render on one
 * line (CommonMark treats a line ending inside a code span as a space; image
 * alt text has no line-break representation).
 */
function lineBreaksToSpace(value: string): string {
  return value.replace(LINE_BREAK_PATTERN, " ");
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// mrkdwn escaping helper
// ---------------------------------------------------------------------------

/**
 * Escapes the three characters Slack's mrkdwn format treats as live syntax
 * markers: `&`, `<`, `>`. `<...>` is the same construct this module emits
 * for links (`<url|label>`) and that Slack itself uses for special mentions
 * (`<!channel>`, `<!here>`, `<@U...>`, `<#C...>`, `<!subteam^...>`) — any of
 * those sequences appearing verbatim in ordinary text or in a raw-HTML-shaped
 * mdast node must be neutralized the same way Slack's own composer expects
 * plain text to be escaped, or they render as live directives once pasted.
 * `&` is replaced first so escaping `<`/`>` afterward does not get
 * double-escaped through the `&` produced by their own replacement.
 */
function escapeMrkdwn(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---------------------------------------------------------------------------
// URL scheme allowlist (XSS prevention for ordinary Markdown link/image
// syntax — see .ai-dlc/md-for-slack/intent.md, "スクリプト実行やDOM XSSが
// 発生しない"). Only http:, https:, and mailto: (case-insensitive) may be
// rendered as a live <a href>; any other scheme (javascript:, data:, etc.)
// is neutralized. A URL with no scheme-like prefix at all (a relative path)
// is left alone — it carries no live-script risk.
// ---------------------------------------------------------------------------

const ALLOWED_URL_SCHEMES = new Set(["http", "https", "mailto"]);
const SCHEME_PREFIX_PATTERN = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

// A C0 control character (0x00–0x1F) or space, checked by char code rather
// than a `/[\x00-\x1f ]/`-style regex: a literal control-character range in
// a regex literal trips ESLint's `no-control-regex` rule.
function isC0ControlOrSpace(code: number): boolean {
  return code <= 0x20;
}

/**
 * Normalizes a URL string the same way the WHATWG URL Standard's basic URL
 * parser does before it ever looks for a scheme: strip any leading/trailing
 * C0 control character (0x00–0x1F) or space, then remove every ASCII tab or
 * newline (\t, \n, \r) found anywhere in the string. CommonMark's
 * angle-bracket link destination syntax (`[x](<...>)`) permits raw spaces
 * and tabs inside the `<...>` that this normalization would strip out, so a
 * scheme like `javascript:` can be smuggled past a naive "does this start
 * with a letter" check as `< javascript:...>` or `<java\tscript:...>` while
 * still being resolved to the live `javascript:` scheme by any browser's
 * URL parser. Running the scheme check — and emitting the href — against
 * this normalized form closes that gap.
 */
function normalizeUrlForSchemeCheck(url: string): string {
  let start = 0;
  let end = url.length;
  while (start < end && isC0ControlOrSpace(url.charCodeAt(start))) {
    start += 1;
  }
  while (end > start && isC0ControlOrSpace(url.charCodeAt(end - 1))) {
    end -= 1;
  }
  return url.slice(start, end).replace(/[\t\n\r]/g, "");
}

function isAllowedUrlScheme(normalizedUrl: string): boolean {
  const match = SCHEME_PREFIX_PATTERN.exec(normalizedUrl);
  if (!match) {
    // No scheme-like prefix — a relative/relative-ish URL, not a scheme
    // that could trigger live script execution.
    return true;
  }
  // Capture group 1 is always populated when match succeeds; the fallback
  // only appeases noUncheckedIndexedAccess's static typing of match[1].
  const [, scheme = ""] = match;
  return ALLOWED_URL_SCHEMES.has(scheme.toLowerCase());
}

/**
 * Renders `inner` wrapped in an `<a href="url">` when the URL's scheme is
 * allowed, or just `inner` on its own (degrading like unlinked text) when
 * it isn't. Shared by the link and image HTML renderers, which both wrap
 * their already-rendered inner content the same way.
 *
 * The scheme allowlist decision and the emitted `href` both use the
 * normalized URL (see `normalizeUrlForSchemeCheck`), not the raw source
 * string — emitting the raw, un-normalized form back into the href would
 * just hand the same leading/trailing whitespace and embedded tabs/newlines
 * to the browser, which normalizes them away itself and resolves the same
 * dangerous scheme anyway.
 */
function renderAnchorOrInner(url: string, inner: string): string {
  const normalizedUrl = normalizeUrlForSchemeCheck(url);
  if (!isAllowedUrlScheme(normalizedUrl)) {
    return inner;
  }
  return `<a href="${escapeHtmlAttribute(normalizedUrl)}">${inner}</a>`;
}

/**
 * Escapes characters inside a URL that would otherwise be interpreted as
 * mrkdwn's own `<url|label>` link syntax delimiters: a literal `|` would
 * inject an extra separator (turning `<url|label>` into effectively
 * `<url|injected|label>`, corrupting/redirecting the link), and a literal
 * `<`/`>` would prematurely close or reopen the construct. None of these
 * three characters is valid unencoded in a URL per the URL Standard, so
 * percent-encoding them here changes no legitimate URL's meaning.
 */
function escapeMrkdwnUrl(url: string): string {
  return url.replace(/\|/g, "%7C").replace(/</g, "%3C").replace(/>/g, "%3E");
}

/**
 * mrkdwn counterpart to `renderAnchorOrInner`: renders `label` wrapped in
 * Slack's `<url|label>` link construct when the URL's scheme is allowed, or
 * just `label` on its own (degrading like unlinked text, mirroring the HTML
 * renderer's "drop the wrapper, keep inner text" convention) when it isn't.
 * `label` is expected to already be mrkdwn-escaped by the caller.
 */
function renderMrkdwnLinkOrInner(url: string, label: string): string {
  const normalizedUrl = normalizeUrlForSchemeCheck(url);
  if (!isAllowedUrlScheme(normalizedUrl)) {
    return label;
  }
  return `<${escapeMrkdwnUrl(normalizedUrl)}|${label}>`;
}

// ---------------------------------------------------------------------------
// Bullet markers by nesting depth (mrkdwn + HTML task-list glyphs)
// ---------------------------------------------------------------------------

const BULLET_MARKERS = ["•", "◦", "▪"];

function bulletForDepth(depth: number): string {
  const index = Math.min(depth, BULLET_MARKERS.length - 1);
  return BULLET_MARKERS[index] ?? "•";
}

// ---------------------------------------------------------------------------
// Inline (phrasing content) rendering — mrkdwn
// ---------------------------------------------------------------------------

function renderInlineMrkdwn(nodes: PhrasingContent[]): string {
  return nodes.map((node) => inlineNodeToMrkdwn(node)).join("");
}

function inlineNodeToMrkdwn(node: PhrasingContent): string {
  switch (node.type) {
    case "text":
      return escapeMrkdwn((node as Text).value);
    case "emphasis":
      return `_${renderInlineMrkdwn((node as Emphasis).children)}_`;
    case "strong":
      return `*${renderInlineMrkdwn((node as Strong).children)}*`;
    case "delete":
      return `~${renderInlineMrkdwn((node as Delete).children)}~`;
    case "inlineCode":
      return `\`${(node as InlineCode).value}\``;
    case "link": {
      const link = node as Link;
      return renderMrkdwnLinkOrInner(link.url, renderInlineMrkdwn(link.children));
    }
    case "image": {
      const image = node as Image;
      return renderMrkdwnLinkOrInner(image.url, escapeMrkdwn(image.alt ?? ""));
    }
    case "break":
      return "\n";
    case "html":
      // Raw HTML-shaped mdast nodes include Slack's own special-mention
      // syntax (`<!channel>`, `<!here>`, `<@U...>`, `<#C...>`,
      // `<!subteam^...>`), which is live Slack syntax once pasted, not inert
      // HTML — escape it the same as ordinary text so it renders as literal
      // characters instead of triggering a real mention/notification.
      return escapeMrkdwn((node as Html).value);
    default:
      return fallbackPlainText(node);
  }
}

// ---------------------------------------------------------------------------
// Inline (phrasing content) rendering — HTML
// ---------------------------------------------------------------------------

function renderInlineHtml(nodes: PhrasingContent[]): string {
  return nodes.map((node) => inlineNodeToHtml(node)).join("");
}

function inlineNodeToHtml(node: PhrasingContent): string {
  switch (node.type) {
    case "text":
      return lineBreaksToBr(escapeHtml((node as Text).value));
    case "emphasis":
      return `<i>${renderInlineHtml((node as Emphasis).children)}</i>`;
    case "strong":
      return `<b>${renderInlineHtml((node as Strong).children)}</b>`;
    case "delete":
      return `<s>${renderInlineHtml((node as Delete).children)}</s>`;
    case "inlineCode":
      return `<code>${escapeHtml(lineBreaksToSpace((node as InlineCode).value))}</code>`;
    case "link": {
      const link = node as Link;
      return renderAnchorOrInner(link.url, renderInlineHtml(link.children));
    }
    case "image": {
      const image = node as Image;
      return renderAnchorOrInner(
        image.url,
        `${escapeHtml(lineBreaksToSpace(image.alt ?? ""))} (image)`
      );
    }
    case "break":
      // Hard line break — `br` is part of the allowed tag set (see
      // .ai-dlc/preserve-line-breaks/).
      return "<br>";
    case "html":
      // HTML sanitization requirement: raw HTML found in the Markdown input
      // must never be passed through — not even as escaped visible text,
      // since that would still leak attribute-injection substrings like
      // `onerror=` into the output. It is dropped entirely.
      return "";
    default:
      return lineBreaksToBr(escapeHtml(fallbackPlainText(node)));
  }
}

// ---------------------------------------------------------------------------
// Block content rendering — mrkdwn
// ---------------------------------------------------------------------------

function blockToMrkdwn(node: RootContent, listDepth: number): string {
  switch (node.type) {
    case "paragraph":
      return renderInlineMrkdwn((node as Paragraph).children);
    case "heading":
      return `*${renderInlineMrkdwn((node as Heading).children)}*`;
    case "thematicBreak":
      return "─".repeat(40);
    case "blockquote":
      return renderBlockquoteMrkdwn(node as Blockquote);
    case "list":
      return renderListMrkdwn(node as List, listDepth);
    case "table":
      return `\`\`\`\n${renderTableText(node as Table)}\n\`\`\``;
    case "code":
      return `\`\`\`\n${(node as Code).value}\n\`\`\``;
    case "html":
      // See inlineNodeToMrkdwn()'s "html" case — a block-level raw-HTML-
      // shaped node can equally contain a live Slack mention directive and
      // must be neutralized the same way.
      return escapeMrkdwn((node as Html).value);
    default:
      return fallbackPlainText(node);
  }
}

function renderBlockquoteMrkdwn(node: Blockquote): string {
  const inner = node.children
    .map((child) => blockToMrkdwn(child, 0))
    .filter((text) => text.length > 0)
    .join("\n\n");
  return inner
    .split("\n")
    .map((line) => (line.length > 0 ? `> ${line}` : ">"))
    .join("\n");
}

function renderListMrkdwn(list: List, depth: number): string {
  const lines: string[] = [];

  list.children.forEach((item: ListItem, index: number) => {
    const marker = listItemMarkerMrkdwn(list, item, depth, index);
    const { textParts, nestedLists } = splitListItemChildren(item);

    const renderedText = textParts.map((child) => blockToMrkdwn(child, 0));
    const firstLine = `${marker} ${renderedText.join(" ")}`.trimEnd();
    lines.push(firstLine);

    for (const nested of nestedLists) {
      lines.push(renderListMrkdwn(nested, depth + 1));
    }
  });

  return lines.join("\n");
}

function listItemMarkerMrkdwn(
  list: List,
  item: ListItem,
  depth: number,
  index: number
): string {
  if (item.checked === true) return "☑";
  if (item.checked === false) return "☐";
  if (list.ordered) {
    const start = list.start ?? 1;
    return `${start + index}.`;
  }
  return bulletForDepth(depth);
}

// ---------------------------------------------------------------------------
// Block content rendering — HTML
// ---------------------------------------------------------------------------

function blockToHtml(node: RootContent, listDepth: number): string {
  switch (node.type) {
    case "paragraph":
      return renderInlineHtml((node as Paragraph).children);
    case "heading":
      return `<b>${renderInlineHtml((node as Heading).children)}</b>`;
    case "thematicBreak":
      return "<hr>";
    case "blockquote":
      return renderBlockquoteHtml(node as Blockquote);
    case "list":
      return renderListHtml(node as List, listDepth);
    case "table":
      return `<pre><code>${escapeHtml(renderTableText(node as Table))}</code></pre>`;
    case "code":
      return `<pre><code>${escapeHtml((node as Code).value)}</code></pre>`;
    case "html":
      // See inlineNodeToHtml() — raw HTML from the input is dropped, never
      // rendered live and never leaked as escaped text either.
      return "";
    default:
      return lineBreaksToBr(escapeHtml(fallbackPlainText(node)));
  }
}

// Block kinds rendered as an HTML block element (ul/ol, blockquote, pre, hr),
// which already starts a new line on its own. Every other block (paragraph,
// heading, fallback text) renders as inline content.
const HTML_BLOCK_ELEMENT_TYPES: ReadonlySet<RootContent["type"]> = new Set([
  "list",
  "blockquote",
  "code",
  "table",
  "thematicBreak",
]);

/**
 * Renders sibling blocks and joins them with the shared block separator rule
 * (see .ai-dlc/preserve-line-breaks/unit-01-html-line-breaks.md, §2), used
 * for the top level, blockquote children, and list-item text parts alike:
 * after an inline-like block `<br><br>` (line break + blank line), after a
 * block element `<br>` (blank line only, since the element already breaks
 * the line). Blocks that render to an empty string are dropped first.
 */
function renderHtmlBlocks(nodes: RootContent[], listDepth: number): string {
  let html = "";
  let previous: RootContent | undefined;
  for (const node of nodes) {
    const rendered = blockToHtml(node, listDepth);
    if (rendered.length === 0) continue;
    if (previous !== undefined) {
      html += HTML_BLOCK_ELEMENT_TYPES.has(previous.type) ? "<br>" : "<br><br>";
    }
    html += rendered;
    previous = node;
  }
  return html;
}

function renderBlockquoteHtml(node: Blockquote): string {
  return `<blockquote>${renderHtmlBlocks(node.children, 0)}</blockquote>`;
}

function renderListHtml(list: List, depth: number): string {
  const tag = list.ordered ? "ol" : "ul";
  const items = list.children
    .map((item) => renderListItemHtml(list, item, depth))
    .join("");
  // Mirror the mrkdwn sibling (listItemMarkerMrkdwn's `list.start ?? 1`):
  // an ordered list with a custom start number must number from that value
  // in HTML output too, not silently restart at 1.
  const start = list.start ?? 1;
  const startAttr = list.ordered && start !== 1 ? ` start="${start}"` : "";
  return `<${tag}${startAttr}>${items}</${tag}>`;
}

function renderListItemHtml(list: List, item: ListItem, depth: number): string {
  const { textParts, nestedLists } = splitListItemChildren(item);
  const prefix = taskGlyphPrefixHtml(item);
  // Nested lists get no separator before them: ul/ol already break the line.
  const textHtml = renderHtmlBlocks(textParts, 0);
  const nestedHtml = nestedLists
    .map((nested) => renderListHtml(nested, depth + 1))
    .join("");
  return `<li>${prefix}${textHtml}${nestedHtml}</li>`;
}

function taskGlyphPrefixHtml(item: ListItem): string {
  if (item.checked === true) return "☑ ";
  if (item.checked === false) return "☐ ";
  return "";
}

/**
 * Splits a list item's block children into the parts that contribute to the
 * item's own text (paragraphs and any other non-list block, rendered via the
 * ordinary block renderer) and any nested lists (rendered recursively, one
 * nesting level deeper).
 */
function splitListItemChildren(item: ListItem): {
  textParts: RootContent[];
  nestedLists: List[];
} {
  const textParts: RootContent[] = [];
  const nestedLists: List[] = [];

  for (const child of item.children) {
    if (child.type === "list") {
      nestedLists.push(child);
    } else {
      textParts.push(child);
    }
  }

  return { textParts, nestedLists };
}

// ---------------------------------------------------------------------------
// Table (row 13) column-alignment algorithm
// ---------------------------------------------------------------------------

// blockToMrkdwn and blockToHtml both render every table via this function
// (mrkdwn and HTML tables are the same monospace text, just wrapped
// differently), so a Table node's layout is computed once and cached here,
// keyed by the node's own identity. This is safe because convert() runs
// exactly one parse() and both renderers walk that same AST instance.
const tableTextCache = new WeakMap<Table, string>();

function renderTableText(table: Table): string {
  const cached = tableTextCache.get(table);
  if (cached !== undefined) {
    return cached;
  }

  const align = table.align ?? [];
  const rows = table.children.map((row) =>
    row.children.map((cell) => tableCellPlainText(cell))
  );
  // Computed once per cell here and reused for both the column-width pass
  // and the per-cell padding pass below, instead of calling stringWidth()
  // on the same cell text twice.
  const rowWidths = rows.map((row) => row.map((cell) => stringWidth(cell)));

  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const columnWidths: number[] = [];
  for (let col = 0; col < columnCount; col += 1) {
    let width = 0;
    for (const rowWidth of rowWidths) {
      width = Math.max(width, rowWidth[col] ?? 0);
    }
    columnWidths.push(width);
  }

  const result = rows
    .map((row, rowIndex) =>
      row
        .map((cell, col) =>
          padCell(
            cell,
            rowWidths[rowIndex]?.[col] ?? 0,
            columnWidths[col] ?? 0,
            align[col] ?? null
          )
        )
        .join(" | ")
    )
    .join("\n");

  tableTextCache.set(table, result);
  return result;
}

function padCell(
  cell: string,
  cellWidth: number,
  columnWidth: number,
  align: "left" | "right" | "center" | null
): string {
  const pad = Math.max(0, columnWidth - cellWidth);
  if (align === "right") {
    return " ".repeat(pad) + cell;
  }
  if (align === "center") {
    const left = Math.floor(pad / 2);
    const right = pad - left;
    return " ".repeat(left) + cell + " ".repeat(right);
  }
  // Default: left-aligned.
  return cell + " ".repeat(pad);
}

/**
 * Plain-text content of a table cell (tables are rendered as monospace text
 * inside a fenced code block, so inline formatting marks are not applied —
 * only their text content is kept). A hard line break inside a cell renders
 * as a single space, per the pinned column-alignment algorithm.
 */
function tableCellPlainText(cell: TableCell): string {
  return cell.children.map((child) => phrasingNodePlainText(child)).join("");
}

function phrasingNodePlainText(node: PhrasingContent): string {
  switch (node.type) {
    case "text":
      return (node as Text).value;
    case "inlineCode":
      return (node as InlineCode).value;
    case "break":
      return " ";
    case "image":
      return (node as Image).alt ?? "";
    case "html":
      // A hard line break inside a table cell parses as a raw `<br>` HTML
      // node (see table-alignment.test.ts) — render it as the single space
      // the pinned column-alignment algorithm specifies, not an empty
      // string, so the surrounding words don't concatenate.
      return " ";
    case "emphasis":
    case "strong":
    case "delete":
    case "link":
      return (node as Emphasis | Strong | Delete | Link).children
        .map((child) => phrasingNodePlainText(child))
        .join("");
    default:
      return fallbackPlainText(node);
  }
}

// ---------------------------------------------------------------------------
// Fallback for mdast node kinds outside the 14-row conversion table (e.g.
// footnotes, link/definition nodes, HTML comments parsed as other node
// kinds) — never crash, pass through best-effort plain text instead of
// silently dropping content.
// ---------------------------------------------------------------------------

function fallbackPlainText(node: RootContent | PhrasingContent): string {
  if ("value" in node && typeof node.value === "string") {
    return node.value;
  }
  if ("children" in node && Array.isArray(node.children)) {
    return node.children
      .map((child: RootContent | PhrasingContent) => fallbackPlainText(child))
      .join("");
  }
  return "";
}
