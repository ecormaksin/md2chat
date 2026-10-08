# MD2Chat

English | [日本語](README.ja.md)

Convert Markdown into formatting that pastes cleanly into Slack, without stray `**`, `#`, or
`[text](url)` characters.

**Use it now: https://ecormaksin.github.io/md2chat/**

Coding agents and many other tools produce Markdown, but Slack does not render standard Markdown
in its message composer. MD2Chat converts it so you can paste the result straight into a message
body instead of attaching it as a file or a snippet.

## Features

- **Copy for Slack**: copies rich text (HTML) together with a plain `mrkdwn` fallback. Bold text,
  links, lists, and line breaks are preserved when you paste.
- **Copy mrkdwn**: copies Slack's `mrkdwn` markup only, for bots, the API, or plain-text fields.
- **Live preview** that updates as you type.
- **Private by design**: everything runs locally in your browser. There are no network requests,
  no sign-up, and no data collection.

## Supported Markdown

| Element | Markdown | mrkdwn output | Rich text (HTML) output |
|---|---|---|---|
| Heading | `# Heading` | `*Heading*` | `<b>Heading</b>` |
| Bold | `**bold**` | `*bold*` | `<b>bold</b>` |
| Italic | `*italic*` / `_italic_` | `_italic_` | `<i>italic</i>` |
| Strikethrough | `~~strike~~` | `~strike~` | `<s>strike</s>` |
| Link | `[label](https://…)` | `<https://…\|label>` | `<a href="https://…">label</a>` |
| Image | `![alt](https://…)` | `<https://…\|alt>` | link labeled `alt (image)` |
| Bullet list | `- item` | `• item` (`◦`, `▪` when nested) | `<ul><li>…</li></ul>` |
| Numbered list | `1. item` | `1. item` | `<ol><li>…</li></ol>` |
| Task list | `- [ ]` / `- [x]` | `☐` / `☑` | `☐` / `☑` |
| Blockquote | `> quote` | `> quote` | `<blockquote>…</blockquote>` |
| Inline code | `` `code` `` | `` `code` `` | `<code>code</code>` |
| Code block | ` ``` ` fenced | ` ``` ` fenced (language tag dropped) | `<pre><code>…</code></pre>` |
| Table | GFM table | column-aligned text in a code block | same, in `<pre><code>` |
| Divider | `---` | a line of 40 `─` characters | `<hr>` |
| Line break | soft or hard break | newline | `<br>` |

Paragraphs and blocks are separated by exactly one blank line. Runs of blank lines collapse into one.
Raw HTML in the input is removed, and only `http`, `https`, and `mailto` links are kept.

## Chrome extension (optional)

The same converter is also available as a Chrome side panel, which stays open while you switch
tabs. It is not published on the Chrome Web Store. To use it, load it locally:

1. Build the project (see [Development](#development)).
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select `apps/extension/dist`.
4. Pin **MD2Chat** in the toolbar and click it to open the side panel.

After you pull updates, rebuild and click the reload button for the extension on
`chrome://extensions`.

## Development

Requirements: Node.js 22 and npm.

```bash
npm ci              # install dependencies for all workspaces
npm run build       # build packages, then the web app and the extension
npm test            # run all tests (run build first: apps use the built packages)
npm run lint
npm run typecheck
npm run dev --workspace @md2chat/web   # start the web app dev server
```

### Repository layout

| Path | Contents |
|---|---|
| `packages/core` | `@md2chat/core`: parses Markdown with `remark` and `remark-gfm`, then renders `mrkdwn` and rich-text HTML |
| `packages/browser-utils` | `@md2chat/browser-utils`: clipboard helpers shared by both apps |
| `apps/web` | The web app, deployed to GitHub Pages |
| `apps/extension` | The Chrome extension (Manifest V3 side panel). `npm run build` also writes `dist.zip` |
| `scripts` | Build helpers, such as the plugin that writes `THIRD_PARTY_LICENSES.txt` into each `dist` |

### Deployment

Every push to `main` builds the project and deploys `apps/web/dist` to GitHub Pages through
`.github/workflows/deploy-web.yml`.

## License

[MIT](LICENSE). Licenses of bundled third-party packages ship with each build as
`THIRD_PARTY_LICENSES.txt`.

## Disclaimer

MD2Chat is an independent, unofficial tool. It is not affiliated with, endorsed by, sponsored by,
or supported by Slack Technologies. Slack is a trademark of its respective owner.
