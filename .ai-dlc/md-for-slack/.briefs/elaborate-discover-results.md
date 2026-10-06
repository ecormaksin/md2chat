---
status: success
error_message: ""
---

# Discovery Results

## Domain Model Summary

### Entities

- **MarkdownDocument**: raw markdown text typed/pasted by the user — Fields: `rawText`.
- **ConversionAst**: parsed `mdast` tree (via `remark` + `remark-gfm`) — Fields: `type`, `children`
  (node kinds: heading, paragraph, strong, emphasis, delete, link, image, list, listItem, table,
  tableRow, tableCell, blockquote, code, inlineCode, thematicBreak, text).
- **ConversionRule**: one row of the extracted Markdown→mrkdwn spec table — Fields: `markdownPattern`,
  `mrkdwnOutput`, `htmlOutput`, `notes`.
- **SlackMrkdwnOutput**: plain-text Slack mrkdwn string — Fields: `text`.
- **SlackHtmlFragment**: Slack-paste-compatible rich-text HTML string — Fields: `html`.
- **ClipboardPayload**: dual-MIME clipboard write for "Copy for Slack" — Fields: `htmlBlob` (text/html),
  `textBlob` (text/plain).
- **CoreConversionModule** (`@mdforslack/core`): `parse()`, `toMrkdwn()`, `toSlackHtml()`.
- **WebApp** (`apps/web`) and **ExtensionPanel** (`apps/extension`): thin UI shells wrapping the core module.

### Relationships

- `MarkdownDocument` → parsed into one `ConversionAst`.
- `ConversionAst` → rendered into one `SlackMrkdwnOutput` and one `SlackHtmlFragment` (single parse, two renderers).
- Each AST node ↔ exactly one `ConversionRule`.
- `ClipboardPayload` wraps `SlackHtmlFragment` + `SlackMrkdwnOutput` (for "Copy for Slack" only).
- "copy mrkdwn" uses `SlackMrkdwnOutput` alone.
- `WebApp` and `ExtensionPanel` both depend on `CoreConversionModule`; no dependency on each other.

### Data Sources

- **Extracted conversion table** (static functional spec from the saved MHTML's cheat sheet):
  - Available: definitive mapping for all 13 documented element types.
  - Missing: composition/edge-case behavior (nested formatting, malformed input).
- **mdast + remark-gfm node taxonomy** (versioned OSS library API):
  - Available: canonical AST coverage for every table row — GFM covers strikethrough/tables/task lists.
  - Missing: nothing for the documented feature set.

### Data Gaps

- Nested/combined formatting and malformed input aren't defined by the extracted spec table → resolve by
  deferring to remark/remark-gfm's own deterministic CommonMark+GFM parsing behavior, with a handful of
  composition cases added as regression tests.
- Slack's rich-text-paste HTML acceptance is undocumented publicly → resolve via manual verification
  (paste generated HTML into a real Slack client) as a build-unit acceptance step, not a unit-testable gap.

## Key Findings

- **Shared core, thin UI shells**: an npm-workspaces monorepo (`packages/core` + `apps/web` +
  `apps/extension`) is the right shape — the conversion logic is the one thing that must not drift
  between the two surfaces; the UI shells are cheap enough to duplicate rather than force into a shared
  UI package prematurely.
- **Parse once, render twice**: use `remark` + `remark-gfm` (mdast) rather than hand-rolled regex. GFM
  extensions map 1:1 onto every row of the extracted conversion table (strikethrough, tables, task lists
  are exactly the non-core-CommonMark rows). One AST parse feeds two custom renderers (mrkdwn string,
  Slack-paste HTML fragment) so the two outputs can't drift from each other.
- **Clipboard write needs two MIME types in one call**: `navigator.clipboard.write` with a `ClipboardItem`
  carrying both `text/html` and `text/plain` in one atomic write satisfies "Copy for Slack" in a single
  code path; "copy mrkdwn" only needs the `text/plain` string. Requires secure context (HTTPS) and a
  user-gesture-triggered handler; needs feature-detection + fallback for broader compatibility.
- **Side panel over popup for the extension**: `chrome.sidePanel` (MV3, Chrome 114+) stays open across
  tab/window switches, which fits the actual workflow (compose → alt-tab to Slack → paste) far better
  than a popup that closes on blur — validate with a quick prototype before fully committing.
- **GitHub Pages is the resilience-aligned hosting choice**: source and hosting live in the same forkable
  OSS repo, directly addressing the "don't depend on one company again" goal better than Cloudflare
  Pages/Netlify/Vercel, each of which decouples hosting from the repo.
- **Vite + TypeScript + Vitest** is the appropriate minimal toolchain; Vitest unit tests against the
  conversion table (~13 rows + edge cases) are the highest-value quality gate since correctness of that
  table is the product's core value.
- **Chrome Web Store requires a privacy policy even for a zero-network-calls tool** — straightforward to
  satisfy honestly here since the product's own "nothing uploaded" claim is exactly what the disclosure
  should state. MV3 is mandatory for new submissions (confirms the brief's assumption). Exact fees and
  review turnaround times are explicitly NOT stated here — flagged for verification against current
  official docs at build/publish time.

## Open Questions

- Should `packages/core`'s public API be `parse()` + two separate renderer functions, or a single
  combined `convert(markdown)` returning both outputs? (Affects unit boundary/testing granularity —
  recommend deciding during unit decomposition, not discovery.)
- Side panel vs. popup for the extension: confirmed as the recommended direction, but should be validated
  with a throwaway prototype early in the build phase before committing the unit spec to it exclusively.
- Should `@crxjs/vite-plugin` be adopted for the extension build, or a manual Vite multi-entry + static-copy
  config? Recommend a quick build-time spike to check the plugin's current Vite-version compatibility.
- Exact Chrome Web Store one-time developer fee and current review turnaround — intentionally left
  unverified here; confirm against official Chrome Web Store developer documentation before the
  publishing unit is executed.

## Mockups Generated

- `.ai-dlc/md-for-slack/discovery.md` (section "UI Mockup: Web App Main View") — two-pane desktop layout:
  Markdown input (left) and live Slack preview (right), with "Copy for Slack" / "Copy mrkdwn" buttons
  and a privacy-claim footer note.
- `.ai-dlc/md-for-slack/discovery.md` (section "UI Mockup: Extension Side Panel View") — narrow
  single-column stacked layout (input above, preview below) for the Chrome MV3 side panel, matching the
  same interaction model as the web app but fitted to the panel's width.
