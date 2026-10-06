---
intent_slug: md-for-slack
worktree_path: <repo-root>/.ai-dlc/worktrees/md-for-slack
project_maturity: greenfield
provider_config: {"spec":null,"ticketing":null,"design":null,"comms":null,"vcsHosting":null,"ciCd":null}
---

# Intent Description

The user previously relied on a third-party website, https://www.marktoslack.com/, which converted
Markdown text into a form that pastes correctly into Slack (Slack does not render standard Markdown;
it uses its own "mrkdwn" dialect). That site is now returning NOT FOUND (defunct/closed). The user saved
a browser MHTML snapshot of the site (rendered DOM + CSS + fonts only — the actual JavaScript conversion
logic was NOT captured, since it was only a `<link rel=preload as=script>` reference, not inlined).

The user wants to recover the *functionality* (not the original code, which was never available) and
publish it more resiliently than a single commercial website, given the risk of the original site's
closure repeating. The user confirmed marktoslack.com was a **third-party site** they did not own —
so this project must NOT reuse the original site's HTML, CSS, copy text, or branding. Only the
*functional specification* (the Markdown → Slack mapping rules, which are facts/rules and not the
original author's creative expression) should be used as a reference. All UI, wording, and branding
must be original work under the new product name **MDforSlack**.

## Extracted Functional Specification (from the saved MHTML's own on-page documentation)

The original site's page copy documented its own conversion rules in a "cheat sheet" table and FAQ.
This is the spec to reimplement (independently, with original UI/copy):

### Why Markdown breaks in Slack
Slack does not render standard Markdown. It uses its own dialect called **mrkdwn**:
- `*single asterisks*` = bold (not italic as in standard Markdown)
- `_underscores_` = italic
- links are written `<url|label>` instead of `[label](url)`
- headings, tables, and images have no native syntax at all

### Conversion table (Markdown → Slack mrkdwn)
| Element | Markdown | Slack mrkdwn |
|---|---|---|
| Heading | `# Heading` | `*Heading*` (bold line — Slack has no headings) |
| Bold | `**bold**` | `*bold*` (single asterisks) |
| Italic | `*italic*` or `_italic_` | `_italic_` (underscores) |
| Strikethrough | `~~strike~~` | `~strike~` (single tildes) |
| Link | `[label](https://url)` | `<https://url|label>` (or a real hyperlink via rich-text paste) |
| Image | `![alt](https://url)` | link to the image (Slack can't paste-embed images) |
| Bullet list | `- item` | • item (◦ and ▪ when nested) |
| Numbered list | `1. item` | `1. item` (kept as typed numbers) |
| Task list | `- [ ]` / `- [x]` | ☐ todo / ☑ done |
| Blockquote | `> quote` | `> quote` (same syntax) |
| Inline code | `` `code` `` | `` `code` `` (same syntax) |
| Code block | ` ```lang ... ``` ` | ` ``` ... ``` ` (language tag dropped) |
| Table | `\| a \| b \|` | column-aligned monospace text inside a code block |
| Divider | `---` | a plain long rule line (─────) |

### Two required output modes (confirmed with user — both required)
1. **"Copy for Slack" (rich text clipboard)** — writes rich text (HTML) to the clipboard so that
   pasting directly into the Slack message composer produces native Slack formatting (real bold,
   clickable links, real bullet/numbered lists, checkboxes, code blocks) with no leftover Markdown
   syntax. This requires writing both a `text/html` (rich) and `text/plain` (mrkdwn fallback) payload
   to the clipboard via the browser Clipboard API (`ClipboardItem`), because Slack's message composer
   is a rich-text (contenteditable) editor that interprets pasted HTML, not mrkdwn text.
2. **"copy mrkdwn" (plain text)** — copies the plain-text mrkdwn dialect string, for use in the Slack
   API (`chat.postMessage`, Block Kit `text` objects, incoming webhooks, bots, Workflow Builder).

### Privacy/architecture constraint (explicit product claim to preserve)
"Free, no sign-up, runs entirely in your browser — nothing is uploaded to a server." This means: **no
backend, no network calls, all conversion happens client-side in JS.** This is also why a static site
+ browser extension (rather than a server-rendered app) is the right shape.

## Clarification Answers (from elaboration Phase 1/2 dialogue with the user)

- Q: Was marktoslack.com the user's own site? A: **No — third-party site.** → Do not reuse its
  HTML/CSS/copy/branding. Only the functional mapping rules above may be used as a spec reference.
- Q: Distribution scope? A: **Both a static website AND a Chrome extension, built simultaneously**,
  sharing one core conversion module/library between the two surfaces (not sequential — both in this
  intent).
- Q: Output modes needed? A: **Both** — rich-text clipboard copy ("Copy for Slack") AND plain mrkdwn
  copy ("copy mrkdwn"), matching the original site's two-button behavior.
- Q: Brand name? A: **MDforSlack** (chosen by the user from proposed candidates). Note: the current
  git repo directory is named `mark_to_slack`, which is close to the original site's brand
  "MarkToSlack" — the repo directory name is for internal/dev use only and must NOT be used as the
  public-facing product name, domain, or store listing name. Public-facing name is **MDforSlack**.
- Q: License? A: **Open source, MIT-style license**, published publicly (repo, site, and extension
  listing should reflect this).
- Risk driver: the user explicitly wants resilience against a single site/company disappearing again
  — this shaped the "static site + extension, both from one shared module, OSS" recommendation that
  the user approved.

## Discovery File Path

<repo-root>/.ai-dlc/worktrees/md-for-slack/.ai-dlc/md-for-slack/discovery.md

## Existing Project Knowledge

None — greenfield project. Knowledge artifacts at `.ai-dlc/knowledge/domain.md` and
`.ai-dlc/knowledge/product.md` are low-confidence scaffolds with no real content; do not treat them
as findings.

## What discovery should research and record

This is a brand-new (greenfield) repository with no existing code, so there is no codebase to scan.
Please research and write findings to `discovery.md` covering:

1. **Repository/monorepo shape** for sharing one core Markdown→mrkdwn conversion module between a
   static web page and a Chrome (Manifest V3) extension — e.g. a `packages/core` shared TS module
   consumed by `apps/web` (static site) and `apps/extension` (Manifest V3), using a lightweight
   package manager workspace (npm/pnpm workspaces). Keep it simple — this is a small greenfield tool,
   not a large system; avoid recommending heavyweight infra.
2. **Markdown parsing approach**: whether to use an existing Markdown parser/AST library (e.g.
   `markdown-it`, `remark`/`mdast`, `marked`) and transform its AST into (a) an HTML fragment matching
   Slack-paste-compatible formatting and (b) a plain mrkdwn string, versus hand-rolling a regex-based
   converter. Note tradeoffs (correctness/edge cases vs. bundle size/simplicity) — this determines a
   unit boundary (core conversion library unit).
3. **Clipboard write mechanism**: the `navigator.clipboard.write()` API with multiple `ClipboardItem`
   MIME types (`text/html` + `text/plain`) in the same write call, including known browser support
   caveats and secure-context (HTTPS) requirements, and how this differs between a normal web page
   context and a Chrome extension popup/content-script context (permissions needed, e.g.
   `clipboardWrite`).
4. **Chrome extension architecture** (Manifest V3): whether a simple popup UI (action popup) is
   sufficient for a two-pane markdown-in/Slack-preview-out tool, or whether a side panel
   (`chrome.sidePanel`) gives more usable space; required permissions; whether it can share the exact
   same UI bundle as the web site (e.g. same web app loaded inside the popup, with clipboard write
   working from the extension context) to minimize duplicate UI code.
5. **Static hosting options with zero single-point-of-failure** for the "resilience against site
   closure" goal — e.g. GitHub Pages (tied to the OSS repo itself, so the site and its source live in
   the same place and can be forked/re-deployed trivially by anyone) vs. Cloudflare Pages/Netlify.
   Recommend one primary hosting target appropriate for a simple static-only (no backend) OSS project.
6. **Build tooling**: a minimal, modern toolchain appropriate for a small client-side-only tool (e.g.
   Vite + TypeScript + Vitest for unit-testing the conversion module, since correctness of the
   Markdown→mrkdwn table above is the core value and is highly testable).
7. **Chrome Web Store publishing requirements** at a high level (developer account, review process,
   privacy policy requirement even for a no-network-calls tool) — just enough for the unit spec to
   account for it as a deliverable, not exhaustive legal detail.

Do not fabricate specifics you are not confident about (e.g. exact current Chrome Web Store fees or
review turnaround times) — note them as "verify against current official docs at build time" rather
than stating a possibly-stale number.

## Quality Gate Candidates

Since this is greenfield with no existing tooling, propose sensible defaults for a
TypeScript + Vite + Vitest project (e.g. `npm test`, `npm run lint`, `npm run build`) as candidates —
these will be confirmed with the user after discovery completes.
