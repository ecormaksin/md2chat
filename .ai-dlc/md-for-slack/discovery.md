---
intent: md-for-slack
created: 2026-09-24T02:19:22Z
status: active
---

# Discovery Log: MDforSlack — Markdown to Slack Converter

Elaboration findings persisted during Phase 2.5 domain discovery.
Builders: read section headers for an overview, then dive into specific sections as needed.


## Architecture Decision: Monorepo Shape

**Decision:** npm-workspaces monorepo with three packages — one shared conversion library consumed by two thin UI shells.

```
mark_to_slack/
├── package.json                # workspace root ("workspaces": ["packages/*", "apps/*"])
├── tsconfig.base.json
├── packages/
│   └── core/                   # @mdforslack/core — shared conversion library (framework-agnostic TS)
│       ├── src/
│       │   ├── index.ts
│       │   ├── parse.ts        # markdown -> mdast (remark + remark-gfm)
│       │   ├── toMrkdwn.ts     # mdast -> plain Slack mrkdwn string
│       │   ├── toSlackHtml.ts  # mdast -> Slack-paste-compatible HTML fragment
│       │   └── types.ts
│       ├── package.json
│       └── vitest.config.ts
└── apps/
    ├── web/                     # static site (Vite + TS)
    │   ├── index.html
    │   ├── src/
    │   └── package.json        # depends on "@mdforslack/core": "workspace:*"
    └── extension/               # Chrome MV3 extension
        ├── manifest.json
        ├── src/ (popup or sidepanel UI)
        └── package.json        # depends on "@mdforslack/core": "workspace:*"
```

**Package manager:** npm workspaces (built into Node, zero extra tool install) rather than pnpm/turborepo —
this is a 3-package repo, not a large system; heavier workspace tooling would add setup/maintenance
cost without a matching benefit at this scale. pnpm remains a reasonable alternative if the user already
standardizes on it elsewhere, but npm is the pragmatic default here.

**UI code sharing:** only `packages/core` (the conversion logic) is shared as a proper package. The two
UI shells (`apps/web`, `apps/extension`) are each a small Vite build target that imports
`@mdforslack/core` directly — this is where DRY actually matters (conversion correctness is the product's
core value and the most error-prone code). The UI markup itself (two textareas + two buttons) is trivial
and cheap to duplicate; introducing a `packages/ui` design-system package now would be premature
abstraction (YAGNI) for a two-screen tool. Revisit only if UI complexity grows materially.

**Resilience rationale:** this structure directly serves the "don't depend on one company/site again" goal
— source, web build, and extension build all live in one forkable OSS repo; no UI logic exists only inside
a proprietary, closed-source deployment.

## Technology Choice: Markdown Parsing Approach

**Decision:** Use an AST-based parser — `remark` + `remark-gfm` (mdast) — and write two small custom
tree-visitors over the one parsed AST: one emitting the plain Slack mrkdwn string, one emitting a
Slack-paste-compatible HTML fragment. Do **not** hand-roll a regex-based converter.

**Why AST over regex:** the product's entire value proposition is "gets Slack formatting right when you
paste it" — correctness on edge cases (nested emphasis, links inside list items, code fences containing
markdown-looking characters, escaped literals) is exactly where line-based regex substitution breaks down.
An AST library has already solved tokenizing these cases correctly; reinventing that in regex duplicates
solved work and is the highest-risk place to introduce subtle bugs.

**Why remark/mdast specifically:** `remark-gfm` maps almost 1:1 onto every row the extracted spec table
requires — strikethrough, tables, and task lists are GitHub-Flavored-Markdown extensions (not part of
core CommonMark), and `remark-gfm` is the standard way to get all three in one AST pass alongside
headings, emphasis/strong, links, images, lists, blockquotes, and code (inline + fenced), which are core
CommonMark and supported by remark natively. This means the AST vocabulary needed for every documented
conversion rule is fully covered by "remark + remark-gfm," with no additional plugins.

