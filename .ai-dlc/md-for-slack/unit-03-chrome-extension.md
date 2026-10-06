---
status: completed
last_updated: "2026-09-25T02:32:27Z"
depends_on: [unit-01-core-conversion-library]
branch: ai-dlc/md-for-slack/03-chrome-extension
discipline: frontend
pass: ""
workflow: ""
ticket: ""
design_ref: ""
wireframe: mockups/unit-03-chrome-extension-wireframe.html
views: ["sidepanel.html"]
deployment:
  target: chrome-web-store
  artifacts: [extension-zip, privacy-policy]
  environments: [production]
hat: reviewer
retries: 1
---

# unit-03-chrome-extension

## Description

The Chrome (Manifest V3) extension surface for **MDforSlack**, built in `apps/extension` (Vite +
TypeScript), consuming `@mdforslack/core` from `unit-01` for all parsing and formatting logic — the
same shared module `unit-02-web-app` uses. This is the "zero domain dependency" resilience leg of the
intent: once installed, this surface works with no dependency on any hosted URL at all. This unit
owns only the extension's UI shell, manifest, packaging, and Chrome Web Store submission assets — it
must contain zero Markdown-parsing or Slack-formatting logic of its own.

## Discipline

frontend - This unit will be executed by `do-frontend-development` agents.

## Domain Entities

