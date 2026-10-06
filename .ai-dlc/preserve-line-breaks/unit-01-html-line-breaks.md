---
status: completed
last_updated: "2026-10-01T04:01:17Z"
depends_on: []
branch: ai-dlc/preserve-line-breaks/01-html-line-breaks
discipline: library
pass: ""
workflow: ""
ticket: ""
design_ref: ""
views: []
hat: reviewer
---

# unit-01-html-line-breaks

## Description
`@mdforslack/core` の HTML レンダラ（`toSlackHtml()`）が改行・空行を `<br>` で表現するよう修正し、`br` を core・apps/web・apps/extension の許可タグ集合に追加する。これにより「Copy for Slack」での貼り付けとプレビュー表示で改行・空行が保持される。

## Discipline
library - This unit will be executed by `do-library` specialized agents.

## Domain Entities
- **mdast ノード**: ブロック（paragraph / heading / list / listItem / blockquote / code / table / thematicBreak / html）とインライン（text / break）
- **SlackHtmlFragment.html**: 変更対象の出力
- **許可タグ集合**: `br` を追加

## Data Sources
- `packages/core/src/index.ts`: `toSlackHtml`、`blockToHtml`、`inlineNodeToHtml`（`text` / `break` ケース）、`renderBlockquoteHtml`、`renderListItemHtml`
- `apps/web/src/pipeline.ts`、`apps/extension/src/pipeline.ts`: `SANITIZE_ALLOWED_TAGS`
- テスト: `packages/core/test/html-sanitization.test.ts`、`packages/core/test/block-child-separator.test.ts`、`packages/core/test/conversion-table.test.ts` ほか完全一致テスト、`apps/web/test/xss-defense.test.ts`、`apps/extension/test/xss-defense.test.ts`

## Technical Specification

### 1. インライン改行
- 改行は `\r\n` / `\r` / `\n` のいずれも1つの改行として扱う（正規表現 `/\r\n?|\n/g` 相当）。以下「改行」はこの3種を指す
- `inlineNodeToHtml` の `text` ケース: `escapeHtml(value)` の後に改行を `<br>` へ置換（エスケープ後に置換し、`<br>` 自体がエスケープされないこと）
- `break` ケース: `"<br>"` を返す（既存コメント「No <br> in the fixed allowed tag set」は削除・更新）
- `inlineCode` の値内の改行は空白1つに置換する（CommonMark のコードスパン仕様で行末は空白扱い）
- `image` の alt 内の改行も空白1つに置換する（alt は `text` ケースを通らないため個別に対応）
- fallback 経路（`blockToHtml` / `inlineNodeToHtml` の default ケース。remark-gfm の footnoteDefinition など）の出力でも、改行を `<br>` に置換する

### 2. ブロック間区切り（共通ヘルパーに集約）
トップレベル・引用内・リスト項目内の3箇所で同じ規則を使うため、区切りを決める関数を1つ用意して共有する（DRY）。
- 直前ブロックがインライン系（paragraph / heading / fallback テキスト）→ `<br><br>`
- 直前ブロックがブロック要素（list → `ul`/`ol`、blockquote、code/table → `pre`、thematicBreak → `hr`）→ `<br>`
- 描画結果が空文字列になるブロック（raw `html`、inline html のみの段落など）はすべて除外してから区切りを決める

期待例:
| 入力 | html |
|---|---|
| `a\n\nb` | `a<br><br>b` |
| `a\n\n- x` | `a<br><br><ul><li>x</li></ul>` |
| `- x\n\nb` | `<ul><li>x</li></ul><br>b` |
| `` ```\nc\n```\n\n---`` | `<pre><code>c</code></pre><br><hr>` |
| `> q1\n> q2` | `<blockquote>q1<br>q2</blockquote>` |
| `> p1\n>\n> p2` | `<blockquote>p1<br><br>p2</blockquote>` |

### 3. 引用・リスト項目内
- `renderBlockquoteHtml`: 子ブロックの連結を `" "` から 2. の区切り規則に変更
- `renderListItemHtml`: `textParts` の連結を `" "` から 2. の区切り規則に変更。ネストしたリストの前には区切りを入れない（`ul`/`ol` がブロックとして改行するため）。区切り規則は textParts 間にのみ適用する。既存の `splitListItemChildren` が段落をネストリストより前に寄せる並べ替えは現状維持（スコープ外）

### 4. `<pre>` 内
- `code` と `table` の `<pre><code>` 内は従来どおり `\n` を保持（置換しない）

### 5. 許可タグ集合
- `html-sanitization.test.ts` 冒頭の許可タグ列挙コメントを更新し、`br` の出典として本 intent（`.ai-dlc/preserve-line-breaks/`）への参照を追記する。前 intent の仕様書（`.ai-dlc/md-for-slack/unit-01-core-conversion-library.md`）は変更せず、`src/index.ts` 冒頭の参照コメントに「改行表現は `.ai-dlc/preserve-line-breaks/` で上書き」と追記する
- 以下の集合定義 5 箇所に `br` を追加し、集合を一致させる（core 実装には集合定義はなく、`break` ケースのコメントのみ §1 で更新）:
  - `packages/core/test/html-sanitization.test.ts`
  - `apps/web/src/pipeline.ts` / `apps/extension/src/pipeline.ts` の `SANITIZE_ALLOWED_TAGS`
  - `apps/web/test/xss-defense.test.ts` / `apps/extension/test/xss-defense.test.ts`
