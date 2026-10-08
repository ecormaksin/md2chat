# MD2Chat

[English](README.md) | 日本語

Markdown を、Slack にそのまま貼り付けられる書式に変換します。`**` や `#`、`[text](url)` といった記号は残りません。

**今すぐ使う: https://ecormaksin.github.io/md2chat/**

コーディングエージェントなど多くのツールは Markdown で出力しますが、Slack のメッセージ入力欄は標準の Markdown を表示できません。MD2Chat で変換すれば、ファイルやスニペットとして添付せずに、メッセージ本文として直接貼り付けられます。

## 機能

- **Copy for Slack**: リッチテキスト（HTML）と、プレーンな `mrkdwn` の代替テキストを一緒にコピーします。貼り付けたときに、太字・リンク・リスト・改行が保たれます。
- **Copy mrkdwn**: Slack の `mrkdwn` 記法だけをコピーします。ボットや API、プレーンテキストの入力欄に使えます。
- **ライブプレビュー**: 入力に合わせてすぐに更新されます。
- **プライバシー重視**: 処理はすべてブラウザ内で行います。通信、登録、データ収集は一切ありません。

## 対応している Markdown

| 要素 | Markdown | mrkdwn の出力 | リッチテキスト（HTML）の出力 |
|---|---|---|---|
| 見出し | `# Heading` | `*Heading*` | `<b>Heading</b>` |
| 太字 | `**bold**` | `*bold*` | `<b>bold</b>` |
| 斜体 | `*italic*` / `_italic_` | `_italic_` | `<i>italic</i>` |
| 取り消し線 | `~~strike~~` | `~strike~` | `<s>strike</s>` |
| リンク | `[label](https://…)` | `<https://…\|label>` | `<a href="https://…">label</a>` |
| 画像 | `![alt](https://…)` | `<https://…\|alt>` | `alt (image)` というリンク |
| 箇条書き | `- item` | `• item`（入れ子では `◦`、`▪`） | `<ul><li>…</li></ul>` |
| 番号付きリスト | `1. item` | `1. item` | `<ol><li>…</li></ol>` |
| タスクリスト | `- [ ]` / `- [x]` | `☐` / `☑` | `☐` / `☑` |
| 引用 | `> quote` | `> quote` | `<blockquote>…</blockquote>` |
| インラインコード | `` `code` `` | `` `code` `` | `<code>code</code>` |
| コードブロック | ` ``` ` で囲む | ` ``` ` で囲む（言語名は削除） | `<pre><code>…</code></pre>` |
| 表 | GFM の表 | 列をそろえたテキストをコードブロックに入れる | 同じ内容を `<pre><code>` に入れる |
| 区切り線 | `---` | `─` を 40 個並べた線 | `<hr>` |
| 改行 | 段落内の改行、強制改行 | 改行 | `<br>` |

段落やブロックの間は、空行ちょうど 1 つで区切ります。連続した空行は 1 つにまとめます。入力に含まれる生の HTML は削除し、リンクは `http`・`https`・`mailto` のものだけを残します。

## Chrome 拡張機能（任意）

同じ変換機能を、Chrome のサイドパネルとしても使えます。サイドパネルはタブを切り替えても開いたままです。Chrome ウェブストアには公開していないので、次の手順でローカルから読み込んでください。

1. プロジェクトをビルドします（[開発](#開発)を参照）。
2. `chrome://extensions` を開き、**デベロッパー モード**をオンにします。
3. **パッケージ化されていない拡張機能を読み込む**をクリックし、`apps/extension/dist` を選びます。
4. ツールバーに **MD2Chat** を固定し、アイコンをクリックするとサイドパネルが開きます。

更新を取り込んだあとは、もう一度ビルドしてから、`chrome://extensions` で拡張機能の再読み込みボタンを押してください。

## 開発

必要な環境: Node.js 22 と npm

```bash
npm ci              # すべてのワークスペースの依存パッケージをインストール
npm run build       # パッケージをビルドしてから、Web アプリと拡張機能をビルド
npm test            # すべてのテストを実行（アプリはビルド済みのパッケージを使うため、先に build を実行）
npm run lint
npm run typecheck
npm run dev --workspace @md2chat/web   # Web アプリの開発サーバーを起動
```

### フォルダ構成

| パス | 内容 |
|---|---|
| `packages/core` | `@md2chat/core`: `remark` と `remark-gfm` で Markdown を解析し、`mrkdwn` とリッチテキスト（HTML）を出力 |
| `packages/browser-utils` | `@md2chat/browser-utils`: 両アプリで共通のクリップボード処理 |
| `apps/web` | Web アプリ（GitHub Pages にデプロイ） |
| `apps/extension` | Chrome 拡張機能（Manifest V3 のサイドパネル）。`npm run build` で `dist.zip` も作成 |
| `scripts` | ビルド用の補助スクリプト（各 `dist` に `THIRD_PARTY_LICENSES.txt` を書き出すプラグインなど） |

### デプロイ

`main` に push するたびに、`.github/workflows/deploy-web.yml` がビルドを行い、`apps/web/dist` を GitHub Pages にデプロイします。

## ライセンス

[MIT](LICENSE)。同梱しているサードパーティ製パッケージのライセンスは、各ビルドの `THIRD_PARTY_LICENSES.txt` に含まれています。

## 免責事項

MD2Chat は独立した非公式のツールです。Slack Technologies とは提携しておらず、同社による承認・後援・サポートも受けていません。Slack はその所有者の商標です。
