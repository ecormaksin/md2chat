---
status: success
error_message: ""
---

# Discovery Results

## Domain Model Summary

### Entities
- **MarkdownDocument**: 入力テキスト — Fields: rawText
- **MdastRoot / BlockNode / PhrasingNode**: remark のパース結果 — ソフト改行は `text.value` 内の `\n`、ハード改行は `break` ノード、段落境界はブロックの兄弟関係
- **SlackMrkdwnOutput**: text/plain 用 — Fields: text（改行・空行を既に保持）
- **SlackHtmlFragment**: text/html 用 — Fields: html（改行・空行が失われている、修正対象）
- **AllowedTagSet**: 許可タグ集合 b,i,s,del,a,ul,ol,li,blockquote,code,pre,hr — 6か所に重複定義
- **ClipboardPayload**: text/html + text/plain（packages/browser-utils）

### Relationships
- MarkdownDocument → parse → MdastRoot → toMrkdwn / toSlackHtml
- SlackHtmlFragment → DOMPurify(AllowedTagSet) → Preview（innerHTML）と ClipboardPayload
- apps/web と apps/extension は pipeline.ts / copy-actions.ts を複製保持（cross-surface-parity テストで一致を保証）

### Data Sources
- **@mdforslack/core convert()**（ライブラリ）:
  - Available: mrkdwn / html の両出力
  - Missing: html における改行・空行の表現
  - Real sample: `convert("line1\nline2")` → html `"line1\nline2"`、`convert("para1\n\npara2")` → html `"para1\n\npara2"`（HTML として描画すると空白に潰れる）

### Data Gaps
- Slack コンポーザーが text/html 貼り付け時に `<p>` / `<br>` をどう解釈するかは公式に未確認 → 実 Slack への手動受け入れテストで表現方式を確定する

## Key Findings

- 原因: `toSlackHtml()` がブロック間を生の `"\n\n"` で連結し、段落を `<p>` で囲まず、`break` も `"\n"` を出力している。HTML では `<pre>` 外の `\n` が空白に畳まれる。
- ソフト改行は `break` ノードではなく text ノード内の `\n` なので、`inlineNodeToHtml` の `text` ケースでも変換が必要（`break` の修正だけでは不足）。
- 引用内・ルーズリスト項目内の段落は HTML で `" "` 連結（block-child-separator.test.ts が固定）。段落区切りを保持するなら期待値と根拠コメントの更新が必要。
- DOMPurify は許可外タグを中身を残して除去する。core に `<br>`/`<p>` を足しても apps の `SANITIZE_ALLOWED_TAGS`（web/extension）を更新しないとプレビュー・クリップボードの両方で効果が出ない。
- 許可タグ集合は core 実装コメント、core の html-sanitization.test.ts、apps/*/src/pipeline.ts、apps/*/test/xss-defense.test.ts の計6か所で同時更新が必要。
- 表現方式の候補: A `<br>` 方式（`br` のみ追加、既存のインライン単独テストへの影響が小さい）/ B `<p>` 方式（`p`,`br` 追加、conversion-table 等の完全一致テストが多数変わる）/ C 併用。
- mrkdwn（text/plain）は既に要件どおり（段落内改行保持、連続空行は1つに正規化）。
- プレビューの `.preview-box` には `white-space` 指定がない。`<p>` 採用時は既定マージンの扱いを検討する。
- 品質ゲート: `npm test` / `npm run lint` / `npm run typecheck` / `npm run build`。CI はデプロイのみでテスト用ワークフローはない。worktree は `node_modules` 未インストール。
- スコープ外の観察: mrkdwn のリスト項目内ソフト改行で継続行のインデントが失われる（`"• x\ny"`）。apps の DOMPurify `ALLOWED_ATTR: ["href"]` により `<ol start>` が除去されるとコードから判断できる（実行検証は未実施）。

## Open Questions

- HTML の改行表現は A（`<br>`）/ B（`<p>`）/ C（併用）のどれにするか。Slack での実際の表示は未確認のため、実 Slack への手動貼り付け検証を完了条件に含めるか。
- 見出し・リスト・引用・コードブロック・テーブル・hr の前後にも空行1つを保持するか（mrkdwn と同じ `\n\n` 相当にするか）。
- 引用内・リスト項目内の複数段落／ソフト改行も改行として保持するか（現状は空白1つに固定するテストがある）。
- プレビューの見た目を Slack 貼り付け結果に合わせる CSS 調整（`<p>` マージン等）を範囲に含めるか。
- mrkdwn のリスト継続行インデント、`<ol start>` 除去はスコープ外としてよいか。

## Mockups Generated

- .ai-dlc/preserve-line-breaks/discovery.md#ui-mockup-プレビュー変更後の期待表示 — 既存プレビューにおける改行・空行保持後の期待表示（新規画面なし）
