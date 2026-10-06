---
workflow: tdd
git:
  change_strategy: trunk
announcements: [changelog]
passes: []
active_pass: ""
iterates_on: ""
created: 2026-09-30
status: completed
epic: ""
quality_gates:
  - name: build
    command: npm run build
  - name: tests
    command: npm test
  - name: lint
    command: npm run lint
  - name: typecheck
    command: npm run typecheck
---

# Copy for Slack で改行・空行を保持する

## Problem
「Copy for Slack」（`text/html` + `text/plain` のリッチコピー）で Slack に貼り付けると、改行・空行がすべて消える。
原因は `@mdforslack/core` の `toSlackHtml()` が改行を生の `\n` で出力していること（ブロック間 `"\n\n"`、ソフト改行・`break` は `"\n"`）。HTML として解釈されると空白に潰れる。
プレビュー（`previewEl.innerHTML = sanitizedHtml`）も同じ HTML を使うため、同様に改行が消えている。

## Solution
HTML 出力の改行表現を `<br>` に切り替える（`<p>` は使わない）。

- 段落内のソフト改行（text ノード値の改行。`\r\n` / `\r` / `\n`）、`break` ノード、fallback 経路（脚注定義など）の改行 → `<br>`
- トップレベルのブロック間 → 空行1つに見える区切り
  - 直前ブロックがインライン系（paragraph / heading / その他フォールバック）→ `<br><br>`
  - 直前ブロックがブロック要素（`ul` / `ol` / `blockquote` / `pre` / `hr`）→ `<br>`
  - 理由: ブロック要素直前の末尾 `<br>` は表示上消費されるため、直前の種類で区切り数を変えないと空行数が非対称になる
- 引用内・リスト項目内の複数ブロックも同じ区切り規則、ソフト改行は `<br>`
- `<pre>` 内（コード・テーブル）は従来どおり `\n`
- 連続空行は Markdown パーサの挙動どおり1つに正規化（追加処理なし）
- mrkdwn（`text/plain`）出力は変更しない（段落内改行・段落間空行・連続空行の正規化は既に要件を満たす。ルーズリスト項目内の複数段落が空白連結される件はスコープ外）
- 許可タグ集合に `br` を追加し、core テスト・web・extension の集合定義5箇所で一致させる
- インラインコードと画像 alt 内の `\n` は空白1つに置換（`<pre>` 外に `\n` を残さない）

## Domain Model

### Entities
- **Markdown 入力**: ユーザーが入力する文字列。remark + remark-gfm で mdast `Root` にパースされる。
- **mdast ノード**: `paragraph` / `heading` / `list` / `listItem` / `blockquote` / `code` / `table` / `thematicBreak` / `html`（ブロック）と `text` / `break` / `emphasis` / `strong` / `delete` / `inlineCode` / `link` / `image` / `html`（インライン）。ソフト改行は `break` ではなく `text.value` 内の `\n`。
- **SlackHtmlFragment.html**: `toSlackHtml()` の出力。許可タグのみで構成される HTML 断片。
- **SlackMrkdwnOutput.text**: `toMrkdwn()` の出力。今回は変更しない（ルーズリスト項目内の複数段落は空白連結されるが、スコープ外）。
- **許可タグ集合**: `b, i, s, del, a, ul, ol, li, blockquote, code, pre, hr`（+ 今回 `br`）。

### Relationships
- `convert()` → `parse()` → `toMrkdwn()` / `toSlackHtml()`（同一 AST を共有）
- apps/web・apps/extension の `renderPreview()` が `html` を DOMPurify（`SANITIZE_ALLOWED_TAGS`）でサニタイズし、プレビューに挿入
- `handleCopyForSlack()` が同じ allowlist で再サニタイズし、`copySlackRichText()` で `text/html` + `text/plain` をクリップボードへ書く

### Data Sources
- **packages/core/src/index.ts**: `toSlackHtml` / `blockToHtml` / `inlineNodeToHtml` / `renderBlockquoteHtml` / `renderListItemHtml`
- **apps/web/src/pipeline.ts**, **apps/extension/src/pipeline.ts**: `SANITIZE_ALLOWED_TAGS`
- **テストで固定された許可タグ集合**: `packages/core/test/html-sanitization.test.ts`、`apps/web/test/xss-defense.test.ts`、`apps/extension/test/xss-defense.test.ts`

### Data Gaps
- Slack がリッチテキスト貼り付け時に `<br>` / `<br><br>` / ブロック要素隣接の `<br>` をどう解釈するかは公式情報で未確認。実 Slack での手動検証で確認する。

## Success Criteria
- [x] `convert("1行目\n2行目").html` が `1行目<br>2行目` になる
- [x] 段落・見出し・リスト・引用・コード・テーブル・hr の全隣接組み合わせで、html のブロック間区切りが Solution の規則（インライン系の後 `<br><br>`、ブロック要素の後 `<br>`）どおりになる
- [x] 3つ以上の連続空行を含む入力でも、html・mrkdwn ともに空行1つとして出力される
- [x] 引用内・リスト項目内の複数段落とソフト改行が `<br>` で保持される
- [x] html の `<pre>…</pre>` の外側に生の `\n` が含まれない
- [x] core・web・extension の許可タグ集合定義（5箇所）に `br` が追加され一致しており、既存 XSS 防御テストが全て通る
- [x] web・extension の `renderPreview().sanitizedHtml` に `<br>` が保持される
- [x] （手動受け入れ検証・実装完了後にユーザーが実施）下記「Manual Verification」の検証用 Markdown を「Copy for Slack」で実 Slack に貼り付け、期待どおりの改行・空行になる。結果は本ファイルの「Manual Verification」に記録する
- [x] `npm run build` / `npm test` / `npm run lint` / `npm run typecheck` が全て通る

## Manual Verification
実装完了後にユーザーが実施する受け入れ検証（自律実行の unit の完了条件には含めない）。

検証用 Markdown:

````markdown
# 見出し
段落1の1行目
段落1の2行目

段落2



段落3（直前に空行3つ）

- 項目1
- 項目2

段落4

> 引用1行目
> 引用2行目

```
code
```

---

段落5
````

合格条件:
- 「段落1の1行目」と「段落1の2行目」が別の行になる（間に空行なし）
- 見出し→段落1、段落1→段落2、段落2→段落3、段落3→リスト、リスト→段落4、段落4→引用、引用→コード、コード→区切り線、区切り線→段落5 の各境界に空行がちょうど1つある
- 引用の2行が別の行になる

結果: 合格（2026-10-04、ユーザーが実 Slack で実施）
- 「段落1の1行目」と「段落1の2行目」が別の行になり、間に空行なし
- 見出し→段落1、段落1→段落2、段落2→段落3（入力の空行3つは1つに正規化）、段落3→リスト、リスト→段落4、段落4→引用、引用→コード、コード→区切り線、区切り線→段落5 の各境界に空行がちょうど1つ
- 引用の2行が別の行になる

## Context
- 前回インテント `md-for-slack` で構築した変換器のバグ修正。
- ユーザー決定事項: 対象は Copy for Slack（HTML）経路、連続空行は1つにまとめる、ソフト改行は改行として保持、Web + 拡張機能の両方、HTML 表現は `<br>` 方式、全ブロック間に空行1つ、引用・リスト内も保持。
- スコープ外（discovery で観察、今回扱わない）: mrkdwn のリスト項目内ソフト改行で継続行インデントが消える件、DOMPurify の `ALLOWED_ATTR` による `<ol start>` 除去の件。
- 詳細調査結果は `discovery.md` を参照。
