---
intent: preserve-line-breaks
created: 2026-09-30
status: active
---

# Discovery Log: Copy for Slack で改行・空行を保持する

Elaboration findings persisted during Phase 2.5 domain discovery.
Builders: read section headers for an overview, then dive into specific sections as needed.


## Codebase Context

**Stack:** TypeScript 5.5 / npm workspaces（`package-lock.json`）/ Vite（apps）/ Vitest 2（全 workspace）/ ESLint 9 + typescript-eslint。変換は remark 15 + remark-gfm 4（mdast）、サニタイズは DOMPurify、表の桁揃えは string-width。
**Architecture:** monorepo。`packages/core`（DOM 非依存の変換ライブラリ `@mdforslack/core`）→ `packages/browser-utils`（clipboard ヘルパー）→ `apps/web`（GitHub Pages）/ `apps/extension`（Chrome MV3 side panel）。apps 間は import せず、`pipeline.ts` / `copy-actions.ts` をファイル単位で複製する方針（unit-03 の "Sharing UI between web and extension"）。
**Conventions:** core は `toMrkdwn` / `toSlackHtml` の2レンダラが同じ mdast を走査する対構造（`blockToX` / `inlineNodeToX` / `renderListX` / `renderBlockquoteX`）。テストは `packages/*/test/*.test.ts`、`apps/*/test/*.test.ts`。仕様の出典はコメントで `.ai-dlc/md-for-slack/unit-0X-*.md` を参照。
**Concerns:** 許可タグ集合（b,i,s,del,a,ul,ol,li,blockquote,code,pre,hr）が「core 実装」「core テスト」「apps の SANITIZE_ALLOWED_TAGS ×2」「apps の xss-defense テスト ×2」の計6か所に重複定義されている（DRY 違反だが二重防御のため意図的に独立）。

## Codebase Pattern: toSlackHtml の改行・境界出力（現状）

ソース: `packages/core/src/index.ts`。main ルートのビルド済み `packages/core/dist`（worktree とソース差分なしを確認）で実際に変換して出力を確認した。

| 入力 | mrkdwn（text/plain） | html（text/html） |
|------|------|------|
| `line1\nline2`（ソフト改行） | `"line1\nline2"` | `"line1\nline2"` |
| `line1  \nline2\\\nline3`（ハード改行） | `"line1\nline2\nline3"` | `"line1\nline2\nline3"` |
| `para1\n\npara2` | `"para1\n\npara2"` | `"para1\n\npara2"` |
| `para1\n\n\n\npara2`（連続空行） | `"para1\n\npara2"` | `"para1\n\npara2"` |
| `> p1\n>\n> p2` | `"> p1\n>\n> p2"` | `"<blockquote>p1 p2</blockquote>"` |
| `- p1\n\n  p2\n- x\n  y` | `"• p1 p2\n• x\ny"` | `"<ul><li>p1 p2</li><li>x\ny</li></ul>"` |
| 見出し+段落+リスト+引用+コード+hr 混在 | ブロック間 `\n\n` | `"<b>H</b>\n\ntext\n\n<ul>…</ul>\n\n<blockquote>q1\nq2</blockquote>\n\n<pre><code>c1\n\nc2</code></pre>\n\n<hr>\n\nend"` |

要点:
- **ソフト改行は `break` ノードではなく text ノードの value 内の `\n`**（`parse("a\nb  \nc")` → `text("a\nb")`, `break`, `text("c")`）。つまりソフト改行の保持には `text` の `\n` 変換が必要で、`break` ケースの修正だけでは不足する。
- `toSlackHtml()`（60-65行）はトップレベルのブロックを生の `"\n\n"` で連結。段落は `<p>` で囲まれない（`blockToHtml` "paragraph" → `renderInlineHtml` のみ、401行）。
- `inlineNodeToHtml` の `break` は `"\n"`（305-307行、コメント "No <br> in the fixed allowed tag set"）。
- `renderBlockquoteHtml`（423-429行）は子ブロックを `" "` で連結 → 引用内の段落区切りは空白1つに潰れる（`block-child-separator.test.ts` が意図的に固定）。
- `renderListItemHtml`（444-452行）もリスト項目内の複数段落を `" "` で連結。
- `<pre><code>`（コードブロック・テーブル）は内部の `\n` が pre の性質で保持される。見出しは `<b>`、区切り線は `<hr>`。
- HTML として解釈される（プレビュー `innerHTML`、クリップボード text/html の貼り付け先）と、`<pre>` 外の `\n` は空白として畳まれるため、段落・改行がすべて消える。これが本 intent の原因。
- mrkdwn 側は段落内改行・段落間空行1つを既に保持し、連続空行は remark のパースで自然に1つへ正規化される（要件「連続空行は1つにまとめる」と一致）。

副次的な観察（本 intent のスコープ外候補）:
- mrkdwn のリスト項目内ソフト改行は `"• x\ny"` となり、継続行のインデントが失われる。
- core は `<ol start="10">` を出力するが、apps の DOMPurify は `ALLOWED_ATTR: ["href"]` のため `start` 属性は除去されるとコードから判断できる（実行による検証は未実施）。