- `ALLOWED_ATTR` は変更しない（`br` に属性は不要）

### 6. 変更しないもの
- `toMrkdwn()` とその出力
- `copy-actions.ts`、`browser-utils`（allowlist を `pipeline.ts` から import しているため自動で反映）

## Success Criteria
- [x] `convert("1行目\n2行目").html === "1行目<br>2行目"`
- [x] Technical Specification 2. の期待例の表がすべてテストで検証され、合格する
- [x] 直前ブロックとして paragraph / heading / list / blockquote / code / table / thematicBreak の各種を最低1回、直後ブロックとしても各種を最低1回含むテストで、区切りが規則どおりであることを検証する（49通りの全組み合わせは不要）
- [x] `"a\r\nb"` と `"a\rb"` の html が `a<br>b` になる
- [x] `"a\n\n\n\nb"` の html が `a<br><br>b`、mrkdwn が `a\n\nb` になる
- [x] 引用内・リスト項目内（ルーズリスト）の複数段落が `<br><br>`、ソフト改行が `<br>` で出力される（`block-child-separator.test.ts` を新仕様に更新）
- [x] 全ブロック種・ソフト改行・hard break・inlineCode・画像・脚注定義（`a[^1]\n\n[^1]: foot\n    line2\n\n    para2`）・CRLF 入力を含む検証用ドキュメントについて、html から `<pre>…</pre>` 部分を除いた文字列に `\r` と `\n` が含まれない
- [x] `<pre><code>` 内のコード・テーブルの改行は `\n` のまま保持される
- [x] `` `a\nb` `` の html が `<code>a b</code>`、`![x\ny](http://e)` の html が `<a href="http://e">x y (image)</a>` になる
- [x] 集合定義 5 箇所すべてに `br` が含まれ、core の許可タグ集合と web/extension の `SANITIZE_ALLOWED_TAGS` が一致する
- [x] 既存の XSS 防御テスト（raw HTML 除去、URL スキーム allowlist、mrkdwn エスケープ）がすべて通る。入力中の raw `<br>` タグは従来どおり除去される（raw HTML パススルーにならない）
- [x] web・extension の `renderPreview("a\nb").sanitizedHtml` に `<br>` が残る
- [x] web・extension の `handleCopyForSlack()` が `copySlackRichText` に渡す html（再サニタイズ後）に `<br>` が残る（`copySlackRichText` をモックして検証）
- [x] mrkdwn 出力の既存テストが無変更で通る
- [x] `npm test` / `npm run lint` / `npm run typecheck` / `npm run build` が全て通る

## Risks
- **Slack の `<br>` 解釈が想定と異なる**: 貼り付け後の空行数がずれる可能性。Mitigation: 実装後に intent レベルの手動受け入れ検証（ユーザーが実施）で確認する。ずれた場合、実装の修正はヘルパー1箇所で済むが、期待例の表・隣接テスト・intent の基準も併せて更新が必要（`/ai-dlc:refine` または followup で対応）。
- **許可タグ追加による XSS 面の拡大**: `br` は属性なし・内容なしの空要素で、`ALLOWED_ATTR` も `href` のみのため影響は小さい。Mitigation: 既存 XSS テストを全て通し、raw `<br onerror=...>` が除去されることをテストで確認する。
- **完全一致テストの大量変更**: 既存期待値の書き換えで意図しない仕様変更を紛れ込ませる恐れ。Mitigation: 変更は改行表現に関する期待値のみとし、reviewer が差分を確認する。
- **性能予算**: `\n` 置換の追加は線形処理のみ。Mitigation: 既存の `performance-budget.test.ts` が通ることで確認。

## Boundaries
- mrkdwn 出力の変更はしない（リスト項目内ソフト改行の継続行インデント消失、ルーズリスト項目内の複数段落が `• p1 p2` と空白連結される件は対象外）
- 実 Slack での手動受け入れ検証は本 unit の完了条件に含めない（intent レベルでユーザーが実施）
- `<ol start>` が DOMPurify で除去される件は対象外
- プレビュー用 CSS の調整はしない
- `<p>` タグは導入しない

## Notes
- 隣接テストで list→list を作る場合、同種リストは空行を挟んでも1つのリストに統合されるため、`- x\n\n1. y` のように種類を変えること。
- ソフト改行は mdast 上 `break` ではなく `text.value` 内の `\n` である点に注意（`break` ケースだけ直しても不十分）。
- apps は core を `dist/` 経由で参照する（vitest に alias なし）。apps のテスト前に必ず core をビルドすること。worktree では最初に `npm ci` が必要。品質ゲートは build → tests の順で実行される。
- 詳細は `.ai-dlc/preserve-line-breaks/discovery.md` を参照。
