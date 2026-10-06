---
status: completed
last_updated: "2026-09-25T01:59:19Z"
depends_on: [unit-01-core-conversion-library]
branch: ai-dlc/md-for-slack/02-web-app
discipline: frontend
pass: ""
workflow: ""
ticket: ""
design_ref: ""
wireframe: mockups/unit-02-web-app-wireframe.html
views: ["/"]
deployment:
  target: static-site
  artifacts: [github-actions-workflow]
  environments: [production]
hat: reviewer
---

# unit-02-web-app

## Description

The public static website for **MDforSlack** — a single-page, two-pane Markdown→Slack converter,
built in `apps/web` (Vite + TypeScript), consuming `@mdforslack/core` from `unit-01` for all parsing
and formatting logic. This unit owns only the UI shell, live preview rendering, clipboard-write
wiring, visual design (Editorial archetype), accessibility, and its own deployment to GitHub Pages —
it must contain zero Markdown-parsing or Slack-formatting logic of its own.

## Discipline

frontend - This unit will be executed by `do-frontend-development` agents.

## Domain Entities

- `MarkdownDocument` (bound to the input `<textarea>`'s live value)
- `SlackMrkdwnOutput` / `SlackHtmlFragment` (both obtained from `@mdforslack/core`, used to render the
  live preview pane)
- `ClipboardPayload` (constructed here from the two outputs above for the "Copy for Slack" action)
- `WebApp` (this unit's own entity in the intent domain model)

## Data Sources

- `@mdforslack/core`'s `convert(markdown)` (or `parse`/`toMrkdwn`/`toSlackHtml`) — the only source of
  truth for both output strings. This unit must call it on every input change; it must never contain
  its own copy of the conversion table.
- `@mdforslack/browser-utils`'s `copySlackRichText` and `copyPlainText` (from `unit-01`) — the only
  source of truth for clipboard-write feature-detection/fallback. This unit must never re-implement
  that logic itself.
- No external APIs, no server, no persisted storage — all state is in-memory React/vanilla-JS
  component state for the current session only.

## Technical Specification

### Layout (see discovery.md → "UI Mockup: Web App Main View" for the full ASCII wireframe and
interaction notes — reproduced in summary here, but treat discovery.md as the canonical reference)

- Header: product name "MDforSlack" + one-line tagline (original wording — do not reuse the original
  site's tagline text).
- Two-pane desktop layout: **Markdown Input** (left, plain `<textarea>`, placeholder text, autofocus)
  and **Slack Preview** (right, read-only, live-updating visual rendering of the Slack-formatted
  result — rendered from `SlackHtmlFragment.html`, sanitized as guaranteed by `unit-01`, not from raw
  mrkdwn text).
- Below the two panes: two buttons, **"Copy for Slack"** and **"Copy mrkdwn"**, plus a small privacy
  note ("Free · No sign-up · Runs locally in your browser" — original wording, not copied from the
  source site).
- Below 768px viewport width: panes stack vertically (input above preview) rather than side-by-side.

### Interactions

- On every keystroke in the input pane (debounced ~150ms), call `@mdforslack/core`'s `convert()` and
  re-render the preview pane from the returned `html`. Performance budget: the preview re-render must
  complete within 100ms of the debounced input event for a 500-word input, measured in a Vitest/
  Playwright timing test — this is the concrete threshold for what earlier drafts called "no visible
  lag."
- Empty-input state: preview pane shows a placeholder message instead of an empty box.
- Malformed/unterminated input (e.g. an unclosed code fence): render whatever `remark`'s own recovery
  produces — no blocking error UI, since this is a live-typing tool (see unit-01 → Risks).
- **"Copy for Slack"**: on click, call `@mdforslack/browser-utils`'s `copySlackRichText(html, mrkdwn)`
  (do not re-implement `ClipboardItem`/feature-detection logic here — see unit-01's shared helper).
  Show a brief "Copied!" confirmation when it resolves `"rich"`; show a visible "only mrkdwn was
  copied" notice when it resolves `"plain-fallback"`.
- **"Copy mrkdwn"**: on click, call `@mdforslack/browser-utils`'s `copyPlainText(mrkdwn)`; same brief
  "Copied!" confirmation pattern as above.

### Visual design

Apply the Editorial design tokens from `.ai-dlc/knowledge/design.md` /
`.ai-dlc/md-for-slack/design-blueprint.md` (serif headings via `--font-heading`, generous whitespace
per `--spacing-section`, warm neutral palette via `--color-*` tokens). All copy/wording/branding must
be original — never copied from marktoslack.com.

### Deployment

- Build via Vite (`npm run build` in `apps/web`, producing static `dist/`).
- A GitHub Actions workflow deploys `apps/web/dist` to GitHub Pages on push to the repository's
  default branch. This is the primary "resilience against site closure" mechanism from intent.md —
  the site and its source live in the same forkable repo.
- No custom domain requirement — a `github.io` URL (or the repo's configured Pages URL) is sufficient
  for this intent's success criteria.

## Success Criteria

- [x] Typing Markdown into the input pane updates the Slack Preview pane live, with no page reload,
      and the preview re-render completes within 100ms of the debounced input event for a 500-word
      input (measured in a Vitest/Playwright timing test)
- [x] "Copy for Slack" writes both `text/html` and `text/plain` to the clipboard in one call, and
      pasting into an actual Slack message composer produces real bold text, a real clickable link,
      and a real bulleted list (manual acceptance check — not automatable, see unit-01 → Risks)
- [x] "Copy mrkdwn" copies only the plain-text mrkdwn string, verified by pasting into a plain-text
      field and confirming it matches `@mdforslack/core`'s `toMrkdwn()` output exactly
- [x] All primary controls (input textarea, both copy buttons) are reachable and operable via
      keyboard alone (Tab order, Enter/Space activation), have accessible names via `aria-label` or
      associated `<label>`, and the page's body text / button text meet WCAG AA contrast (4.5:1 normal
      text, 3:1 large text) against the Editorial palette's background
- [x] No `fetch`, `XMLHttpRequest`, or WebSocket call exists anywhere in `apps/web`'s source — grep-
      verifiable, ties to the intent-level "no network calls" criterion
- [x] The preview pane never executes injected script from user input. This is defense-in-depth, not
      a single point of failure: it relies on `unit-01`'s `toSlackHtml` sanitization guarantee AND
      independently runs `toSlackHtml`'s output through an allowlist HTML sanitizer (e.g. DOMPurify
      configured to allow only `b`, `i`, `s`, `del`, `a[href]`, `ul`, `ol`, `li`, `blockquote`,
      `code`, `pre`, `hr` — the same fixed tag set from unit-01) immediately before DOM insertion, so
      a single bug in either layer alone cannot produce a DOM XSS
- [x] `npm run build` in `apps/web` succeeds and a GitHub Actions workflow exists that deploys the
      build output to GitHub Pages on push to the default branch
- [x] The page footer links to (or states) the MIT license, pointing at the repository-root
      `LICENSE` file created in `unit-01` — this unit only surfaces the license, it does not create
      the `LICENSE` file itself

## Risks

- **Clipboard API browser support varies** (multi-MIME `ClipboardItem` write, secure-context
  requirement). Impact: "Copy for Slack" could silently fail on an unsupported/older browser.
  Mitigation: this is handled once, centrally, by `unit-01`'s `@mdforslack/browser-utils` helper
  (feature-detect + fallback + visible notice) — this unit only renders the result, it does not
  re-implement the detection logic (see Interactions above and unit-01's Technical Specification).
- **Live preview must render `SlackHtmlFragment.html`, not raw mrkdwn** — if a builder mistakenly
  renders the mrkdwn string as if it were the final look, the preview will misrepresent what the user
  will get in Slack. Mitigation: this spec explicitly calls out that the preview pane is driven by
  `SlackHtmlFragment.html`, not `SlackMrkdwnOutput.text`.
- **Reusing the original site's exact tagline/copy wording** would risk copyright issues since
  marktoslack.com was a third-party site. Mitigation: all UI copy must be written fresh for
  MDforSlack (this is called out again here because it's an easy mistake to make while working from
  the discovery.md wireframe, which paraphrases rather than dictates exact wording).

## Boundaries

This unit does NOT include: any Markdown-parsing or Slack-formatting logic (owned entirely by
`unit-01`), any clipboard-write feature-detection/fallback *mechanism* (owned by `unit-01`'s
`@mdforslack/browser-utils` — this unit only calls it and renders the result), the Chrome extension
UI (`unit-03`, a separate build target with no shared UI code beyond the imported core/browser-utils
modules), or Chrome Web Store publishing concerns (not applicable to a website).

## Notes

- See discovery.md → "UI Mockup: Web App Main View" for the full ASCII wireframe with exact pane
  labels and button placement.
- See discovery.md → "Architecture Decision: Static Hosting" for the full GitHub Pages rationale.