**Alternative considered — `markdown-it`:** a mature, widely-used, token-stream-based parser (not a tree
like mdast, but a flat token array with open/close nesting) with a `Renderer` class designed to be
subclassed for custom output targets. Smaller dependency footprint than the unified/remark ecosystem.
This is a legitimate fallback if bundle size becomes a real constraint during the build unit — flag it as
the alternative to switch to if `remark`+`remark-gfm`+`unified` prove too heavy for the extension's
bundle-size expectations, but it is not the starting recommendation because mdast's typed node
vocabulary is a better fit for two custom renderers on one client-side tool.

**Alternative considered — `marked`:** simpler/faster, has a callback-style custom `Renderer`, smaller
plugin ecosystem than markdown-it. Viable but offers no advantage over markdown-it for this use case.

**Rejected — hand-rolled regex converter:** likely close to what the original marktoslack.com did, given
it was a small single-purpose tool, but regex substitution is exactly the wrong tool for a task whose
value is "correctness across composition and edge cases," per the AST-vs-regex rationale above.

**Known edge case to carry into the unit spec:** Slack's own bullet-nesting convention (•, then ◦, then
▪ per the extracted spec) requires tracking list-nesting depth while walking the AST — this must be an
explicit test case, not an incidental behavior.

**Type safety:** TypeScript's discriminated-union support over mdast's `Node['type']` field lets a
`switch` over node kinds be checked exhaustively at compile time (e.g. via a `never` fallthrough case),
which will catch "forgot to render table cells" style omissions before runtime — this is the single
highest-value use of TypeScript in this codebase.

## External Research: Clipboard Write Mechanism

**API:** the Async Clipboard API's `navigator.clipboard.write(items: ClipboardItem[])`, writing a single
`ClipboardItem` that carries two MIME representations at once:

```js
const html = new Blob([htmlString], { type: "text/html" });
const text = new Blob([plainString], { type: "text/plain" }); // the mrkdwn string, not raw markdown
await navigator.clipboard.write([new ClipboardItem({ "text/html": html, "text/plain": text })]);
```

**Why this satisfies both required output modes in one implementation path for "Copy for Slack":** a
paste target that accepts rich text (Slack's contenteditable message composer) reads the `text/html`
representation and renders native formatting with no leftover syntax; a plain-text-only paste target
falls back to `text/plain`, which should itself already be the Slack mrkdwn string (not raw HTML or raw
markdown) so the fallback still looks reasonable. The separate "copy mrkdwn" button is simpler: it only
ever needs to write `text/plain` (the mrkdwn string) via the same API (or a plainer fallback path — see
below), for pasting into `chat.postMessage`/Block Kit/webhooks/bots/Workflow Builder inputs, none of
which interpret HTML.

**Platform requirements/caveats (stable browser-platform behavior, not version-specific numbers):**
- **Secure context (HTTPS) required.** `navigator.clipboard.write` does not work on plain HTTP (localhost
  is exempted for development). GitHub Pages serves HTTPS by default, so the recommended hosting choice
  (see Architecture Decision: Static Hosting) satisfies this automatically for the web app.
- **User-gesture requirement.** The write should happen synchronously inside a user-gesture handler (a
  button's `click` listener) — deferring it behind an unrelated `async`/`setTimeout` chain risks the
  browser rejecting or silently no-op'ing the write in some implementations.
- **Feature detection + fallback.** `ClipboardItem` and multi-MIME writes should be feature-detected
  (`window.ClipboardItem && navigator.clipboard?.write`) with a `document.execCommand('copy')` (or manual
  "select all, Ctrl+C") fallback, particularly for the plain-mrkdwn button, since a plain-text-only copy
  has broader legacy-browser fallback options than the rich-HTML write.

**Web page vs. Chrome MV3 extension context — key difference:**
- **Plain web page:** no manifest/permission entry needed; the browser may show a one-time permission
  prompt for clipboard-write in some browsers, but Chrome generally auto-grants a clipboard-write call
  that is directly triggered by a user gesture, without a prompt.
- **MV3 extension:** if the write happens inside the extension's own popup or side-panel page (an
  ordinary DOM document with its own user-gesture context), it behaves like a regular web page write.
  Declaring `"permissions": ["clipboardWrite"]` in `manifest.json` is the traditionally documented,
  safest choice to guarantee the capability and signal intent during store review, even though current
  Chrome may not strictly require it for a same-page, gesture-triggered write. A write attempted from a
  background service worker (no DOM, no user gesture) would **not** work reliably — this is a concrete
  reason the copy-button click handler must live in the popup/side-panel UI itself, never proxied through
  the background script.

**Flag for build-time verification (do not treat the above browser-version specifics as final):** re-check
the current MDN Clipboard API page and the current Chrome extension permissions documentation at
implementation time, since clipboard permission behavior has changed across Chrome versions historically
and should be confirmed against official docs rather than this discovery note before shipping.

## Architecture Decision: Chrome Extension Architecture (Manifest V3)

**Popup vs. Side Panel:**
- **Popup (`action.default_popup`):** a small transient overlay anchored to the toolbar icon that closes
  as soon as it loses focus — including when the user alt-tabs/clicks into the very Slack window they
  intend to paste into. This is a direct conflict with this tool's core workflow (compose → switch to
  Slack → paste), making a popup's auto-close-on-blur behavior a real UX risk here, not a cosmetic one.