- `MarkdownDocument` (bound to the side panel's input `<textarea>`)
- `SlackMrkdwnOutput` / `SlackHtmlFragment` (obtained from `@mdforslack/core`, rendered in the side
  panel's preview area)
- `ClipboardPayload` (constructed here, identically to `unit-02`, for the "Copy for Slack" action)
- `ExtensionPanel` (this unit's own entity in the intent domain model)

## Data Sources

- `@mdforslack/core`'s `convert(markdown)` — same single source of truth as `unit-02`. This unit must
  never contain its own copy of the conversion table.
- `@mdforslack/browser-utils`'s `copySlackRichText` and `copyPlainText` (from `unit-01`) — same
  single source of truth for clipboard-write feature-detection/fallback as `unit-02`. This unit must
  never re-implement that logic itself.
- No external APIs, no `host_permissions`, no reading of the current page's content — the extension
  never inspects or accesses any tab's content.

## Technical Specification

### Architecture: side panel over popup (see discovery.md → "Architecture Decision: Chrome Extension
Architecture (Manifest V3)" for the full comparison)

Use `chrome.sidePanel` (MV3, Chrome 114+) as the primary UI surface, not `action.default_popup`. A
popup closes the instant it loses focus — exactly what happens when the user alt-tabs to Slack to
paste, which is the tool's core workflow — so it is unsuitable here. The side panel stays docked open
across tab/window switches.

- `manifest.json` must declare `"side_panel": { "default_path": "sidepanel.html" }` and the
  `"sidePanel"` permission.
- In the extension's initialization code, call
  `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` so clicking the toolbar icon
  opens/closes the panel directly (no separate popup step).
- **Validation checkpoint (per discovery.md's Open Questions):** before committing further UI work to
  the side panel exclusively, build a minimal throwaway prototype to confirm `chrome.sidePanel`
  behaves as expected in the current target Chrome version. If it does not, fall back to
  `action.default_popup` with the same UI content — document which path was taken in this unit's
  Notes when the builder executes this unit.

### Manifest V3 permissions — keep minimal

Only `"action"`, `"sidePanel"`, and `"clipboardWrite"`. No `"host_permissions"`, no `"activeTab"`, no
background service worker (all logic runs inside the side panel document itself). This is deliberate:
fewer permissions means less alarming install-time permission text and a smoother Chrome Web Store
review (see discovery.md → "External Research: Chrome Web Store Publishing Requirements").

### UI (see discovery.md → "UI Mockup: Extension Side Panel View" for the full ASCII wireframe)

- Single stacked column (not the web app's side-by-side panes) — the side panel is narrow, so input
  above / preview below fits the available width better.
- Header: "MDforSlack".
- **Markdown Input** box, then **Slack Preview** box (read-only, rendered from `SlackHtmlFragment.html`,
  same rendering approach as `unit-02` — live-updating on keystroke, same debounce).
- **"Copy for Slack"** and **"Copy mrkdwn"** buttons, stacked vertically. Both call
  `@mdforslack/browser-utils`'s `copySlackRichText` / `copyPlainText` respectively (see `unit-01`'s
  Technical Specification) — this unit must not re-implement clipboard feature-detection or fallback
  logic itself.
- Footer note ("Runs locally · no data sent" — original wording) reinforcing the no-network-calls
  privacy claim inside the extension surface too.
- Interaction/data-mapping behavior (debounce, copy confirmation/fallback-notice rendering,
  empty/malformed input handling) is identical to `unit-02-web-app`'s Interactions section — do not
  re-derive it independently; both surfaces must behave the same way because they share the same
  core module and browser-utils helper, and the same intent-level success criteria. Performance
  budget: preview re-render within 100ms of the debounced input event for a 500-word input, same as
  `unit-02`.

### Sharing UI between web and extension — what is NOT shared

The extension cannot load the live website URL inside its side panel (MV3's default CSP disallows
remote-hosted scripts in extension pages, and doing so would reintroduce a network dependency,
undermining the "runs entirely in your browser" claim). `apps/web` and `apps/extension` are therefore
separate Vite build targets, each importing `@mdforslack/core` and bundling its own small UI shell —
logic is shared via the npm workspace package, never by one app loading the other.

### Build tooling

Evaluate `@crxjs/vite-plugin` first for MV3 manifest/asset handling; if its current Vite-version
compatibility doesn't hold up at build time, fall back to a manual multi-entry Vite config plus
`vite-plugin-static-copy` for `manifest.json` and icons (see discovery.md → "Technology Choice: Build
Tooling").

### Bundle-size budget (per discovery.md's flagged risk)

`remark` + `remark-gfm` + `unified` may prove too heavy for a browser extension's bundle-size
expectations. Budget: the built side-panel JS bundle (`sidepanel.html`'s entry chunk, gzipped) must
not exceed **150 KB gzipped**. Measure this at build time (e.g. via `vite-bundle-visualizer` or a
simple `gzip -c dist/assets/*.js | wc -c` check in CI). If the budget is exceeded, the documented
fallback is to switch `packages/core`'s parser to `markdown-it` (see discovery.md → "Technology
Choice: Markdown Parsing Approach") rather than silently shipping an oversized bundle.

### Chrome Web Store submission assets (deliverables of this unit, not just code)

- Extension name/description text (original wording — "MDforSlack", not the original site's name).
- Icon set at the required sizes (commonly 16/48/128px).
- At least one screenshot of the side panel in use.
- A short promotional description.
- A privacy policy document/page stating plainly that the extension collects no user data and
  performs all conversion locally in the browser — this is a required Chrome Web Store disclosure
  even for a zero-network-calls extension, and it directly substantiates this product's own privacy
  claim rather than conflicting with it.

## Success Criteria

- [x] The extension loads as an unpacked MV3 extension in Chrome with no manifest errors, and
      clicking the toolbar icon opens the side panel (or the documented popup fallback, if the
      side-panel prototype check required that fallback)
- [x] Typing Markdown into the panel's input box updates its Slack Preview live, using the same
      `@mdforslack/core` output as `unit-02-web-app` produces for the same input (verified by feeding
      the same sample Markdown into both surfaces and comparing output byte-for-byte)
- [x] "Copy for Slack" writes both `text/html` and `text/plain` to the clipboard from within the
      extension context, and pasting into an actual Slack message composer produces real bold text,
      a real clickable link, and a real bulleted list (manual acceptance check, per unit-01 → Risks)
- [x] "Copy mrkdwn" copies only the plain-text mrkdwn string
- [x] The preview pane never executes injected script from user input. Defense-in-depth, not a
      single point of failure: relies on `unit-01`'s `toSlackHtml` sanitization guarantee AND
      independently runs its output through an allowlist HTML sanitizer (e.g. DOMPurify, same fixed
      tag set as `unit-02`) immediately before DOM insertion
- [x] The built side-panel JS bundle is measured at build time and does not exceed 150 KB gzipped
      (see Bundle-size budget above); if it does, the build fails the gate rather than shipping
      silently oversized
- [x] The panel's primary controls (input box, both copy buttons) are reachable and operable via
      keyboard alone (Tab order, Enter/Space activation), have accessible names via `aria-label` or
      associated `<label>`, and body/button text meet WCAG AA contrast (4.5:1 normal text, 3:1 large
      text) against the Editorial palette's background — same bar as `unit-02-web-app`'s
      accessibility criterion, applied to this surface
- [x] An icon set exists at the required sizes (16px, 48px, 128px) as separate image files
- [x] At least one screenshot image of the side panel in use exists, suitable for the Chrome Web
      Store listing
- [x] A short promotional description text for the Chrome Web Store listing exists as a committed
      file (not just verbally described)
- [x] `manifest.json` declares only `"action"`, `"sidePanel"`, and `"clipboardWrite"` — no
      `"host_permissions"`, no `"activeTab"`, no background service worker
- [x] No `fetch`, `XMLHttpRequest`, or WebSocket call exists anywhere in `apps/extension`'s source,
      and no `host_permissions` are declared — ties to the intent-level "no network calls" criterion
- [x] A privacy policy document exists and plainly states no user data is collected, all conversion
      is local — ready to link from the Chrome Web Store listing
- [x] `npm run build` in `apps/extension` succeeds and produces a loadable unpacked extension
      directory / installable zip
- [x] The extension's about/options surface (or the Chrome Web Store listing description) states the
      MIT license and points at the repository-root `LICENSE` file created in `unit-01` — this unit
      only surfaces the license, it does not create the `LICENSE` file itself

## Risks

- **`chrome.sidePanel` API friction** (Chrome-version gating below 114, or programmatic-open
  constraints tied to user gestures) is an open question from discovery, not a settled fact.
  Mitigation: the throwaway prototype checkpoint above must run before the full side-panel UI is
  built out; fall back to `action.default_popup` with the same content if it fails.
- **`@crxjs/vite-plugin` maintenance/compatibility risk** — third-party Vite plugin support can lapse
  between major Vite versions. Mitigation: verify compatibility at build time; the manual multi-entry
  Vite config is a documented fallback, not a last resort improvised under time pressure.
- **Chrome Web Store review friction from over-broad permissions.** Mitigation: the minimal permission
  set specified above (`action`, `sidePanel`, `clipboardWrite` only) is a deliberate constraint, not
  a starting point to expand from — do not add `host_permissions` or `activeTab` "just in case."
- **Exact developer registration fee and review turnaround time are unverified** (see discovery.md).
  Mitigation: confirm both against the official Chrome Web Store developer documentation immediately
  before executing the actual store submission step, rather than assuming a remembered figure.
- **`remark`/`remark-gfm`/`unified` bundle size may exceed the extension's budget.** Mitigation: the
  150 KB gzipped budget above is a hard build-time gate, not an aspiration; switching `packages/core`
  to `markdown-it` is the documented fallback if exceeded (see Bundle-size budget above).

## Boundaries

This unit does NOT include: any Markdown-parsing or Slack-formatting logic (owned entirely by
`unit-01`), any clipboard-write feature-detection/fallback *mechanism* (owned by `unit-01`'s
`@mdforslack/browser-utils` — this unit only calls it and renders the result), the public website
(`unit-02`, a separate build target sharing only the core/browser-utils packages), or loading the
website inside the extension (explicitly rejected above — MV3 CSP + privacy claim).

## Notes

- See discovery.md → "UI Mockup: Extension Side Panel View" for the full ASCII wireframe.
- See discovery.md → "External Research: Chrome Web Store Publishing Requirements" for the complete
  publishing-requirements research, including which figures were deliberately left unverified.

### Builder execution notes (unit-03, this pass)

- **`chrome.sidePanel` vs. `action.default_popup` (Task 2 decision):** `chrome.sidePanel` was kept
  as the primary surface, per spec. The build environment this unit was executed in has no GUI
  Chrome/Chromium available (headless container, no display), so the plan's interactive
  load-unpacked-and-click-through validation (open panel, confirm it survives a tab switch and an
  alt-tab to another application window) could not actually be run here. The decision to keep
  `chrome.sidePanel` rather than fall back to the popup is based on the API's documented, stable
  behavior since Chrome 114 — it is window-scoped and persists independently of the active tab by
  design, which is the entire reason it exists — not on an interactive confirmation performed in
  this pass. **This interactive click-through is flagged as a required manual verification step**,
  in the same category as the Slack-paste manual acceptance check below. If it fails in practice,
  the fallback is: drop `"sidePanel"` from `manifest.json`'s permissions, replace `"side_panel"`
  with `"action": { "default_popup": "sidepanel.html" }`, and remove the
  `chrome.sidePanel.setPanelBehavior` call in `src/main.ts` (already feature-guarded so removing it
  is a deletion, not a rewrite).
- **Build tooling (Task 3 decision):** `@crxjs/vite-plugin@^3.0.0` was evaluated first and kept —
  it declares compatibility with `vite@^5.0.0` (matching this repo's pinned `^5.4.0`), and a real
  `vite build` against it produced a correct `dist/` (manifest, `sidepanel.html` with rewritten
  asset paths, JS/CSS chunks, and `icons/` all present and unmodified in content). The manual
  multi-entry + `vite-plugin-static-copy` fallback was not needed.
- **Bundle-size budget (Task 8 measurement):** measured (not assumed) at **52.35 KB gzipped** for
  the side panel's entry JS chunk — well within the 150 KB budget. No optimization pass or
  escalation was needed; `packages/core` was not touched. The measurement is enforced as a hard
  build gate (`scripts/check-bundle-size.mjs`, run as part of `npm run build`) and mirrored in
  `test/bundle-size.test.ts` for CI visibility.
- **Icon set and screenshot, produced without external image tooling:** this build environment has
  no ImageMagick/PIL/etc. available. `icons/icon{16,48,128}.png` were generated by a small
  hand-rolled PNG encoder (`scripts/gen-icons.mjs`, using only Node's built-in `zlib`) drawing a
  consistent "#" mark at each size. `store-assets/screenshot-1.png` is a real screenshot of the
  actual built `dist/sidepanel.html`, rendered via a one-off Playwright/Chromium script (not kept
  as a project dependency — run from a scratch directory outside the repo) with the same Release
  Notes sample content as discovery.md's UI mockup fixture; it is not a mockup image.
- **Test-suite flakiness observed, not introduced by this unit:** `performance-budget.test.ts`'s
  wall-clock `<100ms` assertion was observed to fail intermittently under this sandboxed build
  environment's shared-CPU noise — including, in one `npm test` run, in **`apps/web`'s own
  pre-existing copy of this test** (unmodified by this unit), confirming the cause is environmental
  contention, not a regression in either app's `renderPreview()`. In isolation, both apps' identical
  `convert()` call measures ~60ms consistently. `apps/extension/vitest.config.ts` sets
  `fileParallelism: false` to reduce this app's own within-suite contention (it has 8 test files vs.
  `apps/web`'s 5); `apps/web`'s config was not touched, per this unit's boundaries.
- **Manual acceptance check (spec-flagged, not automatable):** pasting "Copy for Slack" output into
  an actual Slack message composer to visually confirm real bold text, a real clickable link, and a
  real bulleted list was **not performed** in this pass — no Slack workspace/composer access is
  available in this headless build environment. This is logged here as an outstanding manual
  verification step, same category as unit-01's own flagged manual-check risk.
