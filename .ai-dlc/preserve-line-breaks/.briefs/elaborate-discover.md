---
intent_slug: preserve-line-breaks
worktree_path: <repo-root>/.ai-dlc/worktrees/preserve-line-breaks
project_maturity: established
provider_config: {"spec":null,"ticketing":null,"design":null,"comms":null,"vcsHosting":"github","ciCd":"github-actions"}
---

# Intent Description

Markdown を Slack 投稿用に変換したとき、改行・空行が消えてしまう。改行・空行を保持した状態で変換するよう修正する。

## Clarification Answers

- Q: 改行・空行が消えるのはどの操作で Slack に貼り付けたときか？ → A: **Copy for Slack**（text/html + text/plain のリッチコピー）
- Q: 連続した空行（例：空行3つ）の扱いは？ → A: **1つにまとめる**（Markdown 仕様どおり、段落区切りとして空行1つ）
- Q: 段落内の単一改行（ソフト改行）の扱いは？ → A: **改行として保持**（入力の改行位置でそのまま改行する）
- Q: 修正範囲は？ → A: **Web + 拡張機能**（packages/core を修正し apps/web と apps/extension の両方に反映）

## Preliminary Findings (from orchestrator)

- packages/core/src/index.ts の toSlackHtml() はブロック間を生の "\n\n" で連結し、段落を <p> で囲まず、break ノードも "\n" に落としている（コメント: "No <br> in the fixed allowed tag set"）。HTML として描画・貼り付けされると空白として潰れ、改行・空行がすべて消える。
- toMrkdwn() は段落内改行・段落間空行1つを保持している（連続空行は1つに正規化）。
- apps/web/src/pipeline.ts と apps/extension/src/pipeline.ts に DOMPurify の SANITIZE_ALLOWED_TAGS（b,i,s,del,a,ul,ol,li,blockquote,code,pre,hr）があり、core の許可タグ集合と同一である必要がある（二重防御）。<br>/<p> を追加するならここも更新が必要。
- apps/*/src/copy-actions.ts が同じ allowlist で再サニタイズしてから copySlackRichText に渡す。
- プレビューは previewEl.innerHTML = sanitizedHtml（.preview-box には pre 以外 white-space 指定なし）。

## Discovery Focus

- core の HTML レンダラで段落・見出し・リスト・引用・コード・テーブル・hr の各境界がどう出力されるか、Slack 貼り付けで改行/空行として解釈される HTML 表現（<p>、<br> 等）は何か。Slack のリッチテキスト貼り付けが <p> 間に空行を入れるか否かは公式に確認できないため、確認できない事項は「未確認」と明記すること（推測で断定しない）。
- 既存テスト（packages/core/test/*, apps/*/test/xss-defense.test.ts, cross-surface-parity.test.ts 等）のうち、許可タグ集合や HTML 出力形式を固定していて変更の影響を受けるもの。
- 品質ゲート候補（npm test / lint / typecheck / build）。

## Discovery File Path

<repo-root>/.ai-dlc/worktrees/preserve-line-breaks/.ai-dlc/preserve-line-breaks/discovery.md