- **Side panel (`chrome.sidePanel`, MV3-only, Chrome 114+):** stays docked open beside page content while
  the user switches tabs and interacts with other windows, which matches the actual usage pattern (keep
  the converter open, alt-tab to Slack, paste, come back) far better than a popup. Also offers more
  vertical space for a two-pane markdown-in/preview-out layout. Requires the `"sidePanel"` permission and
  a `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` (or `setOptions`) call.

**Recommendation:** side panel as the primary UI surface, given the interaction pattern above. Keep a
plain popup as a documented fallback design if a build-time prototype reveals side-panel API friction
(Chrome-version gating below 114, or programmatic-open constraints tied to user gestures) — this is
explicitly a "validate with a quick prototype" decision point, not a settled fact.

**Sharing UI between web and extension:** the extension cannot load the live website URL inside its
popup/panel — MV3's default CSP disallows remote-hosted scripts in extension pages, and doing so would
also reintroduce a network dependency, undermining the "runs entirely in your browser, nothing uploaded"
claim this product must preserve. Instead, both `apps/web` and `apps/extension` are separate Vite build
targets that each import the same `@mdforslack/core` package (see Architecture Decision: Monorepo Shape)
and bundle their own small UI shell locally — logic is shared via the package, not via loading one app
inside the other.

**Manifest V3 permissions — keep minimal:** `"action"` and (if side panel is used) `"sidePanel"`; likely
`"clipboardWrite"` per the Clipboard API note above. No `"host_permissions"` and no `"activeTab"` are
needed since the tool never reads the current page's content. No background service worker is required
if all logic runs inside the popup/side-panel document itself. Minimal permissions matter concretely here:
fewer permissions means less scary install-time permission text for users and a smoother Chrome Web Store
review (see External Research: Chrome Web Store Publishing Requirements).

## Architecture Decision: Static Hosting

**Decision:** GitHub Pages as the primary hosting target for `apps/web`, deployed via a GitHub Actions
workflow that builds on push to the main branch and publishes `apps/web/dist`.

**Why GitHub Pages over Cloudflare Pages / Netlify / Vercel:** the explicit product goal (approved by the
user) is resilience against a repeat of the marktoslack.com shutdown — a single company/site disappearing
and taking the tool with it. GitHub Pages hosts directly from the same OSS repository that holds the
source: the site and its source live in one forkable place, so if the canonical URL ever needs to move,
anyone can fork the repo and get Pages serving a working mirror with no separate hosting account or
billing relationship to set up first. Cloudflare Pages/Netlify/Vercel are all free-tier-viable and
technically capable, but each is a distinct third-party company whose own policy/business changes are the
exact risk category being designed against, and — critically — forking the GitHub repo does not
automatically produce a working deployment on any of them without also separately recreating an account
there. GitHub Pages is the one option where "fork the repo" and "have a working site" are close to the
same action.

