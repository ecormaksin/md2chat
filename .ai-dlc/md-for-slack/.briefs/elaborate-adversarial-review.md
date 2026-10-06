---
intent_slug: md-for-slack
worktree_path: <repo-root>/.ai-dlc/worktrees/md-for-slack
---

# Intent

---
workflow: default
git:
  change_strategy: trunk
  default_branch: main
  auto_squash: false
announcements: [changelog]
passes: []
active_pass: ""
iterates_on: ""
created: 2026-09-24T00:00:00Z
status: active
epic: ""
quality_gates:
  - name: tests
    command: npm test
  - name: lint
    command: npm run lint
  - name: typecheck
    command: npm run typecheck
  - name: build
    command: npm run build
---

# MDforSlack — Markdown to Slack Converter

## Problem

The user relied on a third-party website, marktoslack.com, that converted Markdown text into a form
that pastes correctly into Slack (Slack does not render standard Markdown; it uses its own "mrkdwn"
dialect, so pasted Markdown leaves stray `#`, `**`, and `[text](url)` characters visible). That site
now returns NOT FOUND — it has closed. The user saved a browser MHTML snapshot of the rendered page,
but the snapshot only captured the rendered DOM, CSS, and fonts — the actual JavaScript conversion
logic was never captured (it was only referenced via a `<link rel=preload as=script>`, never inlined).

marktoslack.com was confirmed to be a **third-party site the user did not own or operate**. Its
functional specification (the Markdown → Slack mapping rules, documented on its own page as a
cheat-sheet table and FAQ) is reusable as a factual reference, but its HTML, CSS, copy text, and
branding are not — this project reimplements the *functionality* independently, under an original
brand, with original UI and wording.

## Solution

Rebuild the conversion tool as **MDforSlack**, published in a way that is resilient to a single
site/company disappearing again:

- A shared, thoroughly-tested core conversion library (`@mdforslack/core`) that parses Markdown
  (via `remark` + `remark-gfm`) and renders it into both Slack `mrkdwn` (plain text, for the API/bots)
  and a Slack-paste-compatible rich-text HTML fragment (for direct clipboard paste into the Slack
  composer).
- A static web app (`apps/web`) built on that core module, hosted on **GitHub Pages** — chosen
  specifically because the site and its source code live in the same forkable OSS repository, so
  anyone can redeploy it if the canonical host ever goes away.
- A Chrome extension (`apps/extension`, Manifest V3, using `chrome.sidePanel`) built on the *same*
  core module, so the tool works with zero dependency on any hosted domain at all.
- The whole repository is published as **open source under the MIT license**.

All conversion happens entirely client-side (no backend, no network calls) — this preserves the
original tool's own privacy claim ("nothing is uploaded to a server") and is also why a static
site + browser extension is the right shape, rather than a server-rendered app.

## Domain Model

### Entities

- **MarkdownDocument**: the raw Markdown text the user pastes or types — Field: `rawText`.
- **ConversionAst**: the parsed `mdast` syntax tree produced by `remark` + `remark-gfm` — node kinds
  include heading, paragraph, strong, emphasis, delete, link, image, list, listItem, table, tableRow,
  tableCell, blockquote, code, inlineCode, thematicBreak, text.
- **ConversionRule**: one row of the extracted Markdown→mrkdwn specification table (see below) —
  Fields: `markdownPattern`, `mrkdwnOutput`, `htmlOutput`, `notes`.
- **SlackMrkdwnOutput**: the plain-text Slack mrkdwn string — Field: `text`.
- **SlackHtmlFragment**: the Slack-paste-compatible rich-text HTML string — Field: `html`.
- **ClipboardPayload**: the dual-MIME clipboard write used by "Copy for Slack" — Fields: `htmlBlob`
  (`text/html`), `textBlob` (`text/plain`).
- **CoreConversionModule** (`@mdforslack/core`): exposes `parse(markdown)`, `toMrkdwn(ast)`,
  `toSlackHtml(ast)`. Exact public API shape (separate render functions vs. one combined `convert()`)
  is decided in unit-01.
- **WebApp** (`apps/web`) and **ExtensionPanel** (`apps/extension`): thin UI shells, both depending on
  `CoreConversionModule`, with no dependency on each other.

### Relationships

- `MarkdownDocument` is parsed into exactly one `ConversionAst`.
- `ConversionAst` is rendered into one `SlackMrkdwnOutput` and one `SlackHtmlFragment` from a single
  parse (two renderers, not two independent parsers) — this is what guarantees the two outputs cannot
  drift apart from each other.
- Each `ConversionAst` node kind corresponds to exactly one `ConversionRule`.
- `ClipboardPayload` wraps both `SlackHtmlFragment` and `SlackMrkdwnOutput` for the "Copy for Slack"
  action; the separate "copy mrkdwn" action uses `SlackMrkdwnOutput` alone.
- `WebApp` and `ExtensionPanel` both depend on `CoreConversionModule` only — never on each other.

### Data Sources

- **Extracted conversion table** (functional spec transcribed from the saved MHTML's own on-page
  cheat-sheet — see full table in unit-01): definitive mapping for 13 documented Markdown element
  types. Does not define behavior for nested/composed formatting or malformed input.
- **`remark` + `remark-gfm` AST node taxonomy** (versioned OSS library): canonical parsing for the
  full documented feature set, including the GFM extensions (strikethrough, tables, task lists) that
  map 1:1 onto the non-core-CommonMark rows of the conversion table.

### Data Gaps

- Nested/combined formatting and malformed input are not defined by the extracted spec table — these
  are resolved by deferring to `remark`/`remark-gfm`'s own deterministic CommonMark+GFM parsing
  behavior, with representative composition cases added as regression tests (see unit-01).
- Slack's rich-text-paste HTML acceptance behavior is not publicly documented — this is resolved via
  a manual acceptance step (paste the generated HTML into a real Slack client) rather than an
  automated test, and is called out explicitly in unit-02 and unit-03's success criteria.

## Success Criteria

- [ ] コア変換モジュール(`@mdforslack/core`)が仕様表の13要素すべて(見出し・太字・斜体・取り消し線・
      リンク・画像・箇条書き・番号付きリスト・タスクリスト・引用・インラインコード・コードブロック・
      テーブル・区切り線)を、mrkdwn出力・HTML出力の両方で正しく変換する(Vitestで各要素を検証)
- [ ] Webアプリで、Markdown入力パネルへの入力がSlack風プレビューパネルにリアルタイムで反映される
- [ ] Webアプリの「Copy for Slack」ボタンで、text/html + text/plain(mrkdwn)の両方がクリップボードに
      書き込まれ、Slackメッセージ入力欄への貼り付けで本物の太字・リンク・リスト・コードブロックとして
      反映される
- [ ] Webアプリの「copy mrkdwn」ボタンで、mrkdwnプレーンテキストのみがクリップボードにコピーされる
- [ ] Chrome拡張機能(Manifest V3、`chrome.sidePanel`)で、Webアプリと同じcoreモジュールを用いた同等の
      入力・プレビュー・コピー機能が動作する
- [ ] 変換処理はすべてクライアントサイドで完結し、ネットワークへの送信が一切発生しない(コードレビュー
      で`fetch`/`XMLHttpRequest`/WebSocket呼び出しが存在しないことを確認)
