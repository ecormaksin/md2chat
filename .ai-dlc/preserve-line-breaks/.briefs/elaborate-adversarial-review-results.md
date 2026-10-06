---
status: success
error_message: ""
findings_count: 11
auto_fixable_count: 4
categories_found: [contradiction, hidden-complexity, assumption, dependency, scope, completeness, boundary]
---

# Adversarial Review Results

## Summary

- **Total findings:** 11
- **Blocking:** 0
- **Warning:** 5
- **Suggestion:** 6
- **Auto-fixable:** 4 (high-confidence with automatable fix_type)

## Categories

- **contradiction:** 1 findings
- **hidden-complexity:** 1 findings
- **assumption:** 2 findings
- **dependency:** 1 findings
- **scope:** 1 findings
- **completeness:** 4 findings
- **boundary:** 1 findings

## Findings

```yaml
- id: F001
  category: completeness
  confidence: high
  severity: warning
  affected_units: [unit-01-html-line-breaks, intent.md]
  title: "fallback 経路（footnoteDefinition 等）で <pre> 外に \\n が漏れ、「任意の入力」基準を満たせない"
  description: >
    blockToHtml / inlineNodeToHtml の default ケースは escapeHtml(fallbackPlainText(node)) を返し、
    fallbackPlainText は子の text.value（\n を含む）をそのまま連結する。remark-gfm は脚注を有効にするため、
    footnoteDefinition がこの経路を通る。現行 dist で
    convert("a[^1]\n\n[^1]: foot\n    line2\n\n    para2").html は "a\n\nfoot\nline2para2" になり、
    \n が <pre> 外に残るうえ、脚注内の段落同士も区切りなしで連結される。unit の §1 は text / break /
    inlineCode / image しか対象にしていないため、spec どおりに実装しても intent の基準
    「html の <pre>…</pre> の外側に生の \n が含まれない」が偽になる。unit 側の基準は
    「任意の入力について」と言いながら「代表的な複合ドキュメントでテスト」としており、この穴を検出できない。
  evidence: >
    intent.md Success Criteria:「html の <pre>…</pre> の外側に生の \n が含まれない」
    unit-01 Success Criteria:「任意の入力について…\n が含まれない（代表的な複合ドキュメントでテスト）」
    unit-01 §1 は text / break / inlineCode / image のみ
    packages/core/src/index.ts blockToHtml default: `return escapeHtml(fallbackPlainText(node));`
  suggested_fix: >
    §1 に「fallback 経路（blockToHtml / inlineNodeToHtml の default）の出力でも \n を <br>
    （または空白）へ置換する」を追加し、脚注定義を含む入力を \n 非含有テストの入力に加える。
    あわせて「任意の入力について」の文言を、検証対象の入力集合（脚注を含む）を明示した表現に直す。
  fix_type: spec_edit
  fix_target: unit-01-html-line-breaks.md

- id: F002
  category: dependency
  confidence: high
  severity: warning
  affected_units: [unit-01-html-line-breaks, intent.md]
  title: "apps のテストは core の dist に依存するが、quality gate は tests が build より先"
  description: >
    packages/core/package.json の main / exports は ./dist/index.js で、apps/web の vitest.config.ts
    にはソースへの alias がない。したがって apps のテスト（renderPreview("a\nb") に <br> が残る、
    XSS 集合一致など）は core を build し直さない限り古い dist（または worktree では dist 自体が存在しない）
    を参照して失敗する。root の npm test は各 workspace の vitest run を回すだけで build を伴わず、
    intent の quality_gates も tests → lint → typecheck → build の順。unit の Notes は
    「可能性がある」とぼかしているが、実際には確定した暗黙の順序依存である。
  evidence: >
    packages/core/package.json: "main": "./dist/index.js", "exports" → ./dist/index.js
    apps/web/vitest.config.ts: alias 設定なし
    root package.json: "test": "npm run test --workspaces --if-present"
    worktree の packages/core に dist ディレクトリがない
    unit-01 Notes:「core のビルドが必要な場合がある」
  suggested_fix: >
    unit の Notes を「apps のテスト前に core の build（npm run build -w @mdforslack/core）が必須」
    に確定させ、TDD の RED/GREEN 手順と quality gate 実行前に core build を行うことを明記する。
  fix_type: spec_edit
  fix_target: unit-01-html-line-breaks.md

- id: F003
  category: contradiction
  confidence: medium
  severity: warning
  affected_units: [intent.md, unit-01-html-line-breaks]
  title: "「mrkdwn は既に要件を満たす」は、リスト項目内の複数段落については誤り"
  description: >
    intent の Solution は mrkdwn を「既に要件を満たす」ため変更しないとし、ユーザー決定事項に
    「引用・リスト内も保持」がある。しかし discovery の実測では `- p1\n\n  p2` の mrkdwn は
    "• p1 p2" で、段落区切りが空白に潰れている。スコープ外として明記されているのは
    「継続行インデント消失」だけで、この段落潰れは記載がない。変更後は html が
    "p1<br><br>p2"、text/plain が "• p1 p2" となり、同じクリップボード内で2つの表現が食い違う
    （text/plain にフォールバックしたときや、貼り付け先が text/plain を優先したときに差が出る）。
  evidence: >
    intent.md Solution:「mrkdwn（text/plain）出力は変更しない（既に要件を満たす）」
    discovery.md 現状表: `- p1\n\n  p2\n- x\n  y` → mrkdwn "• p1 p2\n• x\ny"
    intent.md Context のスコープ外は「継続行インデントが消える件」と「<ol start>」のみ
  suggested_fix: >
    「既に要件を満たす」を「HTML 経路が対象のため変更しない」に改め、リスト項目内の複数段落が
    mrkdwn で空白に潰れる件をスコープ外リストに明記する（または対象に含める）。どちらにするかは
    ユーザーが判断する。
  fix_type: manual
  fix_target: ""

- id: F004
  category: assumption
  confidence: high
  severity: suggestion
  affected_units: [unit-01-html-line-breaks]
  title: "改行を \\n のみと仮定しているが、CRLF / CR 入力では text.value に \\r が残る"
  description: >
    remark は text.value の改行を正規化しない。現行 dist で parse("a\r\nb") の text.value は "a\r\nb"
    になる。§1 の「\n を <br> へ置換」をそのまま実装すると "a\r<br>b" になり、CR のみ（"a\rb"）の入力は
    ソフト改行として扱われない。web と extension は textarea 経由（値は LF に正規化される）のため影響は
    小さいが、core は公開ライブラリの API であり、基準の「\n を含まない」も \r を検出しない。
  evidence: >
    unit-01 §1:「escapeHtml(value) の後に \n を <br> へ置換」
    実測: convert("a\r\nb").html === "a\r\nb"
  suggested_fix: >
    置換対象を /\r\n|\r|\n/ とし（inlineCode・image alt の空白置換も同様）、CRLF 入力のテストを 1 件追加する。
  fix_type: spec_edit
  fix_target: unit-01-html-line-breaks.md

- id: F005
  category: completeness
  confidence: high
  severity: warning
  affected_units: [unit-01-html-line-breaks]
  title: "実 Slack 手動検証の基準に、検証入力・判定基準・実施者・記録先が定義されていない"
  description: >
    「実 Slack に貼り付け…手動確認し、結果を unit のノートに記録」は、自律的な builder や reviewer
    では実行も検証もできない。どの Markdown サンプルを貼るのか、何をもって合格とするのか
    （例: 段落間の空行が 1 行、ul の前後の空行が 1 行）、誰がいつ実施するのか、記録先（「ノート」が
    unit ファイルのどのセクションか）が決まっていない。このままでは、unit の完了判定が止まるか、
    未検証のまま完了扱いになるおそれがある。
  evidence: >
    unit-01 Success Criteria:「実 Slack に「Copy for Slack」で貼り付け、…手動確認し、結果を unit のノートに記録する」
    intent.md Data Gaps:「実 Slack での手動検証で確認する」
  suggested_fix: >
    固定の検証用 Markdown（段落内改行、段落間、見出し→段落、段落→リスト、リスト→段落、引用前後、
    コード→hr を含む）と、各箇所の期待する空行数を unit に記載する。ユーザーが実施する human checkpoint
    であることと、記録先セクション（例: unit の「## Manual Verification」）も明記する。
  fix_type: spec_edit
  fix_target: unit-01-html-line-breaks.md

- id: F006
  category: hidden-complexity
  confidence: medium
  severity: warning
  affected_units: [unit-01-html-line-breaks, intent.md]
  title: "Slack の解釈が想定と違った場合の手戻りが「1箇所で済む」とされ、過小評価されている"
  description: >
    区切り規則（インライン系の後は <br><br>、ブロック要素の後は <br>）は、ブラウザの描画
    （ブロック要素直前の末尾 <br> が消費される）を根拠にしている。Slack が貼り付け時にこの規則どおり
    解釈するかは未確認（Data Gaps）。手動検証は全実装とテストの後に置かれている。ずれた場合に
    直す必要があるのはヘルパー 1 箇所だけではない。§2 の期待例表、7×7 の 49 ケース、
    block-child-separator.test.ts、intent の Success Criteria 2 項目（規則が文字列でハードコードされている）
    もすべて書き換えになる。
  evidence: >
    unit-01 Risks:「ずれた場合は区切り規則のみ調整する（ヘルパーに集約しているため1箇所で済む）」
    intent.md Success Criteria:「インライン系の後 <br><br>、ブロック要素の後 <br>」
    discovery.md External Research: 項目 2・3 が未確認
  suggested_fix: >
    実装より前に、手書きの HTML（<br>、<br><br>、ul/pre/hr 隣接の <br>）を text/html で Slack に貼り付ける
    スパイク（ユーザーによる手動確認）を行い、規則を確定させてからテストを書く順序を unit に明記する。
    あわせて Risks の「1箇所で済む」を、実際の影響範囲に合わせて修正する。
  fix_type: manual
  fix_target: ""

- id: F007
  category: assumption
  confidence: medium
  severity: suggestion
  affected_units: [unit-01-html-line-breaks]
  title: "非対称な区切りの根拠はプレビューの CSS マージンを考慮しておらず、プレビューの空行がモックと一致しない"
  description: >
    apps/web/src/style.css では .preview-box ul/ol/blockquote に margin: 0.5em 0 が指定され、pre は
    ブラウザ既定のマージンを持つ。このため `a<br><br><ul>` や `</ul><br>b` は、プレビュー上では
    「空行 1 つ＋マージン」になり、段落間（空行 1 つ）より広く見える。unit の Boundaries は
    「プレビュー用 CSS の調整はしない」としており、discovery のモック（空行 1 つ）どおりの見た目になる
    保証がない。
  evidence: >
    apps/web/src/style.css 125-137 行: `.preview-box ul, .preview-box ol { margin: 0.5em 0; }`、
    `.preview-box blockquote { margin: 0.5em 0; }`
    unit-01 Boundaries:「プレビュー用 CSS の調整はしない」
    discovery.md UI Mockup: 段落とリストの間に空行 1 つ
  suggested_fix: >
    プレビューの空行はマージン分だけ広くなってよい、と許容範囲を明記するか、Boundaries を見直して
    ブロック要素のマージン調整を対象に含めるかを判断する。
  fix_type: manual
  fix_target: ""

- id: F008
  category: completeness
  confidence: medium
  severity: suggestion
  affected_units: [unit-01-html-line-breaks]
  title: "Copy for Slack の再サニタイズ経路で <br> が残ることを検証する基準がない"
  description: >
    基準では renderPreview().sanitizedHtml に <br> が残ることだけを検証している。本 intent の主目的である
    handleCopyForSlack() → copySlackRichText() に渡る text/html に <br> が残ることは、
    「pipeline.ts から import しているため自動で反映」という前提にしか依拠しておらず、テストで固定されていない。
    将来 copy-actions.ts の allowlist が独立すると、無言で回帰する。
  evidence: >
    unit-01 §6:「copy-actions.ts、browser-utils（allowlist を pipeline.ts から import しているため自動で反映）」
    unit-01 Success Criteria:「web・extension の renderPreview("a\nb").sanitizedHtml に <br> が残る」
  suggested_fix: >
    web と extension の両方で、handleCopyForSlack("a<br>b", …) が copySlackRichText に <br> を含む HTML を
    渡すことを検証する基準を追加する。
  fix_type: add_criterion
  fix_target: unit-01-html-line-breaks.md

- id: F009
  category: completeness
  confidence: medium
  severity: suggestion
  affected_units: [unit-01-html-line-breaks]
  title: "前 intent の仕様書（固定タグ集合）とそれを参照するコメントの扱いが未定義"
  description: >
    core のコードとテストのコメントは、仕様の出典として .ai-dlc/md-for-slack/unit-01-core-conversion-library.md
    を参照している。この仕様書は許可タグ集合を「b, i, s/del, a[href], ul/ol/li, blockquote, code, pre, hr」
    に固定しており、br を含まない。html-sanitization.test.ts の冒頭コメントも同じ 12 タグを列挙している。
    unit は break ケースのコメントと block-child-separator.test.ts の更新は求めているが、これらの参照先・
    コメントとの整合には触れていない。このため、実装後もコメントが旧仕様を指し続ける。
  evidence: >
    packages/core/src/index.ts 28 行: "See .ai-dlc/md-for-slack/unit-01-core-conversion-library.md for the full conversion table"
    .ai-dlc/md-for-slack/unit-01-core-conversion-library.md 111-113 行: 固定タグ集合（br なし）
    packages/core/test/html-sanitization.test.ts 8-9 行のコメント
  suggested_fix: >
    §5 に「html-sanitization.test.ts のコメントを更新し、br の出典として本 intent（.ai-dlc/preserve-line-breaks/）
    への参照を追加する」を加える。旧仕様書は変更せず、上書きした旨を参照コメントに残す。
  fix_type: spec_edit
  fix_target: unit-01-html-line-breaks.md

- id: F010
  category: scope
  confidence: low
  severity: suggestion
  affected_units: [unit-01-html-line-breaks, intent.md]
  title: "7×7 の 49 通りの隣接テストは、規則の分岐数に対して過剰"
  description: >
    区切り規則は「直前ブロックがインライン系かブロック要素か」の 2 分岐だけで、直後の種類には依存しない。
    code と table はどちらも <pre> になり、描画上は区別がない。49 通りの完全一致テストは、規則を変更した
    ときの書き換え量（F006）を増やす一方で、検出力はほとんど増えない。直前 7 種 × 代表的な直後 1〜2 種と、
    §2 の期待例で同等の網羅性を得られる。
  evidence: >
    unit-01 Success Criteria:「全隣接組み合わせ（直前 7 種 × 直後 7 種）」
    unit-01 §2: 区切りは直前ブロックの種類だけで決まる
  suggested_fix: >
    table-driven テストで 49 通りを生成するのは構わないが、期待値は「直前の種類 → 区切り」の対応表 1 つから
    導く形にし、ハードコードした 49 行にしない（規則変更時の書き換えを 1 箇所にする）ことを推奨する。
  fix_type: manual
  fix_target: ""

- id: F011
  category: boundary
  confidence: low
  severity: suggestion
  affected_units: [unit-01-html-line-breaks]
  title: "library discipline の自律 unit に、人手の Slack 受け入れ検証が混在している"
  description: >
    unit は do-library エージェントが自律実行する前提だが、完了基準に実 Slack での手動検証が含まれている。
    自動の完了判定と人手の受け入れ判定が 1 unit に混在しているため、unit の完了状態が曖昧になる。
    F005・F006 とあわせて、手動検証を intent レベルの受け入れ手順（または実装前のスパイク）として分離する
    ほうが、責務の境界が明確になる。
  evidence: >
    unit-01 frontmatter: discipline: library
    unit-01 Success Criteria: 実 Slack 手動確認の項目
  suggested_fix: >
    手動 Slack 検証を unit の完了基準から外し、intent の受け入れ手順（ユーザー実施）として扱うか、
    unit 内で「human checkpoint」と明示してブロッキング条件を定義する。
  fix_type: manual
  fix_target: ""
```