**Prerequisite this satisfies:** HTTPS by default (GitHub Pages serves over HTTPS out of the box), which
the Clipboard API's secure-context requirement (see External Research: Clipboard Write Mechanism) needs
regardless of hosting choice.

**Custom domain:** optional; not required for the MVP. If added later, it is an independent DNS-level
choice that doesn't change the underlying resilience rationale (the repo + Pages pairing is what matters).

## Technology Choice: Build Tooling

**Decision:** Vite + TypeScript + Vitest across all three packages, npm as the package manager/workspace
tool, ESLint + `@typescript-eslint` for linting.

- **Vite:** fast dev server and production build with native TypeScript and ESM support; minimal config
  for a small app. Both `apps/web` and `apps/extension` can be separate Vite build targets. For the
  extension's multi-page needs (popup or side-panel HTML, optional background worker), either:
  - evaluate the community `@crxjs/vite-plugin` first — it automates MV3 manifest handling and asset
    copying and supports HMR during extension development, removing a fair amount of MV3-specific Vite
    boilerplate; **flag:** verify its current maintenance status and Vite-version compatibility at
    build time, since third-party plugin maintenance can lapse between major Vite versions; or
  - fall back to a manual multi-entry Vite config (`build.rollupOptions.input` listing each HTML entry)
    plus `vite-plugin-static-copy` to place `manifest.json` and icons into the build output, if the
    plugin route doesn't fit cleanly.
- **TypeScript:** highest-value where the conversion module walks the mdast AST — a `switch` over a
  discriminated union of node types can be checked exhaustively at compile time (see Technology Choice:
  Markdown Parsing Approach).
- **Vitest:** shares Vite's config/transform pipeline, Jest-compatible API, fast. This is the primary
  quality gate for the project: the 14-row conversion table is the core product value and is highly
  testable — each row plus a handful of composition/edge cases (nested emphasis, links inside lists,
  nested bullet depth) should become a Vitest unit test in `packages/core`.
- **npm workspaces:** consistent with the "keep it simple" directive from the brief — no extra global
  tool install beyond Node.js itself (see Architecture Decision: Monorepo Shape for the workspace layout).
- **ESLint + `@typescript-eslint`:** the standard pairing for a small TS project; keep the rule set to
  the recommended presets rather than a large custom configuration, matching the project's small scope.

## External Research: Chrome Web Store Publishing Requirements

High-level facts stable enough to state here; anything numeric/time-sensitive is explicitly flagged
rather than stated as fact, per the brief's instruction not to fabricate possibly-stale specifics.

- **Developer registration:** publishing to the Chrome Web Store requires a one-time developer
  registration tied to a Google account, historically involving a one-time registration fee.
  **Verify the current exact fee against the official Chrome Web Store developer dashboard/docs at
  publish time** — this figure has changed in the past and should not be treated as fixed from this note.
- **Privacy policy is required even for a zero-network-calls tool.** Every listed extension must complete
  the store's Privacy Practices disclosure and, in practice, provide a privacy policy URL — regardless of
  whether the extension collects any data. For MDforSlack this is straightforward to satisfy honestly:
  the disclosure and policy can state plainly that the extension collects no user data and performs all
  conversion locally in the browser, which directly substantiates the product's own privacy claim
  ("nothing is uploaded to a server") rather than conflicting with it.
- **Manifest V3 is mandatory for new submissions** — Manifest V2 has been phased out for new extension
  submissions/support. This confirms the brief's MV3 assumption is a current platform requirement, not
  merely a preference.
- **Listing assets needed as deliverables** (not just code): extension name/description text, an icon
  set (commonly multiple sizes, e.g. 16/48/128px), at least one screenshot, and a short promotional
  description. These should be planned as part of the extension-packaging unit's scope.