- [ ] ユーザー入力のMarkdownをHTMLプレビュー/クリップボードに変換する際、スクリプト実行やDOM XSSが
      発生しない(サニタイズされたAST由来のレンダリングのみを許可し、任意の生HTML挿入を行わない)
- [ ] Webアプリの主要操作(入力欄へのフォーカス、コピー操作、タブ切替)がキーボード操作のみで完結し、
      フォームコントロールに適切な`aria-label`/`label`が付与され、主要テキストのコントラスト比が
      WCAG AA(通常文字4.5:1、大きい文字3:1)を満たす
- [ ] リポジトリにMITライセンスファイルが含まれ、Webサイト・Chrome拡張の両方からライセンス表記が
      確認できる

## Context

- **Origin**: originally motivated by the closure of the third-party site marktoslack.com. The user
  confirmed they did not own that site, so this project reuses only its documented functional
  specification (the Markdown→mrkdwn mapping rules), never its HTML/CSS/copy/branding.
- **Brand name**: **MDforSlack**. The git repository directory (`mark_to_slack`) predates this brand
  decision and is close to the original site's name ("MarkToSlack") — it is for internal/dev use only
  and must never be surfaced as the public product name, domain, or store listing name.
- **Design direction**: Editorial archetype (see `.ai-dlc/knowledge/design.md` and
  `.ai-dlc/md-for-slack/design-blueprint.md` for tokens — serif headings, generous whitespace, warm
  neutral palette).
- **Resilience rationale**: the core motivation is avoiding a repeat of "one company's site
  disappears and the tool is gone" — hence GitHub Pages (source and host are the same forkable repo)
  + a Chrome extension (zero domain dependency) + MIT OSS licensing, all sharing one conversion
  module so functionality can't silently diverge between the two surfaces.
- **Coding convention (cross-cutting, not a unit)**: TypeScript strict mode and a single shared
  lint/test/build toolchain (Vite + Vitest) across `packages/core`, `apps/web`, and `apps/extension`
  via npm workspaces — every unit's reviewer should check this convention is followed, rather than
  this being implemented as its own unit.
- **Deployment ownership**: there is no separate infrastructure/observability unit. Because this is a
  backend-less static tool, each frontend unit (web app, extension) owns its own deployment/packaging
  work directly (GitHub Pages CI for the web app; a Chrome Web Store-ready zip + privacy policy for
  the extension) rather than centralizing it — a dedicated ops unit was judged disproportionate for a
  3-unit static/client-only intent.
- **Verify at build time, not guessed here**: exact current Chrome Web Store developer fee and review
  turnaround time were intentionally left unverified during elaboration — confirm against official
  Chrome Web Store documentation before executing the extension's publishing step.

# Units

## unit-01-core-conversion-library.md

---
status: pending
last_updated: ""
depends_on: []
branch: ai-dlc/md-for-slack/01-core-conversion-library
discipline: backend-library
pass: ""
workflow: tdd
ticket: ""
design_ref: ""
views: []
---

# unit-01-core-conversion-library

## Description

Implements `@mdforslack/core`, the single source of truth for converting Markdown into the two Slack
output formats. Both `unit-02-web-app` and `unit-03-chrome-extension` depend on this module and must
never re-implement or fork any part of the conversion logic — this is what guarantees the web app and
the extension can never drift into producing different output for the same input.