## Codebase Pattern: apps 側の二重防御とプレビュー

- `apps/web/src/pipeline.ts` / `apps/extension/src/pipeline.ts`: `SANITIZE_ALLOWED_TAGS`（12タグ）と `SANITIZE_ALLOWED_ATTR = ["href"]`。`renderPreview()` が `convert()` → `DOMPurify.sanitize(html, {ALLOWED_TAGS, ALLOWED_ATTR})`。両ファイルはコメント以外同一。
- `apps/*/src/copy-actions.ts`: `handleCopyForSlack(html, mrkdwn)` が同じ allowlist で再サニタイズ → `copySlackRichText(sanitizedHtml, mrkdwn)`。
- `packages/browser-utils/src/index.ts`: `ClipboardItem({"text/html", "text/plain"})` を書き込み、失敗時は `writeText(mrkdwn)` にフォールバック。text/plain は既に改行を保持した mrkdwn。
- DOMPurify は `ALLOWED_TAGS` にないタグを除去し中身は残す（既定の KEEP_CONTENT）。したがって **core に `<br>` / `<p>` を追加しても apps の allowlist を更新しない限り、プレビューとクリップボードの両方でタグが消え、現状と同じ症状が残る**。
- プレビュー: `previewEl.innerHTML = sanitizedHtml`（web `main.ts` 70行 / extension `main.ts` 75行）。`.preview-box` には `white-space` 指定なし（`pre` のみ `pre-wrap`）。`<p>` を採用する場合、既定の段落マージンでプレビューに空行相当の余白が出る（CSS 調整の要否は設計判断）。

## External Research: Slack リッチテキスト貼り付けにおける改行表現

Web 検索は組織ポリシーにより実施していない。以下は内部知識とリポジトリ内資料に基づく。

- Slack のコンポーザーが text/html 貼り付け時にどのタグをどう解釈するかは **公式ドキュメントで確認できない（未確認）**。前 intent でも同じ結論で、手動受け入れテスト（実 Slack への貼り付け）で担保する方針だった（`.ai-dlc/md-for-slack/unit-01-core-conversion-library.md` Risks、`intent.md` 107行）。
- 一般的なブラウザの contenteditable では `<br>` は改行、`<p>` は段落（ブロック）として扱われる。これは HTML 仕様上の挙動だが、Slack が貼り付け時に独自の変換をかけるかは **未確認**。
- 特に次の点は **未確認** のため、実 Slack での手動検証が必要:
  1. 隣接する `<p>` 同士の間に空行が入るか（単一改行になるか）。
  2. `<br><br>` が空行1つとして保持されるか（連続 `<br>` が畳まれないか）。
  3. `<ul>` / `<blockquote>` / `<pre>` / `<hr>` などブロック要素の直前直後に `<br>` を置いた場合に余分な空行が生じるか。
  4. 空段落 `<p><br></p>` が空行として保持されるか。
- 候補表現（設計判断用、どれも Slack 上の結果は未確認）:
  - **A. `<br>` 方式**: text 内 `\n`・`break` → `<br>`、トップレベルのブロック間 → `<br><br>`（ブロック要素隣接時の扱いは要検討）。許可タグ追加は `br` のみ。インライン単独の既存テスト期待値（`<b>bold</b>` 等）は変わらない。
  - **B. `<p>` 方式**: 段落を `<p>` で囲み、段落内改行は `<br>`。許可タグに `p` と `br` を追加。単一段落の既存テスト期待値（`<b>bold</b>` → `<p><b>bold</b></p>`）が多数変わる。Slack が `<p>` 間に空行を入れない場合は空行が失われる恐れ。
  - **C. 併用**: `<p>` + 空行用の `<p><br></p>`。変更量・テスト影響は最大。

## Codebase Pattern: 変更の影響を受ける既存テスト