- **Review turnaround time varies** and is explicitly **not** stated as a number here — verify current
  review-time guidance in the official Chrome Web Store developer documentation at the time of
  submission.
- **Minimal permissions favor smoother review:** the architecture recommended above (no
  `host_permissions`, no `activeTab`, no background service worker) avoids the additional review
  scrutiny and alarming install-time permission text that broader permissions can trigger.

## Quality Gate Candidates

Greenfield project with no existing tooling yet — these are proposed defaults for a
TypeScript + Vite + Vitest + npm-workspaces project, to be confirmed with the user after discovery.

| Gate | Command | Source |
|---|---|---|
| tests | `npm test` (runs `vitest run` in `packages/core`, and any UI-level tests added later) | root `package.json` script, delegating to workspace packages |
| lint | `npm run lint` (`eslint .`) | root `package.json` script |
| typecheck | `npm run typecheck` (`tsc --noEmit` across workspaces, e.g. via `tsc -b`) | root `package.json` script |
| build | `npm run build` (builds `packages/core`, then `apps/web` and `apps/extension` via Vite) | root `package.json` script |

Recommended `quality_gates:` block:

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

No `package.json`/`go.mod`/`Cargo.toml`/etc. currently exist in the repository (greenfield) — these
scripts do not exist yet and must be created as part of the initial project-scaffolding unit; this table
documents the target state to scaffold, not tooling already detected on disk.

## Domain Model

### Entities

- **MarkdownDocument**: the raw text a user types or pastes into the input field. Fields: `rawText`.
- **ConversionAst**: the parsed `mdast` tree produced by `remark` + `remark-gfm` from a `MarkdownDocument`.
  Fields: `type: "root"`, `children` (nodes of kinds: `heading`, `paragraph`, `strong`, `emphasis`,
  `delete` (strikethrough), `link`, `image`, `list`, `listItem`, `table`, `tableRow`, `tableCell`,
  `blockquote`, `code` (fenced), `inlineCode`, `thematicBreak`, `text`).
- **ConversionRule**: one row of the extracted Markdown→mrkdwn mapping table (Heading, Bold, Italic,
  Strikethrough, Link, Image, Bullet list, Numbered list, Task list, Blockquote, Inline code, Code
  block, Table, Divider). Fields: `markdownPattern`, `mrkdwnOutput`, `htmlOutput`, `notes`. This is the
  authoritative behavior spec each AST node kind must satisfy; it is documentation/test-fixture data, not
  a runtime object.
- **SlackMrkdwnOutput**: the plain-text Slack mrkdwn string produced by rendering a `ConversionAst`.
  Fields: `text`.
- **SlackHtmlFragment**: the Slack-paste-compatible rich-text HTML string produced by rendering the same
  `ConversionAst` (e.g. `<b>`, `<i>`, `<a href>`, `<ul>/<li>`, `<pre>` — real semantic HTML that Slack's
  contenteditable composer interprets on paste). Fields: `html`.
- **ClipboardPayload**: the dual-MIME-type object written to the OS clipboard on "Copy for Slack." Fields:
  `htmlBlob` (`text/html`, from `SlackHtmlFragment`), `textBlob` (`text/plain`, from `SlackMrkdwnOutput`).
- **CoreConversionModule** (`@mdforslack/core`): exposes `parse(markdown: string): ConversionAst`,
  `toMrkdwn(ast): SlackMrkdwnOutput`, and `toSlackHtml(ast): SlackHtmlFragment` — one parse, two renderers.
- **WebApp** (`apps/web`): the static-site UI shell wrapping `CoreConversionModule` for browser users.
- **ExtensionPanel** (`apps/extension`): the Chrome MV3 popup/side-panel UI shell wrapping the same
  `CoreConversionModule` inside the browser extension context.

### Relationships

