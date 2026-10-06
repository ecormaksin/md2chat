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
status: completed
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
  cheat-sheet — see full table in unit-01): definitive mapping for 14 documented Markdown element
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

- [x] コア変換モジュール(`@mdforslack/core`)が仕様表の14要素すべて(見出し・太字・斜体・取り消し線・
      リンク・画像・箇条書き・番号付きリスト・タスクリスト・引用・インラインコード・コードブロック・
      テーブル・区切り線)を、mrkdwn出力・HTML出力の両方で正しく変換する(Vitestで各要素を検証)
- [x] Webアプリで、Markdown入力パネルへの入力がSlack風プレビューパネルにリアルタイムで反映される
- [x] Webアプリの「Copy for Slack」ボタンで、text/html + text/plain(mrkdwn)の両方がクリップボードに
      書き込まれ、Slackメッセージ入力欄への貼り付けで本物の太字・リンク・リスト・コードブロックとして
      反映される
- [x] Webアプリの「copy mrkdwn」ボタンで、mrkdwnプレーンテキストのみがクリップボードにコピーされる
- [x] Chrome拡張機能(Manifest V3、`chrome.sidePanel`)で、Webアプリと同じcoreモジュールを用いた同等の
      入力・プレビュー・コピー機能が動作する
- [x] Chrome Web Storeへの提出物一式(アイコンセット、スクリーンショット、宣伝文、プライバシーポリシー)
      が揃っており、提出可能な状態になっている(実際の審査通過・公開完了は本インテントの完了条件には
      含まない — 審査期間・料金は外部要因のため)
- [x] 変換処理はすべてクライアントサイドで完結し、ネットワークへの送信が一切発生しない(コードレビュー
      で`fetch`/`XMLHttpRequest`/WebSocket呼び出しが存在しないことを確認)
- [x] ユーザー入力のMarkdownをHTMLプレビュー/クリップボードに変換する際、スクリプト実行やDOM XSSが
      発生しない(サニタイズされたAST由来のレンダリングのみを許可し、任意の生HTML挿入を行わない。
      さらにDOM挿入時の多層防御として、消費側でも許可リスト方式のサニタイズを行う)
- [x] Webアプリ・Chrome拡張の両方で、主要操作(入力欄へのフォーカス、コピー操作、タブ切替)がキーボード
      操作のみで完結し、フォームコントロールに適切な`aria-label`/`label`が付与され、主要テキストの
      コントラスト比がWCAG AA(通常文字4.5:1、大きい文字3:1)を満たす
- [x] リポジトリにMITライセンスファイルが含まれ、Webサイト・Chrome拡張の両方からライセンス表記が
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