| テスト | 固定している内容 | 影響 |
|------|------|------|
| `packages/core/test/html-sanitization.test.ts` | `ALLOWED_TAGS`（12タグ）、`<a>` 以外は属性なし | `br` / `p` 追加時に集合の更新が必要 |
| `apps/web/test/xss-defense.test.ts` / `apps/extension/test/xss-defense.test.ts` | sanitizedHtml のタグが12タグ集合内 | 同上（入力に段落・見出しを含むため新タグが実際に出現する） |
| `packages/core/test/block-child-separator.test.ts` | 引用・ルーズリスト項目内の段落を `" "` で連結（`<br>`/`<p>` は許可外という根拠をコメントに記載） | 段落区切りを改行にするなら期待値とコメントの根拠を更新 |
| `packages/core/test/conversion-table.test.ts` | 各行の html を `toBe` で完全一致（インライン単独は `<b>bold</b>` 等） | B/C 方式では全インライン行が変わる。A 方式では基本的に変化なし |
| `packages/core/test/url-scheme-sanitization.test.ts` | `toBe("click me")` 等、段落単体の完全一致 | B/C 方式で変わる |
| `packages/core/test/composed-formatting.test.ts` | `<blockquote>some <i>italic</i> text</blockquote>` 等を `toBe` | B/C 方式で引用内が変わる。見出し→テーブルは `toContain` + 順序のみ |
| `packages/core/test/table-alignment.test.ts` / `table-memoization.test.ts` | 単一テーブルの `<pre><code>…</code></pre>` を `toBe` | 単一ブロックのため連結方式の影響なし（表内 `<br>` は空白1つの固定ルール、維持が必要） |
| `packages/core/test/ordered-list-start.test.ts` | 単一リストの html を `toBe` | 影響なし（リスト項目内改行を変えない限り） |
| `apps/extension/test/cross-surface-parity.test.ts` | web と extension の出力一致 | 両 app を同時に更新すれば通る（片方だけの更新を検出するガードとして有効） |
| `apps/*/test/large-input-guard.test.ts`, `main.test.ts` | `toContain("<b>bold</b>")` | A 方式は影響なし、B 方式でも `toContain` のため通る |
| `packages/browser-utils/test/clipboard.test.ts` | clipboard 書き込み | 影響なし |

改行保持を検証する新規テスト（段落内ソフト改行・ハード改行・段落間空行・連続空行の正規化・引用/リスト内の改行）の追加が必要。

## Quality Gate Candidates

| name | command | source |
|------|---------|--------|
| tests | `npm test` | `package.json` scripts.test（全 workspace の `vitest run`） |
| lint | `npm run lint` | `package.json` scripts.lint（`eslint .`） |
| typecheck | `npm run typecheck` | `package.json` scripts.typecheck（全 workspace の `tsc --noEmit`） |
| build | `npm run build` | `package.json` scripts.build（extension は bundle size チェックと zip を含む） |

注: apps は core を `dist/` 経由で参照するため、テスト前に `npm run build`（少なくとも core）が必要になる可能性がある（`.github/workflows/deploy-web.yml` のコメントより。vitest 設定の alias 有無は未確認）。CI は GitHub Pages デプロイのみで、テスト用ワークフローは存在しない。worktree には `node_modules` が未インストール（`npm ci` が必要）。

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

## UI Mockup: プレビュー（変更後の期待表示）

**Source:** collaborative（新規画面はなく、既存プレビューの表示内容のみ変わる）

### Layout
```
┌──────────────────────────────┬──────────────────────────────┐
│ Markdown Input               │ Slack Preview                │
├──────────────────────────────┼──────────────────────────────┤
│ line1                        │ line1                        │
│ line2                        │ line2                        │
│                              │                              │
│                              │ para2                        │
│                              │                              │
│ para2                        │ • a                          │
│                              │                              │
│ - a                          │                              │
├──────────────────────────────┴──────────────────────────────┤
│ [Copy for Slack]  [Copy mrkdwn]                             │
└─────────────────────────────────────────────────────────────┘
```

### Interactions
- 入力: 段落内の改行はプレビューでも改行、連続空行は空行1つに正規化して表示。
- Copy for Slack: text/html に改行・空行が表現され、貼り付け先 Slack で同じ見た目になること（Slack 側の解釈は未確認のため手動検証）。

### Data Mapping
- Slack Preview ← SlackHtmlFragment.html（DOMPurify 済み）
- Copy for Slack ← SlackHtmlFragment.html（text/html）+ SlackMrkdwnOutput.text（text/plain）

## Domain Model

### Entities
- **MarkdownDocument**: 入力テキスト — Fields: rawText
- **MdastRoot / BlockNode / PhrasingNode**: remark のパース結果。改行の担い手は `text.value` 内の `\n`（ソフト改行）と `break` ノード（ハード改行）、段落境界はブロック兄弟関係
- **SlackMrkdwnOutput**: text/plain 用 — Fields: text（改行保持済み）
- **SlackHtmlFragment**: text/html 用 — Fields: html（改行が失われている、修正対象）
- **AllowedTagSet**: HTML の許可タグ集合（core 実装・core テスト・apps pipeline ×2・apps テスト ×2 に重複）
- **ClipboardPayload**: text/html + text/plain の組（browser-utils）

### Relationships
- MarkdownDocument → parse → MdastRoot → toMrkdwn / toSlackHtml → 各出力
- SlackHtmlFragment は AllowedTagSet で DOMPurify サニタイズされてから Preview と ClipboardPayload に渡る
- web と extension は同一の pipeline / copy-actions を複製保持（parity テストで一致を保証）

### Data Sources
- **@mdforslack/core convert()**（ライブラリ）: Available — mrkdwn/html の両出力。Missing — html における改行・空行表現。

### Data Gaps
- Slack 貼り付け時の HTML 解釈が公式に未確認 → 実 Slack への手動受け入れテストで表現方式（A/B/C）を確定する。
