---
status: completed
last_updated: "2026-09-25T01:39:26Z"
depends_on: []
branch: ai-dlc/md-for-slack/01-core-conversion-library
discipline: backend-library
pass: ""
workflow: tdd
ticket: ""
design_ref: ""
views: []
hat: reviewer
retries: 2
---

# unit-01-core-conversion-library

## Description

Implements `@mdforslack/core`, the single source of truth for converting Markdown into the two Slack
output formats. Both `unit-02-web-app` and `unit-03-chrome-extension` depend on this module and must
never re-implement or fork any part of the conversion logic — this is what guarantees the web app and
the extension can never drift into producing different output for the same input.

Lives in `packages/core` of an npm-workspaces monorepo (see discovery.md → "Architecture Decision:
Monorepo Shape"). `packages/core` itself has no UI, no DOM access beyond string/HTML generation, and
no network calls. This unit also scaffolds the workspace root config and a second, separate package,
`packages/browser-utils` (a small DOM-touching clipboard helper — see Technical Specification below),
kept out of `packages/core` specifically so the conversion logic stays DOM-free and Node-testable.

## Discipline

backend-library - This unit will be executed by builder agents; TDD workflow (test-writer →
implementer → refactorer → reviewer) applies per intent.md `workflow` unit-level override, because
correctness of the conversion table below is this project's entire value proposition and is fully
unit-testable.

## Domain Entities

- `MarkdownDocument` (input: raw string)
- `ConversionAst` (parsed `mdast` tree via `remark` + `remark-gfm`)
- `ConversionRule` (each table row below, encoded as a renderer case)
- `SlackMrkdwnOutput`, `SlackHtmlFragment` (the two outputs)

## Data Sources

- The extracted functional specification below (transcribed from the original site's own on-page
  documentation — reusable as facts/rules, not as copied creative text).
- `remark` + `remark-gfm` npm packages (parse `MarkdownDocument.rawText` into `ConversionAst`).

## Technical Specification

### Public API (`packages/core/src/index.ts`)

```ts
export interface ConvertResult {
  mrkdwn: string;      // SlackMrkdwnOutput.text
  html: string;        // SlackHtmlFragment.html — Slack-paste-compatible rich text
}

export function parse(markdown: string): Root; // mdast Root, from remark+remark-gfm
export function toMrkdwn(ast: Root): string;
export function toSlackHtml(ast: Root): string;
export function convert(markdown: string): ConvertResult; // convenience: parse() + both renderers
```

Both `unit-02` and `unit-03` MUST import and call `convert()` (or the equivalent `parse` +
`toMrkdwn`/`toSlackHtml` pair) from `@mdforslack/core` — no unit outside this one may contain any
Markdown-parsing or Slack-formatting logic.

### Conversion table to implement (from the original site's documented cheat sheet — functional spec,
reimplemented independently, not copied code)