- A `MarkdownDocument` is parsed by `CoreConversionModule` into exactly one `ConversionAst`.
- One `ConversionAst` is rendered by `CoreConversionModule` into one `SlackMrkdwnOutput` and one
  `SlackHtmlFragment` — a single parse feeds two renderers, so the two outputs never drift from each
  other's interpretation of the source.
- Each node in a `ConversionAst` corresponds to exactly one `ConversionRule` (the node kind determines
  which spec row governs its rendering in both renderers).
- A `ClipboardPayload` wraps one `SlackHtmlFragment` + one `SlackMrkdwnOutput` together, for the "Copy for
  Slack" action only.
- The "copy mrkdwn" action uses a `SlackMrkdwnOutput` alone (no `ClipboardPayload`/HTML involved).
- `WebApp` and `ExtensionPanel` each depend on `CoreConversionModule` directly; they have no dependency
  on each other.

### Data Sources

- **Extracted conversion table** (from the saved MHTML's own on-page cheat sheet) — type: static
  functional-spec reference, not a live API.
  - Available: a definitive mapping for all 14 documented element types (heading, bold, italic,
    strikethrough, link, image, bullet/numbered/task list, blockquote, inline code, code block, table,
    divider).
  - Missing: exhaustive edge-case behavior — the table documents intended per-element happy-path
    behavior, not composition (e.g. bold containing italic) or malformed input (an unterminated code
    fence).
  - Real sample: see the "Conversion table" reproduced in the brief at
    `.ai-dlc/md-for-slack/.briefs/elaborate-discover.md` — e.g. `**bold**` → `*bold*`;
    `[label](url)` → `<url|label>`; `- item` → `• item` (◦/▪ when nested).
- **mdast + remark-gfm node taxonomy** — type: versioned open-source library API/spec (stable, documented).
  - Available: canonical AST node shapes for every construct the table needs; GFM extensions
    (strikethrough, tables, task lists) are exactly the non-CommonMark rows in the table, and
    `remark-gfm` covers all three in one plugin.
  - Missing: nothing for the documented feature set — the chosen library combination already covers
    every row in the extracted table with no additional plugins needed.

### Data Gaps

- **Gap:** the extracted spec table does not define behavior for nested/combined formatting (e.g.
  `**bold _and italic_**`) or malformed input (unterminated code fences, unmatched brackets).
  **Resolution:** defer to `remark`/`remark-gfm`'s own deterministic CommonMark+GFM parsing behavior for
  anything the extracted table doesn't explicitly cover, rather than inventing bespoke rules; the unit
  test suite should include a handful of these composition cases as regression tests, treating the
  library's natural output as the source of truth.
- **Gap:** Slack's own rich-text-paste HTML acceptance (which tags/attributes its contenteditable
  composer's sanitizer accepts) is undocumented publicly by Slack and cannot be verified against any
  spec, table, or library. **Resolution:** this must be a manual, human-verified acceptance step during
  the build unit — paste real generated HTML into an actual Slack client (web or desktop) and confirm it
  renders as intended — flagged explicitly as not coverable by unit tests alone.

## UI Mockup: Web App Main View

**Source:** collaborative (no existing designs — greenfield UI decided during discovery)

### Layout
```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ MDforSlack — paste-ready Slack formatting, 100% in your browser                                 │
├────────────────────────────────────────────────┬────────────────────────────────────────────────┤
│ Markdown Input                                 │ Slack Preview                                  │
├────────────────────────────────────────────────┼────────────────────────────────────────────────┤
│ # Release Notes                                │ *Release Notes*                                │
│                                                │                                                │
│ - **Fixed** login bug                          │ • *Fixed* login bug                            │
│ - _Improved_ load time                         │ • _Improved_ load time                         │
│                                                │                                                │
│ See [changelog](https://x.io/log)              │ See <https://x.io/log|changelog>               │
│                                                │                                                │
│ (cursor here, typing...)                       │ (updates live as you type)                     │
├────────────────────────────────────────────────┴────────────────────────────────────────────────┤
│ [ Copy for Slack ]   [ Copy mrkdwn ]                           Free · No sign-up · Runs locally │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Interactions
- Markdown Input (left pane): plain `<textarea>`; on every keystroke (debounced), re-runs `CoreConversionModule.parse` + both renderers.
- Slack Preview (right pane): read-only, live-updating rendering of the current `SlackMrkdwnOutput`/`SlackHtmlFragment` — shown as styled text so the user can visually confirm formatting before copying, not as raw mrkdwn syntax.
- [ Copy for Slack ]: on click, writes a `ClipboardPayload` (text/html + text/plain) via `navigator.clipboard.write`; shows a brief "Copied!" confirmation state. Falls back to a plain-text-only copy path with a visible notice if `ClipboardItem`/multi-MIME write is unsupported.
- [ Copy mrkdwn ]: on click, writes only the `SlackMrkdwnOutput` plain text; shows the same brief confirmation pattern.
- Empty input state: preview pane shows a light placeholder (e.g. "Your Slack-ready preview will appear here") rather than an empty box.
- Error/edge state: unterminated code fences or malformed input still render best-effort output per remark's own recovery behavior (see Domain Model — Data Gaps); no blocking error state, since this is a live-typing tool.

### Data Mapping
- Markdown Input pane ← `MarkdownDocument.rawText`
- Slack Preview pane ← `SlackMrkdwnOutput.text` (rendered visually) / `SlackHtmlFragment.html` (what the pane actually visually renders, since it should look like the Slack-formatted result, not the raw mrkdwn string)
- [ Copy for Slack ] ← `ClipboardPayload` (both `SlackHtmlFragment` and `SlackMrkdwnOutput`)
- [ Copy mrkdwn ] ← `SlackMrkdwnOutput.text` only

## UI Mockup: Extension Side Panel View

**Source:** collaborative (no existing designs — greenfield UI decided during discovery)

### Layout
```
┌──────────────────────────────────────────────┐
│ MDforSlack                                   │
├──────────────────────────────────────────────┤
│ Markdown Input                               │
│ ┌──────────────────────────────────────────┐ │
│ │ # Release Notes                          │ │
│ │                                          │ │
│ │ - **Fixed** login bug                    │ │
│ │ - _Improved_ load                        │ │
│ │   time                                   │ │
│ └──────────────────────────────────────────┘ │
├──────────────────────────────────────────────┤
│ Slack Preview                                │
│ ┌──────────────────────────────────────────┐ │
│ │ *Release Notes*                          │ │
│ │                                          │ │
│ │ • *Fixed* login bug                      │ │
│ │ • _Improved_ load                        │ │
│ │   time                                   │ │
│ └──────────────────────────────────────────┘ │
├──────────────────────────────────────────────┤
│ [ Copy for Slack ]                           │
│ [ Copy mrkdwn ]                              │
├──────────────────────────────────────────────┤
│ Runs locally · no data sent                  │
└──────────────────────────────────────────────┘
```

### Interactions
- Stacked single-column layout (input above, preview below) rather than the web app's side-by-side
  panes — the side panel is narrow (docked beside browser content), so vertical stacking fits the
  available width better than a two-column layout would.
- Same live-update-on-keystroke and copy-button behavior as the web app (see UI Mockup: Web App
  Main View) — both surfaces share `CoreConversionModule`, so the underlying conversion behavior is
  identical; only the layout differs to fit the panel's dimensions.
- Clicking the extension's toolbar icon opens/closes this side panel
  (`chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`); unlike a popup, it stays
  open while the user switches tabs/windows to paste into Slack (see Architecture Decision: Chrome
  Extension Architecture).
- Footer note ("Runs locally · no data sent") reinforces the no-network-calls privacy claim inside
  the extension surface as well as the web surface.

### Data Mapping
- Markdown Input box ← `MarkdownDocument.rawText`
- Slack Preview box ← `SlackHtmlFragment.html` (rendered visually, same as the web app)
- [ Copy for Slack ] ← `ClipboardPayload`
- [ Copy mrkdwn ] ← `SlackMrkdwnOutput.text`