Lives in `packages/core` of an npm-workspaces monorepo (see discovery.md → "Architecture Decision:
Monorepo Shape"). No UI, no DOM access beyond string/HTML generation, no network calls.

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
| 14 | Divider | `---` | a plain long rule line, e.g. `────────────` | `<hr>` (or an equivalent visual rule the Slack composer accepts on paste) |

Use `remark` + `remark-gfm` to parse (see discovery.md → "Technology Choice: Markdown Parsing
Approach" for why GFM extensions map 1:1 onto rows 4/7/9/13). Implement `toMrkdwn` and `toSlackHtml`
as two renderer functions walking the *same* `ConversionAst` — never re-parse the source string twice
and never let the two renderers diverge in which node kinds they support.

### HTML sanitization requirement (ties to intent-level XSS success criterion)

`toSlackHtml` must only ever emit HTML tags/attributes that this unit itself generates from the typed
AST (the fixed tag set in the table above: `b`, `i`, `s`/`del`, `a[href]`, `ul`/`ol`/`li`, `blockquote`,
`code`, `pre`, `hr`). It must never pass through raw HTML found inside the user's Markdown input
verbatim (e.g. an inline HTML block node from `mdast`) — such nodes must be escaped to their literal
text representation, not rendered as live HTML. This is what makes the intent-level "no DOM XSS"
criterion possible to satisfy in `unit-02`/`unit-03`, which will just call `toSlackHtml` and trust its
output.

## Success Criteria

- [ ] `convert()` (or `parse` + `toMrkdwn`/`toSlackHtml`) produces the mrkdwn output specified in the
      table above for a dedicated Vitest case per table row (14 rows minimum)
- [ ] `convert()` produces the HTML output specified in the table above for a dedicated Vitest case
      per table row (14 rows minimum)
- [ ] At least 3 composed/nested-formatting regression tests pass (e.g. a bold link inside a list
      item; a heading followed immediately by a table; italic text inside a blockquote)
- [ ] `toSlackHtml` never emits an HTML tag or attribute outside the fixed set in the table above,
      even when the input Markdown contains raw inline HTML — verified by a Vitest case that feeds
      `<script>alert(1)</script>` (and a couple of other raw-HTML/attribute-injection attempts) as
      Markdown input and asserts the output contains no `<script`, `onerror=`, `javascript:`, or any
      tag/attribute not in the fixed set
- [ ] The package builds and type-checks standalone (`tsc --noEmit` in `packages/core`) with no
      dependency on any DOM global (no `document`, `window`, or browser-only API) — it must be usable
      from both a browser and a Node test runner
- [ ] A repository-root `LICENSE` file containing the MIT license text exists, and the root
      `package.json` declares `"license": "MIT"` — this unit has no dependencies and is built first,
      so it owns adding the repo-wide license file; `unit-02` and `unit-03` are responsible only for
      surfacing/linking to it from their own UI, not for creating it

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

This unit does NOT include: any UI, any clipboard-write code (that's `unit-02`/`unit-03`, which own
the `ClipboardPayload` construction using this unit's `mrkdwn`/`html` strings as input), any build
tooling for the apps, and any deployment/publishing work.

## Notes

- Do not copy any HTML, CSS, or copy text from the original marktoslack.com site — the table above is
  a reimplementation from a factual specification, not copied code.
- See discovery.md → "Technology Choice: Markdown Parsing Approach" for the full rationale on
  choosing `remark`+`remark-gfm` over hand-rolled regex parsing.

---

## unit-02-web-app.md

---
status: pending
last_updated: ""
depends_on: [unit-01-core-conversion-library]
branch: ai-dlc/md-for-slack/02-web-app
discipline: frontend
pass: ""
workflow: ""
ticket: ""
design_ref: ""
wireframe: mockups/unit-02-web-app-wireframe.html
views: ["/"]
deployment:
  target: static-site
  artifacts: [github-actions-workflow]
  environments: [production]
---

# unit-02-web-app

## Description

The public static website for **MDforSlack** — a single-page, two-pane Markdown→Slack converter,
built in `apps/web` (Vite + TypeScript), consuming `@mdforslack/core` from `unit-01` for all parsing
and formatting logic. This unit owns only the UI shell, live preview rendering, clipboard-write
wiring, visual design (Editorial archetype), accessibility, and its own deployment to GitHub Pages —
it must contain zero Markdown-parsing or Slack-formatting logic of its own.

## Discipline

frontend - This unit will be executed by `do-frontend-development` agents.

## Domain Entities

- `MarkdownDocument` (bound to the input `<textarea>`'s live value)
- `SlackMrkdwnOutput` / `SlackHtmlFragment` (both obtained from `@mdforslack/core`, used to render the
  live preview pane)
- `ClipboardPayload` (constructed here from the two outputs above for the "Copy for Slack" action)
- `WebApp` (this unit's own entity in the intent domain model)

## Data Sources

- `@mdforslack/core`'s `convert(markdown)` (or `parse`/`toMrkdwn`/`toSlackHtml`) — the only source of
  truth for both output strings. This unit must call it on every input change; it must never contain
  its own copy of the conversion table.
- No external APIs, no server, no persisted storage — all state is in-memory React/vanilla-JS
  component state for the current session only.

## Technical Specification

### Layout (see discovery.md → "UI Mockup: Web App Main View" for the full ASCII wireframe and
interaction notes — reproduced in summary here, but treat discovery.md as the canonical reference)

- Header: product name "MDforSlack" + one-line tagline (original wording — do not reuse the original
  site's tagline text).
- Two-pane desktop layout: **Markdown Input** (left, plain `<textarea>`, placeholder text, autofocus)
  and **Slack Preview** (right, read-only, live-updating visual rendering of the Slack-formatted
  result — rendered from `SlackHtmlFragment.html`, sanitized as guaranteed by `unit-01`, not from raw
  mrkdwn text).
- Below the two panes: two buttons, **"Copy for Slack"** and **"Copy mrkdwn"**, plus a small privacy
  note ("Free · No sign-up · Runs locally in your browser" — original wording, not copied from the
  source site).
- Below 768px viewport width: panes stack vertically (input above preview) rather than side-by-side.

### Interactions

- On every keystroke in the input pane (debounced ~150ms), call `@mdforslack/core`'s `convert()` and
  re-render the preview pane from the returned `html`.
- Empty-input state: preview pane shows a placeholder message instead of an empty box.
- Malformed/unterminated input (e.g. an unclosed code fence): render whatever `remark`'s own recovery
  produces — no blocking error UI, since this is a live-typing tool (see unit-01 → Risks).
- **"Copy for Slack"**: on click, build a `ClipboardPayload` and call
  `navigator.clipboard.write([new ClipboardItem({ "text/html": htmlBlob, "text/plain": textBlob })])`;
  show a brief "Copied!" confirmation. If the multi-MIME `ClipboardItem` write is unsupported in the
  user's browser, fall back to a plain-text-only `navigator.clipboard.writeText(mrkdwn)` and show a
  visible notice that only mrkdwn was copied.
- **"Copy mrkdwn"**: on click, `navigator.clipboard.writeText(mrkdwn)`; same brief confirmation
  pattern as above.

### Visual design

Apply the Editorial design tokens from `.ai-dlc/knowledge/design.md` /
`.ai-dlc/md-for-slack/design-blueprint.md` (serif headings via `--font-heading`, generous whitespace
per `--spacing-section`, warm neutral palette via `--color-*` tokens). All copy/wording/branding must
be original — never copied from marktoslack.com.

### Deployment

- Build via Vite (`npm run build` in `apps/web`, producing static `dist/`).
- A GitHub Actions workflow deploys `apps/web/dist` to GitHub Pages on push to the repository's
  default branch. This is the primary "resilience against site closure" mechanism from intent.md —
  the site and its source live in the same forkable repo.
- No custom domain requirement — a `github.io` URL (or the repo's configured Pages URL) is sufficient
  for this intent's success criteria.

## Success Criteria

- [ ] Typing Markdown into the input pane updates the Slack Preview pane live, with no page reload
      and no visible lag for typical release-note-length input (a few hundred words)
- [ ] "Copy for Slack" writes both `text/html` and `text/plain` to the clipboard in one call, and
      pasting into an actual Slack message composer produces real bold text, a real clickable link,
      and a real bulleted list (manual acceptance check — not automatable, see unit-01 → Risks)
- [ ] "Copy mrkdwn" copies only the plain-text mrkdwn string, verified by pasting into a plain-text
      field and confirming it matches `@mdforslack/core`'s `toMrkdwn()` output exactly
- [ ] All primary controls (input textarea, both copy buttons) are reachable and operable via
      keyboard alone (Tab order, Enter/Space activation), have accessible names via `aria-label` or
      associated `<label>`, and the page's body text / button text meet WCAG AA contrast (4.5:1 normal
      text, 3:1 large text) against the Editorial palette's background
- [ ] No `fetch`, `XMLHttpRequest`, or WebSocket call exists anywhere in `apps/web`'s source — grep-
      verifiable, ties to the intent-level "no network calls" criterion
- [ ] The preview pane never executes injected script from user input — reuses `unit-01`'s
      `toSlackHtml` sanitization guarantee and renders its output via a method that does not
      re-interpret it as executable script (e.g. setting sanitized HTML content, never `eval`/
      `new Function` on user input)
- [ ] `npm run build` in `apps/web` succeeds and a GitHub Actions workflow exists that deploys the
      build output to GitHub Pages on push to the default branch
- [ ] The page footer links to (or states) the MIT license, pointing at the repository-root
      `LICENSE` file created in `unit-01` — this unit only surfaces the license, it does not create
      the `LICENSE` file itself

## Risks

- **Clipboard API browser support varies** (multi-MIME `ClipboardItem` write, secure-context
  requirement). Impact: "Copy for Slack" could silently fail on an unsupported/older browser.
  Mitigation: feature-detect before attempting the rich write, and fall back to plain-text copy with
  a visible notice (see Interactions above) rather than failing silently.
- **Live preview must render `SlackHtmlFragment.html`, not raw mrkdwn** — if a builder mistakenly
  renders the mrkdwn string as if it were the final look, the preview will misrepresent what the user
  will get in Slack. Mitigation: this spec explicitly calls out that the preview pane is driven by
  `SlackHtmlFragment.html`, not `SlackMrkdwnOutput.text`.
- **Reusing the original site's exact tagline/copy wording** would risk copyright issues since
  marktoslack.com was a third-party site. Mitigation: all UI copy must be written fresh for
  MDforSlack (this is called out again here because it's an easy mistake to make while working from
  the discovery.md wireframe, which paraphrases rather than dictates exact wording).

## Boundaries

This unit does NOT include: any Markdown-parsing or Slack-formatting logic (owned entirely by
`unit-01`), the Chrome extension UI (`unit-03`, a separate build target with no shared UI code beyond
the imported core module), or Chrome Web Store publishing concerns (not applicable to a website).

## Notes

- See discovery.md → "UI Mockup: Web App Main View" for the full ASCII wireframe with exact pane
  labels and button placement.
- See discovery.md → "Architecture Decision: Static Hosting" for the full GitHub Pages rationale.

---

## unit-03-chrome-extension.md

---
status: pending
last_updated: ""
depends_on: [unit-01-core-conversion-library]
branch: ai-dlc/md-for-slack/03-chrome-extension
discipline: frontend
pass: ""
workflow: ""
ticket: ""
design_ref: ""
wireframe: mockups/unit-03-chrome-extension-wireframe.html
views: ["sidepanel.html"]
deployment:
  target: chrome-web-store
  artifacts: [extension-zip, privacy-policy]
  environments: [production]
---

# unit-03-chrome-extension

## Description

The Chrome (Manifest V3) extension surface for **MDforSlack**, built in `apps/extension` (Vite +
TypeScript), consuming `@mdforslack/core` from `unit-01` for all parsing and formatting logic — the
same shared module `unit-02-web-app` uses. This is the "zero domain dependency" resilience leg of the
intent: once installed, this surface works with no dependency on any hosted URL at all. This unit
owns only the extension's UI shell, manifest, packaging, and Chrome Web Store submission assets — it
must contain zero Markdown-parsing or Slack-formatting logic of its own.

## Discipline

frontend - This unit will be executed by `do-frontend-development` agents.

## Domain Entities

- `MarkdownDocument` (bound to the side panel's input `<textarea>`)
- `SlackMrkdwnOutput` / `SlackHtmlFragment` (obtained from `@mdforslack/core`, rendered in the side
  panel's preview area)
- `ClipboardPayload` (constructed here, identically to `unit-02`, for the "Copy for Slack" action)
- `ExtensionPanel` (this unit's own entity in the intent domain model)

## Data Sources

- `@mdforslack/core`'s `convert(markdown)` — same single source of truth as `unit-02`. This unit must
  never contain its own copy of the conversion table.
- No external APIs, no `host_permissions`, no reading of the current page's content — the extension
  never inspects or accesses any tab's content.

## Technical Specification

### Architecture: side panel over popup (see discovery.md → "Architecture Decision: Chrome Extension
Architecture (Manifest V3)" for the full comparison)

Use `chrome.sidePanel` (MV3, Chrome 114+) as the primary UI surface, not `action.default_popup`. A
popup closes the instant it loses focus — exactly what happens when the user alt-tabs to Slack to
paste, which is the tool's core workflow — so it is unsuitable here. The side panel stays docked open
across tab/window switches.

- `manifest.json` must declare `"side_panel": { "default_path": "sidepanel.html" }` and the
  `"sidePanel"` permission.
- In the extension's initialization code, call
  `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` so clicking the toolbar icon
  opens/closes the panel directly (no separate popup step).
- **Validation checkpoint (per discovery.md's Open Questions):** before committing further UI work to
  the side panel exclusively, build a minimal throwaway prototype to confirm `chrome.sidePanel`
  behaves as expected in the current target Chrome version. If it does not, fall back to
  `action.default_popup` with the same UI content — document which path was taken in this unit's
  Notes when the builder executes this unit.

### Manifest V3 permissions — keep minimal

Only `"action"`, `"sidePanel"`, and `"clipboardWrite"`. No `"host_permissions"`, no `"activeTab"`, no
background service worker (all logic runs inside the side panel document itself). This is deliberate:
fewer permissions means less alarming install-time permission text and a smoother Chrome Web Store
review (see discovery.md → "External Research: Chrome Web Store Publishing Requirements").

### UI (see discovery.md → "UI Mockup: Extension Side Panel View" for the full ASCII wireframe)

- Single stacked column (not the web app's side-by-side panes) — the side panel is narrow, so input
  above / preview below fits the available width better.
- Header: "MDforSlack".
- **Markdown Input** box, then **Slack Preview** box (read-only, rendered from `SlackHtmlFragment.html`,
  same rendering approach as `unit-02` — live-updating on keystroke, same debounce).
- **"Copy for Slack"** and **"Copy mrkdwn"** buttons, stacked vertically.
- Footer note ("Runs locally · no data sent" — original wording) reinforcing the no-network-calls
  privacy claim inside the extension surface too.
- Interaction/data-mapping behavior (debounce, copy semantics, clipboard fallback, empty/malformed
  input handling) is identical to `unit-02-web-app`'s Interactions section — do not re-derive it
  independently; both surfaces must behave the same way because they share the same core module and
  the same intent-level success criteria.

### Sharing UI between web and extension — what is NOT shared

The extension cannot load the live website URL inside its side panel (MV3's default CSP disallows
remote-hosted scripts in extension pages, and doing so would reintroduce a network dependency,
undermining the "runs entirely in your browser" claim). `apps/web` and `apps/extension` are therefore
separate Vite build targets, each importing `@mdforslack/core` and bundling its own small UI shell —
logic is shared via the npm workspace package, never by one app loading the other.

### Build tooling

Evaluate `@crxjs/vite-plugin` first for MV3 manifest/asset handling; if its current Vite-version
compatibility doesn't hold up at build time, fall back to a manual multi-entry Vite config plus
`vite-plugin-static-copy` for `manifest.json` and icons (see discovery.md → "Technology Choice: Build
Tooling").

### Chrome Web Store submission assets (deliverables of this unit, not just code)

- Extension name/description text (original wording — "MDforSlack", not the original site's name).
- Icon set at the required sizes (commonly 16/48/128px).
- At least one screenshot of the side panel in use.
- A short promotional description.
- A privacy policy document/page stating plainly that the extension collects no user data and
  performs all conversion locally in the browser — this is a required Chrome Web Store disclosure
  even for a zero-network-calls extension, and it directly substantiates this product's own privacy
  claim rather than conflicting with it.

## Success Criteria

- [ ] The extension loads as an unpacked MV3 extension in Chrome with no manifest errors, and
      clicking the toolbar icon opens the side panel (or the documented popup fallback, if the
      side-panel prototype check required that fallback)
- [ ] Typing Markdown into the panel's input box updates its Slack Preview live, using the same
      `@mdforslack/core` output as `unit-02-web-app` produces for the same input (verified by feeding
      the same sample Markdown into both surfaces and comparing output byte-for-byte)
- [ ] "Copy for Slack" writes both `text/html` and `text/plain` to the clipboard from within the
      extension context, and pasting into an actual Slack message composer produces real bold text,
      a real clickable link, and a real bulleted list (manual acceptance check, per unit-01 → Risks)
- [ ] "Copy mrkdwn" copies only the plain-text mrkdwn string
- [ ] `manifest.json` declares only `"action"`, `"sidePanel"`, and `"clipboardWrite"` — no
      `"host_permissions"`, no `"activeTab"`, no background service worker
- [ ] No `fetch`, `XMLHttpRequest`, or WebSocket call exists anywhere in `apps/extension`'s source,
      and no `host_permissions` are declared — ties to the intent-level "no network calls" criterion
- [ ] A privacy policy document exists and plainly states no user data is collected, all conversion
      is local — ready to link from the Chrome Web Store listing
- [ ] `npm run build` in `apps/extension` succeeds and produces a loadable unpacked extension
      directory / installable zip
- [ ] The extension's about/options surface (or the Chrome Web Store listing description) states the
      MIT license and points at the repository-root `LICENSE` file created in `unit-01` — this unit
      only surfaces the license, it does not create the `LICENSE` file itself

## Risks

- **`chrome.sidePanel` API friction** (Chrome-version gating below 114, or programmatic-open
  constraints tied to user gestures) is an open question from discovery, not a settled fact.
  Mitigation: the throwaway prototype checkpoint above must run before the full side-panel UI is
  built out; fall back to `action.default_popup` with the same content if it fails.
- **`@crxjs/vite-plugin` maintenance/compatibility risk** — third-party Vite plugin support can lapse
  between major Vite versions. Mitigation: verify compatibility at build time; the manual multi-entry
  Vite config is a documented fallback, not a last resort improvised under time pressure.
- **Chrome Web Store review friction from over-broad permissions.** Mitigation: the minimal permission
  set specified above (`action`, `sidePanel`, `clipboardWrite` only) is a deliberate constraint, not
  a starting point to expand from — do not add `host_permissions` or `activeTab` "just in case."
- **Exact developer registration fee and review turnaround time are unverified** (see discovery.md).
  Mitigation: confirm both against the official Chrome Web Store developer documentation immediately
  before executing the actual store submission step, rather than assuming a remembered figure.

## Boundaries

This unit does NOT include: any Markdown-parsing or Slack-formatting logic (owned entirely by
`unit-01`), the public website (`unit-02`, a separate build target sharing only the core package), or
loading the website inside the extension (explicitly rejected above — MV3 CSP + privacy claim).

## Notes

- See discovery.md → "UI Mockup: Extension Side Panel View" for the full ASCII wireframe.
- See discovery.md → "External Research: Chrome Web Store Publishing Requirements" for the complete
  publishing-requirements research, including which figures were deliberately left unverified.

---

# Discovery Context

---
intent: md-for-slack
created: 2026-09-24T02:19:22Z
status: active
---

# Discovery Log: MDforSlack — Markdown to Slack Converter

Elaboration findings persisted during Phase 2.5 domain discovery.
Builders: read section headers for an overview, then dive into specific sections as needed.


## Architecture Decision: Monorepo Shape

**Decision:** npm-workspaces monorepo with three packages — one shared conversion library consumed by two thin UI shells.

```
mark_to_slack/
├── package.json                # workspace root ("workspaces": ["packages/*", "apps/*"])
├── tsconfig.base.json
├── packages/
│   └── core/                   # @mdforslack/core — shared conversion library (framework-agnostic TS)
│       ├── src/
│       │   ├── index.ts
│       │   ├── parse.ts        # markdown -> mdast (remark + remark-gfm)
│       │   ├── toMrkdwn.ts     # mdast -> plain Slack mrkdwn string
│       │   ├── toSlackHtml.ts  # mdast -> Slack-paste-compatible HTML fragment
│       │   └── types.ts
│       ├── package.json
│       └── vitest.config.ts
└── apps/
    ├── web/                     # static site (Vite + TS)
    │   ├── index.html
    │   ├── src/
    │   └── package.json        # depends on "@mdforslack/core": "workspace:*"
    └── extension/               # Chrome MV3 extension
        ├── manifest.json
        ├── src/ (popup or sidepanel UI)
        └── package.json        # depends on "@mdforslack/core": "workspace:*"
```

**Package manager:** npm workspaces (built into Node, zero extra tool install) rather than pnpm/turborepo —
this is a 3-package repo, not a large system; heavier workspace tooling would add setup/maintenance
cost without a matching benefit at this scale. pnpm remains a reasonable alternative if the user already
standardizes on it elsewhere, but npm is the pragmatic default here.

**UI code sharing:** only `packages/core` (the conversion logic) is shared as a proper package. The two
UI shells (`apps/web`, `apps/extension`) are each a small Vite build target that imports
`@mdforslack/core` directly — this is where DRY actually matters (conversion correctness is the product's
core value and the most error-prone code). The UI markup itself (two textareas + two buttons) is trivial
and cheap to duplicate; introducing a `packages/ui` design-system package now would be premature
abstraction (YAGNI) for a two-screen tool. Revisit only if UI complexity grows materially.

**Resilience rationale:** this structure directly serves the "don't depend on one company/site again" goal
— source, web build, and extension build all live in one forkable OSS repo; no UI logic exists only inside
a proprietary, closed-source deployment.

## Technology Choice: Markdown Parsing Approach

**Decision:** Use an AST-based parser — `remark` + `remark-gfm` (mdast) — and write two small custom
tree-visitors over the one parsed AST: one emitting the plain Slack mrkdwn string, one emitting a
Slack-paste-compatible HTML fragment. Do **not** hand-roll a regex-based converter.

**Why AST over regex:** the product's entire value proposition is "gets Slack formatting right when you
paste it" — correctness on edge cases (nested emphasis, links inside list items, code fences containing
markdown-looking characters, escaped literals) is exactly where line-based regex substitution breaks down.
An AST library has already solved tokenizing these cases correctly; reinventing that in regex duplicates
solved work and is the highest-risk place to introduce subtle bugs.

**Why remark/mdast specifically:** `remark-gfm` maps almost 1:1 onto every row the extracted spec table
requires — strikethrough, tables, and task lists are GitHub-Flavored-Markdown extensions (not part of
core CommonMark), and `remark-gfm` is the standard way to get all three in one AST pass alongside
headings, emphasis/strong, links, images, lists, blockquotes, and code (inline + fenced), which are core
CommonMark and supported by remark natively. This means the AST vocabulary needed for every documented
conversion rule is fully covered by "remark + remark-gfm," with no additional plugins.

**Alternative considered — `markdown-it`:** a mature, widely-used, token-stream-based parser (not a tree
like mdast, but a flat token array with open/close nesting) with a `Renderer` class designed to be
subclassed for custom output targets. Smaller dependency footprint than the unified/remark ecosystem.
This is a legitimate fallback if bundle size becomes a real constraint during the build unit — flag it as
the alternative to switch to if `remark`+`remark-gfm`+`unified` prove too heavy for the extension's
bundle-size expectations, but it is not the starting recommendation because mdast's typed node
vocabulary is a better fit for two custom renderers on one client-side tool.

**Alternative considered — `marked`:** simpler/faster, has a callback-style custom `Renderer`, smaller
plugin ecosystem than markdown-it. Viable but offers no advantage over markdown-it for this use case.

**Rejected — hand-rolled regex converter:** likely close to what the original marktoslack.com did, given
it was a small single-purpose tool, but regex substitution is exactly the wrong tool for a task whose
value is "correctness across composition and edge cases," per the AST-vs-regex rationale above.

**Known edge case to carry into the unit spec:** Slack's own bullet-nesting convention (•, then ◦, then
▪ per the extracted spec) requires tracking list-nesting depth while walking the AST — this must be an
explicit test case, not an incidental behavior.

**Type safety:** TypeScript's discriminated-union support over mdast's `Node['type']` field lets a
`switch` over node kinds be checked exhaustively at compile time (e.g. via a `never` fallthrough case),
which will catch "forgot to render table cells" style omissions before runtime — this is the single
highest-value use of TypeScript in this codebase.

## External Research: Clipboard Write Mechanism

**API:** the Async Clipboard API's `navigator.clipboard.write(items: ClipboardItem[])`, writing a single
`ClipboardItem` that carries two MIME representations at once:

```js
const html = new Blob([htmlString], { type: "text/html" });
const text = new Blob([plainString], { type: "text/plain" }); // the mrkdwn string, not raw markdown
await navigator.clipboard.write([new ClipboardItem({ "text/html": html, "text/plain": text })]);
```

**Why this satisfies both required output modes in one implementation path for "Copy for Slack":** a
paste target that accepts rich text (Slack's contenteditable message composer) reads the `text/html`
representation and renders native formatting with no leftover syntax; a plain-text-only paste target
falls back to `text/plain`, which should itself already be the Slack mrkdwn string (not raw HTML or raw
markdown) so the fallback still looks reasonable. The separate "copy mrkdwn" button is simpler: it only
ever needs to write `text/plain` (the mrkdwn string) via the same API (or a plainer fallback path — see
below), for pasting into `chat.postMessage`/Block Kit/webhooks/bots/Workflow Builder inputs, none of
which interpret HTML.

**Platform requirements/caveats (stable browser-platform behavior, not version-specific numbers):**
- **Secure context (HTTPS) required.** `navigator.clipboard.write` does not work on plain HTTP (localhost
  is exempted for development). GitHub Pages serves HTTPS by default, so the recommended hosting choice
  (see Architecture Decision: Static Hosting) satisfies this automatically for the web app.
- **User-gesture requirement.** The write should happen synchronously inside a user-gesture handler (a
  button's `click` listener) — deferring it behind an unrelated `async`/`setTimeout` chain risks the
  browser rejecting or silently no-op'ing the write in some implementations.
- **Feature detection + fallback.** `ClipboardItem` and multi-MIME writes should be feature-detected
  (`window.ClipboardItem && navigator.clipboard?.write`) with a `document.execCommand('copy')` (or manual
  "select all, Ctrl+C") fallback, particularly for the plain-mrkdwn button, since a plain-text-only copy
  has broader legacy-browser fallback options than the rich-HTML write.

**Web page vs. Chrome MV3 extension context — key difference:**
- **Plain web page:** no manifest/permission entry needed; the browser may show a one-time permission
  prompt for clipboard-write in some browsers, but Chrome generally auto-grants a clipboard-write call
  that is directly triggered by a user gesture, without a prompt.
- **MV3 extension:** if the write happens inside the extension's own popup or side-panel page (an
  ordinary DOM document with its own user-gesture context), it behaves like a regular web page write.
  Declaring `"permissions": ["clipboardWrite"]` in `manifest.json` is the traditionally documented,
  safest choice to guarantee the capability and signal intent during store review, even though current
  Chrome may not strictly require it for a same-page, gesture-triggered write. A write attempted from a
  background service worker (no DOM, no user gesture) would **not** work reliably — this is a concrete
  reason the copy-button click handler must live in the popup/side-panel UI itself, never proxied through
  the background script.

**Flag for build-time verification (do not treat the above browser-version specifics as final):** re-check
the current MDN Clipboard API page and the current Chrome extension permissions documentation at
implementation time, since clipboard permission behavior has changed across Chrome versions historically
and should be confirmed against official docs rather than this discovery note before shipping.

## Architecture Decision: Chrome Extension Architecture (Manifest V3)

**Popup vs. Side Panel:**
- **Popup (`action.default_popup`):** a small transient overlay anchored to the toolbar icon that closes
  as soon as it loses focus — including when the user alt-tabs/clicks into the very Slack window they
  intend to paste into. This is a direct conflict with this tool's core workflow (compose → switch to
  Slack → paste), making a popup's auto-close-on-blur behavior a real UX risk here, not a cosmetic one.
- **Side panel (`chrome.sidePanel`, MV3-only, Chrome 114+):** stays docked open beside page content while
  the user switches tabs and interacts with other windows, which matches the actual usage pattern (keep
  the converter open, alt-tab to Slack, paste, come back) far better than a popup. Also offers more
  vertical space for a two-pane markdown-in/preview-out layout. Requires the `"sidePanel"` permission and
  a `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` (or `setOptions`) call.

**Recommendation:** side panel as the primary UI surface, given the interaction pattern above. Keep a
plain popup as a documented fallback design if a build-time prototype reveals side-panel API friction
(Chrome-version gating below 114, or programmatic-open constraints tied to user gestures) — this is
explicitly a "validate with a quick prototype" decision point, not a settled fact.

**Sharing UI between web and extension:** the extension cannot load the live website URL inside its
popup/panel — MV3's default CSP disallows remote-hosted scripts in extension pages, and doing so would
also reintroduce a network dependency, undermining the "runs entirely in your browser, nothing uploaded"
claim this product must preserve. Instead, both `apps/web` and `apps/extension` are separate Vite build
targets that each import the same `@mdforslack/core` package (see Architecture Decision: Monorepo Shape)
and bundle their own small UI shell locally — logic is shared via the package, not via loading one app
inside the other.

**Manifest V3 permissions — keep minimal:** `"action"` and (if side panel is used) `"sidePanel"`; likely
`"clipboardWrite"` per the Clipboard API note above. No `"host_permissions"` and no `"activeTab"` are
needed since the tool never reads the current page's content. No background service worker is required
if all logic runs inside the popup/side-panel document itself. Minimal permissions matter concretely here:
fewer permissions means less scary install-time permission text for users and a smoother Chrome Web Store
review (see External Research: Chrome Web Store Publishing Requirements).

## Architecture Decision: Static Hosting

**Decision:** GitHub Pages as the primary hosting target for `apps/web`, deployed via a GitHub Actions
workflow that builds on push to the main branch and publishes `apps/web/dist`.

**Why GitHub Pages over Cloudflare Pages / Netlify / Vercel:** the explicit product goal (approved by the
user) is resilience against a repeat of the marktoslack.com shutdown — a single company/site disappearing
and taking the tool with it. GitHub Pages hosts directly from the same OSS repository that holds the
source: the site and its source live in one forkable place, so if the canonical URL ever needs to move,
anyone can fork the repo and get Pages serving a working mirror with no separate hosting account or
billing relationship to set up first. Cloudflare Pages/Netlify/Vercel are all free-tier-viable and
technically capable, but each is a distinct third-party company whose own policy/business changes are the
exact risk category being designed against, and — critically — forking the GitHub repo does not
automatically produce a working deployment on any of them without also separately recreating an account
there. GitHub Pages is the one option where "fork the repo" and "have a working site" are close to the
same action.

**Prerequisite this satisfies:** HTTPS by default (GitHub Pages serves over HTTPS out of the box), which
the Clipboard API's secure-context requirement (see External Research: Clipboard Write Mechanism) needs
regardless of hosting choice.

**Custom domain:** optional; not required for the MVP. If added later, it is an independent DNS-level
choice that doesn't change the underlying resilience rationale (the repo + Pages pairing is what matters).

## Technology Choice: Build Tooling

**Decision:** Vite + TypeScript + Vitest across all three packages, npm as the package manager/workspace
tool, ESLint + `@typescript-eslint` for linting.

- **Vite:** fast dev server and production build with native TypeScript and ESM support; minimal config
  for a small app. Both `apps/web` and `apps/extension` can be separate Vite build targets. For the
  extension's multi-page needs (popup or side-panel HTML, optional background worker), either:
  - evaluate the community `@crxjs/vite-plugin` first — it automates MV3 manifest handling and asset
    copying and supports HMR during extension development, removing a fair amount of MV3-specific Vite
    boilerplate; **flag:** verify its current maintenance status and Vite-version compatibility at
    build time, since third-party plugin maintenance can lapse between major Vite versions; or
  - fall back to a manual multi-entry Vite config (`build.rollupOptions.input` listing each HTML entry)
    plus `vite-plugin-static-copy` to place `manifest.json` and icons into the build output, if the
    plugin route doesn't fit cleanly.
- **TypeScript:** highest-value where the conversion module walks the mdast AST — a `switch` over a
  discriminated union of node types can be checked exhaustively at compile time (see Technology Choice:
  Markdown Parsing Approach).
- **Vitest:** shares Vite's config/transform pipeline, Jest-compatible API, fast. This is the primary
  quality gate for the project: the ~13-row conversion table is the core product value and is highly
  testable — each row plus a handful of composition/edge cases (nested emphasis, links inside lists,
  nested bullet depth) should become a Vitest unit test in `packages/core`.
- **npm workspaces:** consistent with the "keep it simple" directive from the brief — no extra global
  tool install beyond Node.js itself (see Architecture Decision: Monorepo Shape for the workspace layout).
- **ESLint + `@typescript-eslint`:** the standard pairing for a small TS project; keep the rule set to
  the recommended presets rather than a large custom configuration, matching the project's small scope.

## External Research: Chrome Web Store Publishing Requirements

High-level facts stable enough to state here; anything numeric/time-sensitive is explicitly flagged
rather than stated as fact, per the brief's instruction not to fabricate possibly-stale specifics.

- **Developer registration:** publishing to the Chrome Web Store requires a one-time developer
  registration tied to a Google account, historically involving a one-time registration fee.
  **Verify the current exact fee against the official Chrome Web Store developer dashboard/docs at
  publish time** — this figure has changed in the past and should not be treated as fixed from this note.
- **Privacy policy is required even for a zero-network-calls tool.** Every listed extension must complete
  the store's Privacy Practices disclosure and, in practice, provide a privacy policy URL — regardless of
  whether the extension collects any data. For MDforSlack this is straightforward to satisfy honestly:
  the disclosure and policy can state plainly that the extension collects no user data and performs all
  conversion locally in the browser, which directly substantiates the product's own privacy claim
  ("nothing is uploaded to a server") rather than conflicting with it.
- **Manifest V3 is mandatory for new submissions** — Manifest V2 has been phased out for new extension
  submissions/support. This confirms the brief's MV3 assumption is a current platform requirement, not
  merely a preference.
- **Listing assets needed as deliverables** (not just code): extension name/description text, an icon
  set (commonly multiple sizes, e.g. 16/48/128px), at least one screenshot, and a short promotional
  description. These should be planned as part of the extension-packaging unit's scope.
- **Review turnaround time varies** and is explicitly **not** stated as a number here — verify current
  review-time guidance in the official Chrome Web Store developer documentation at the time of
  submission.
- **Minimal permissions favor smoother review:** the architecture recommended above (no
  `host_permissions`, no `activeTab`, no background service worker) avoids the additional review
  scrutiny and alarming install-time permission text that broader permissions can trigger.

## Quality Gate Candidates

Greenfield project with no existing tooling yet — these are proposed defaults for a
TypeScript + Vite + Vitest + npm-workspaces project, to be confirmed with the user after discovery.

| Gate | Command | Source |
|---|---|---|
| tests | `npm test` (runs `vitest run` in `packages/core`, and any UI-level tests added later) | root `package.json` script, delegating to workspace packages |
| lint | `npm run lint` (`eslint .`) | root `package.json` script |
| typecheck | `npm run typecheck` (`tsc --noEmit` across workspaces, e.g. via `tsc -b`) | root `package.json` script |
| build | `npm run build` (builds `packages/core`, then `apps/web` and `apps/extension` via Vite) | root `package.json` script |

Recommended `quality_gates:` block:

```yaml
quality_gates:
  - name: tests
    command: npm test
  - name: lint
    command: npm run lint
  - name: typecheck
    command: npm run typecheck
  - name: build
    command: npm run build
```

No `package.json`/`go.mod`/`Cargo.toml`/etc. currently exist in the repository (greenfield) — these
scripts do not exist yet and must be created as part of the initial project-scaffolding unit; this table
documents the target state to scaffold, not tooling already detected on disk.

## Domain Model

### Entities

- **MarkdownDocument**: the raw text a user types or pastes into the input field. Fields: `rawText`.
- **ConversionAst**: the parsed `mdast` tree produced by `remark` + `remark-gfm` from a `MarkdownDocument`.
  Fields: `type: "root"`, `children` (nodes of kinds: `heading`, `paragraph`, `strong`, `emphasis`,
  `delete` (strikethrough), `link`, `image`, `list`, `listItem`, `table`, `tableRow`, `tableCell`,
  `blockquote`, `code` (fenced), `inlineCode`, `thematicBreak`, `text`).
- **ConversionRule**: one row of the extracted Markdown→mrkdwn mapping table (Heading, Bold, Italic,
  Strikethrough, Link, Image, Bullet list, Numbered list, Task list, Blockquote, Inline code, Code
  block, Table, Divider). Fields: `markdownPattern`, `mrkdwnOutput`, `htmlOutput`, `notes`. This is the
  authoritative behavior spec each AST node kind must satisfy; it is documentation/test-fixture data, not
  a runtime object.
- **SlackMrkdwnOutput**: the plain-text Slack mrkdwn string produced by rendering a `ConversionAst`.
  Fields: `text`.
- **SlackHtmlFragment**: the Slack-paste-compatible rich-text HTML string produced by rendering the same
  `ConversionAst` (e.g. `<b>`, `<i>`, `<a href>`, `<ul>/<li>`, `<pre>` — real semantic HTML that Slack's
  contenteditable composer interprets on paste). Fields: `html`.
- **ClipboardPayload**: the dual-MIME-type object written to the OS clipboard on "Copy for Slack." Fields:
  `htmlBlob` (`text/html`, from `SlackHtmlFragment`), `textBlob` (`text/plain`, from `SlackMrkdwnOutput`).
- **CoreConversionModule** (`@mdforslack/core`): exposes `parse(markdown: string): ConversionAst`,
  `toMrkdwn(ast): SlackMrkdwnOutput`, and `toSlackHtml(ast): SlackHtmlFragment` — one parse, two renderers.
- **WebApp** (`apps/web`): the static-site UI shell wrapping `CoreConversionModule` for browser users.
- **ExtensionPanel** (`apps/extension`): the Chrome MV3 popup/side-panel UI shell wrapping the same
  `CoreConversionModule` inside the browser extension context.

### Relationships

- A `MarkdownDocument` is parsed by `CoreConversionModule` into exactly one `ConversionAst`.
- One `ConversionAst` is rendered by `CoreConversionModule` into one `SlackMrkdwnOutput` and one
  `SlackHtmlFragment` — a single parse feeds two renderers, so the two outputs never drift from each
  other's interpretation of the source.
- Each node in a `ConversionAst` corresponds to exactly one `ConversionRule` (the node kind determines
  which spec row governs its rendering in both renderers).
- A `ClipboardPayload` wraps one `SlackHtmlFragment` + one `SlackMrkdwnOutput` together, for the "Copy for
  Slack" action only.
- The "copy mrkdwn" action uses a `SlackMrkdwnOutput` alone (no `ClipboardPayload`/HTML involved).
- `WebApp` and `ExtensionPanel` each depend on `CoreConversionModule` directly; they have no dependency
  on each other.

### Data Sources

- **Extracted conversion table** (from the saved MHTML's own on-page cheat sheet) — type: static
  functional-spec reference, not a live API.
  - Available: a definitive mapping for all 13 documented element types (heading, bold, italic,
    strikethrough, link, image, bullet/numbered/task list, blockquote, inline code, code block, table,
    divider).
  - Missing: exhaustive edge-case behavior — the table documents intended per-element happy-path
    behavior, not composition (e.g. bold containing italic) or malformed input (an unterminated code
    fence).
  - Real sample: see the "Conversion table" reproduced in the brief at
    `.ai-dlc/md-for-slack/.briefs/elaborate-discover.md` — e.g. `**bold**` → `*bold*`;
    `[label](url)` → `<url|label>`; `- item` → `• item` (◦/▪ when nested).
- **mdast + remark-gfm node taxonomy** — type: versioned open-source library API/spec (stable, documented).
  - Available: canonical AST node shapes for every construct the table needs; GFM extensions
    (strikethrough, tables, task lists) are exactly the non-CommonMark rows in the table, and
    `remark-gfm` covers all three in one plugin.
  - Missing: nothing for the documented feature set — the chosen library combination already covers
    every row in the extracted table with no additional plugins needed.

### Data Gaps

- **Gap:** the extracted spec table does not define behavior for nested/combined formatting (e.g.
  `**bold _and italic_**`) or malformed input (unterminated code fences, unmatched brackets).
  **Resolution:** defer to `remark`/`remark-gfm`'s own deterministic CommonMark+GFM parsing behavior for
  anything the extracted table doesn't explicitly cover, rather than inventing bespoke rules; the unit
  test suite should include a handful of these composition cases as regression tests, treating the
  library's natural output as the source of truth.
- **Gap:** Slack's own rich-text-paste HTML acceptance (which tags/attributes its contenteditable
  composer's sanitizer accepts) is undocumented publicly by Slack and cannot be verified against any
  spec, table, or library. **Resolution:** this must be a manual, human-verified acceptance step during
  the build unit — paste real generated HTML into an actual Slack client (web or desktop) and confirm it
  renders as intended — flagged explicitly as not coverable by unit tests alone.

## UI Mockup: Web App Main View

**Source:** collaborative (no existing designs — greenfield UI decided during discovery)

### Layout
```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ MDforSlack — paste-ready Slack formatting, 100% in your browser                                 │
├────────────────────────────────────────────────┬────────────────────────────────────────────────┤
│ Markdown Input                                 │ Slack Preview                                  │
├────────────────────────────────────────────────┼────────────────────────────────────────────────┤
│ # Release Notes                                │ *Release Notes*                                │
│                                                │                                                │
│ - **Fixed** login bug                          │ • *Fixed* login bug                            │
│ - _Improved_ load time                         │ • _Improved_ load time                         │
│                                                │                                                │
│ See [changelog](https://x.io/log)              │ See <https://x.io/log|changelog>               │
│                                                │                                                │
│ (cursor here, typing...)                       │ (updates live as you type)                     │
├────────────────────────────────────────────────┴────────────────────────────────────────────────┤
│ [ Copy for Slack ]   [ Copy mrkdwn ]                           Free · No sign-up · Runs locally │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Interactions
- Markdown Input (left pane): plain `<textarea>`; on every keystroke (debounced), re-runs `CoreConversionModule.parse` + both renderers.
- Slack Preview (right pane): read-only, live-updating rendering of the current `SlackMrkdwnOutput`/`SlackHtmlFragment` — shown as styled text so the user can visually confirm formatting before copying, not as raw mrkdwn syntax.
- [ Copy for Slack ]: on click, writes a `ClipboardPayload` (text/html + text/plain) via `navigator.clipboard.write`; shows a brief "Copied!" confirmation state. Falls back to a plain-text-only copy path with a visible notice if `ClipboardItem`/multi-MIME write is unsupported.
- [ Copy mrkdwn ]: on click, writes only the `SlackMrkdwnOutput` plain text; shows the same brief confirmation pattern.
- Empty input state: preview pane shows a light placeholder (e.g. "Your Slack-ready preview will appear here") rather than an empty box.
- Error/edge state: unterminated code fences or malformed input still render best-effort output per remark's own recovery behavior (see Domain Model — Data Gaps); no blocking error state, since this is a live-typing tool.

### Data Mapping
- Markdown Input pane ← `MarkdownDocument.rawText`
- Slack Preview pane ← `SlackMrkdwnOutput.text` (rendered visually) / `SlackHtmlFragment.html` (what the pane actually visually renders, since it should look like the Slack-formatted result, not the raw mrkdwn string)
- [ Copy for Slack ] ← `ClipboardPayload` (both `SlackHtmlFragment` and `SlackMrkdwnOutput`)
- [ Copy mrkdwn ] ← `SlackMrkdwnOutput.text` only

## UI Mockup: Extension Side Panel View

**Source:** collaborative (no existing designs — greenfield UI decided during discovery)

### Layout
```
┌──────────────────────────────────────────────┐
│ MDforSlack                                   │
├──────────────────────────────────────────────┤
│ Markdown Input                               │
│ ┌──────────────────────────────────────────┐ │
│ │ # Release Notes                          │ │
│ │                                          │ │
│ │ - **Fixed** login bug                    │ │
│ │ - _Improved_ load                        │ │
│ │   time                                   │ │
│ └──────────────────────────────────────────┘ │
├──────────────────────────────────────────────┤
│ Slack Preview                                │
│ ┌──────────────────────────────────────────┐ │
│ │ *Release Notes*                          │ │
│ │                                          │ │
│ │ • *Fixed* login bug                      │ │
│ │ • _Improved_ load                        │ │
│ │   time                                   │ │
│ └──────────────────────────────────────────┘ │
├──────────────────────────────────────────────┤
│ [ Copy for Slack ]                           │
│ [ Copy mrkdwn ]                              │
├──────────────────────────────────────────────┤
│ Runs locally · no data sent                  │
└──────────────────────────────────────────────┘
```

### Interactions
- Stacked single-column layout (input above, preview below) rather than the web app's side-by-side
  panes — the side panel is narrow (docked beside browser content), so vertical stacking fits the
  available width better than a two-column layout would.
- Same live-update-on-keystroke and copy-button behavior as the web app (see UI Mockup: Web App
  Main View) — both surfaces share `CoreConversionModule`, so the underlying conversion behavior is
  identical; only the layout differs to fit the panel's dimensions.
- Clicking the extension's toolbar icon opens/closes this side panel
  (`chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`); unlike a popup, it stays
  open while the user switches tabs/windows to paste into Slack (see Architecture Decision: Chrome
  Extension Architecture).
- Footer note ("Runs locally · no data sent") reinforces the no-network-calls privacy claim inside
  the extension surface as well as the web surface.

### Data Mapping
- Markdown Input box ← `MarkdownDocument.rawText`
- Slack Preview box ← `SlackHtmlFragment.html` (rendered visually, same as the web app)
- [ Copy for Slack ] ← `ClipboardPayload`
- [ Copy mrkdwn ] ← `SlackMrkdwnOutput.text`