| # | Element | Markdown | mrkdwn output | HTML output (Slack-paste-compatible) |
|---|---|---|---|---|
| 1 | Heading (`#`..`######`) | `# Heading` | `*Heading*` (bold line — Slack has no headings) | `<b>Heading</b>` on its own line |
| 2 | Bold | `**bold**` | `*bold*` (single asterisks) | `<b>bold</b>` |
| 3 | Italic | `*italic*` or `_italic_` | `_italic_` (underscores) | `<i>italic</i>` |
| 4 | Strikethrough | `~~strike~~` | `~strike~` (single tildes) | `<s>strike</s>` (or `<del>`) |
| 5 | Link | `[label](https://url)` | `<https://url\|label>` | `<a href="https://url">label</a>` |
| 6 | Image | `![alt](https://url)` | link text to the image URL (Slack can't paste-embed images) | `<a href="https://url">alt (image)</a>` |
| 7 | Bullet list | `- item` | `• item` (`◦` then `▪` when nested) | `<ul><li>item</li></ul>` |
| 8 | Numbered list | `1. item` | `1. item` (typed numbers kept as-is) | `<ol><li>item</li></ol>` |
| 9 | Task list | `- [ ]` / `- [x]` | `☐ todo` / `☑ done` | checkbox-style `<li>` (unicode glyph, since Slack paste has no native checkbox input) |
| 10 | Blockquote | `> quote` | `> quote` (same syntax) | `<blockquote>quote</blockquote>` |
| 11 | Inline code | `` `code` `` | `` `code` `` (same syntax) | `<code>code</code>` |
| 12 | Code block | ` ```lang\n...\n``` ` | ` ```\n...\n``` ` (language tag dropped) | `<pre><code>...</code></pre>` |
| 13 | Table | `\| a \| b \|` | column-aligned monospace text inside a fenced code block | `<pre><code>` with column-aligned text (same rendering as mrkdwn — Slack has no HTML table paste target) |
| 14 | Divider | `---` | exactly 40 `─` (U+2500 BOX DRAWINGS LIGHT HORIZONTAL) characters, no surrounding text | `<hr>` (or an equivalent visual rule the Slack composer accepts on paste) |

Use `remark` + `remark-gfm` to parse (see discovery.md → "Technology Choice: Markdown Parsing
Approach" for why GFM extensions map 1:1 onto rows 4/7/9/13). Implement `toMrkdwn` and `toSlackHtml`
as two renderer functions walking the *same* `ConversionAst` — never re-parse the source string twice
and never let the two renderers diverge in which node kinds they support.

#### Table (row 13) column-alignment algorithm — pinned, not left to implementation discretion

Pad each column to the width of its widest cell, measured in **Unicode display width** (i.e. via a
library such as `string-width`, not raw JS string `.length`, so CJK/wide characters and emoji count
as their visual width rather than their UTF-16 code-unit count). Columns are left-padded with single
spaces to that width and separated by a single space and a `|` character (e.g. `a   | b`), matching
common Markdown-table-to-plain-text rendering conventions. GFM alignment markers (`:---`, `---:`,
`:---:`) control left/right/center padding within each column's fixed width; a column with no
alignment marker defaults to left-alignment. Cells containing a literal `|` (escaped in the source as
`\|`) render as a literal `|` in the output (already unescaped by `remark-gfm`'s table parsing); a
cell containing a hard line break renders as a single space in the padded output (tables are
rendered as single-line rows — no embedded newlines in a single output line).

### HTML sanitization requirement (ties to intent-level XSS success criterion)

`toSlackHtml` must only ever emit HTML tags/attributes that this unit itself generates from the typed
AST (the fixed tag set in the table above: `b`, `i`, `s`/`del`, `a[href]`, `ul`/`ol`/`li`, `blockquote`,
`code`, `pre`, `hr`). It must never pass through raw HTML found inside the user's Markdown input
verbatim (e.g. an inline HTML block node from `mdast`) — such nodes must be escaped to their literal
text representation, not rendered as live HTML. This is what makes the intent-level "no DOM XSS"
criterion possible to satisfy in `unit-02`/`unit-03`, which will just call `toSlackHtml` and trust its
output.

### Shared browser clipboard helper (`packages/browser-utils`) — separate package, not part of
`@mdforslack/core`

`unit-02-web-app` and `unit-03-chrome-extension` both need identical clipboard feature-detection and
fallback behavior for "Copy for Slack" / "Copy mrkdwn". This logic must not be duplicated between the
two apps (that would risk exactly the kind of two-surface drift this project's shared-core
architecture exists to prevent) and must not live inside `@mdforslack/core` (which is deliberately
DOM-free — clipboard write requires `navigator.clipboard`, a DOM/browser global). Instead, this unit
also scaffolds a second, separate workspace package, `packages/browser-utils`, exporting:

```ts
export type CopyOutcome = "rich" | "plain-fallback";

export async function copySlackRichText(html: string, mrkdwn: string): Promise<CopyOutcome>;
// Attempts navigator.clipboard.write([new ClipboardItem({ "text/html": ..., "text/plain": ... })]).
// Returns "rich" on success. On any failure (unsupported ClipboardItem, insecure context, etc.),
// falls back to navigator.clipboard.writeText(mrkdwn) and returns "plain-fallback" so the caller
// can show the "only mrkdwn was copied" notice.

export async function copyPlainText(text: string): Promise<void>;
// navigator.clipboard.writeText(text) — used by the "Copy mrkdwn" button.
```

`unit-02` and `unit-03` must call these two functions rather than re-implementing feature-detection
or fallback logic themselves — their own Technical Specifications describe only *when* to call them
(on which button click) and how to render the resulting confirmation/notice state, not *how* the
clipboard write itself works.

## Success Criteria

- [x] `convert()` (or `parse` + `toMrkdwn`/`toSlackHtml`) produces the mrkdwn output specified in the
      table above for a dedicated Vitest case per table row (14 rows minimum)
- [x] `convert()` produces the HTML output specified in the table above for a dedicated Vitest case
      per table row (14 rows minimum)
- [x] At least 3 composed/nested-formatting regression tests pass (e.g. a bold link inside a list
      item; a heading followed immediately by a table; italic text inside a blockquote)
- [x] At least one multi-column GFM table test case (including one with alignment markers) asserts
      the exact padded string output specified by the column-alignment algorithm above, byte-for-byte
- [x] The divider (row 14) test asserts the mrkdwn output equals exactly 40 `─` characters and
      nothing else
- [x] `toSlackHtml` never emits an HTML tag or attribute outside the fixed set in the table above,
      even when the input Markdown contains raw inline HTML — verified by a Vitest case that feeds
      `<script>alert(1)</script>` (and a couple of other raw-HTML/attribute-injection attempts) as
      Markdown input and asserts the output contains no `<script`, `onerror=`, `javascript:`, or any
      tag/attribute not in the fixed set
- [x] The package builds and type-checks standalone (`tsc --noEmit` in `packages/core`) with no
      dependency on any DOM global (no `document`, `window`, or browser-only API) — it must be usable
      from both a browser and a Node test runner
- [x] A repository-root `LICENSE` file containing the MIT license text exists, and the root
      `package.json` declares `"license": "MIT"` — this unit has no dependencies and is built first,
      so it owns adding the repo-wide license file; `unit-02` and `unit-03` are responsible only for
      surfacing/linking to it from their own UI, not for creating it
- [x] The npm-workspaces root scaffolding exists so `unit-02` and `unit-03` can resolve
      `@mdforslack/core` and intent.md's quality gates can run: a root `package.json` with a
      `"workspaces"` array listing `packages/*` and `apps/*`, and the four delegating root npm
      scripts (`test`, `lint`, `typecheck`, `build`) that fan out into each workspace package; plus a
      shared `tsconfig.base.json` and a root ESLint config. This is distinct from, and in addition
      to, this unit's own license-file ownership above — `unit-02`/`unit-03` still own their own
      app-specific build config, only the shared workspace root belongs here
- [x] `packages/browser-utils` exists with `copySlackRichText` and `copyPlainText` implemented as
      specified, with Vitest cases (mocking `navigator.clipboard`) covering: the successful rich-copy
      path (returns `"rich"`), the fallback path when `ClipboardItem`/multi-MIME write throws
      (returns `"plain-fallback"` and still calls `writeText` with the mrkdwn string), and the plain
      `copyPlainText` path

## Risks

- **Slack's real paste-acceptance behavior for the generated HTML is not publicly documented** —
  the automated tests above only verify the HTML *we* generate is deterministic and to-spec; they
  cannot verify Slack's composer actually renders it as intended. Mitigation: `unit-02` and `unit-03`
  each include a manual acceptance step (paste into a real Slack workspace) before being considered
  done — this unit's automated tests are necessary but not sufficient proof of end-to-end correctness.
- **GFM edge cases beyond the 14 documented rows** (e.g. footnotes, autolinks, HTML comments) are not
  covered by the original site's spec. Mitigation: pass them through as plain escaped text rather than
  silently dropping content — never crash on unrecognized node kinds.

## Boundaries

This unit does NOT include: any UI, any *app-level* clipboard-button wiring or confirmation-state UI
(that's `unit-02`/`unit-03`, which call this unit's `packages/browser-utils` helper but own when to
call it and how to render the result), any build tooling specific to the apps beyond the shared
workspace root, and any deployment/publishing work. (`packages/browser-utils`'s clipboard-write
*mechanism* itself is in scope for this unit, as described above — only the UI-level call sites are
out of scope.)

## Notes

- Do not copy any HTML, CSS, or copy text from the original marktoslack.com site — the table above is
  a reimplementation from a factual specification, not copied code.
- See discovery.md → "Technology Choice: Markdown Parsing Approach" for the full rationale on
  choosing `remark`+`remark-gfm` over hand-rolled regex parsing.
