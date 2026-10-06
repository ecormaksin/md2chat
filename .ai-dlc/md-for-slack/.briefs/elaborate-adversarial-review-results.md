---
status: success
error_message: ""
findings_count: 12
auto_fixable_count: 7
categories_found: [contradiction, hidden-complexity, assumption, dependency, scope, completeness, boundary]
---

# Adversarial Review Results

## Summary

- **Total findings:** 12
- **Blocking:** 2
- **Warning:** 6
- **Suggestion:** 4
- **Auto-fixable:** 7 (high-confidence with automatable fix_type)

## Categories

- **contradiction:** 2 findings
- **hidden-complexity:** 1 findings
- **assumption:** 2 findings
- **dependency:** 1 findings
- **scope:** 1 findings
- **completeness:** 4 findings
- **boundary:** 1 findings

## Findings

```yaml
- id: F001
  category: contradiction
  confidence: high
  severity: blocking
  affected_units: [intent.md, unit-02-web-app, unit-03-chrome-extension]
  title: "Editorial design-token colors fail the intent's own WCAG AA contrast requirement"
  description: >
    intent.md's accessibility success criterion requires body/button text to meet WCAG AA
    (4.5:1 normal text, 3:1 large text) against the Editorial palette background. Computing
    the standard WCAG relative-luminance contrast formula from design-blueprint.md's own
    documented hex values shows --color-muted (#8a8580, "secondary text, labels") against
    --color-background (#f8f7f4) yields approximately 3.40:1, and --color-accent (#c5a572,
    "secondary highlights, CTAs") against the same background yields approximately 2.18:1.
    Both are below the required 4.5:1 normal-text threshold, and the accent color is even
    below the relaxed 3:1 large-text threshold. Any UI text styled with these tokens as
    currently defined (e.g. the footer privacy note, muted labels, accent-colored CTA text)
    cannot pass the stated AA criterion as written.
  evidence: >
    design-blueprint.md CSS Tokens table: --color-muted #8a8580, --color-accent #c5a572,
    --color-background #f8f7f4. intent.md Success Criteria: "主要テキストのコントラスト比が
    WCAG AA(通常文字4.5:1、大きい文字3:1)を満たす". Computed via the standard WCAG 2.x
    relative-luminance formula: muted-on-background ≈ 3.40:1; accent-on-background ≈ 2.18:1.
  suggested_fix: >
    Darken --color-muted and --color-accent (or restrict their use to non-text/decorative
    roles and large-text-only contexts) until both meet the declared AA thresholds, and add
    a note that any token used for body-size text must be contrast-checked against the
    current background before use in unit-02/unit-03.
  fix_type: spec_edit
  fix_target: design-blueprint.md

- id: F002
  category: contradiction
  confidence: high
  severity: warning
  affected_units: [intent.md, unit-01-core-conversion-library]
  title: "Conversion table has 14 rows but intent.md and discovery.md repeatedly say '13 elements'"
  description: >
    unit-01's conversion table has 14 numbered rows (Heading through Divider, #1-#14), and
    its own Success Criteria say "14 rows minimum" twice. But intent.md's Data Sources
    section says "definitive mapping for 13 documented Markdown element types," and
    intent.md's first Success Criteria bullet literally says "仕様表の13要素すべて" while
    then naming all 14 elements (including 区切り線/Divider) in the same sentence.
    discovery.md's Domain Model -> Data Sources repeats "13 documented element types" too.
    An automated reviewer checking the literal "13" wording against a 14-row implementation
    has a real ambiguity to resolve.
  evidence: >
    unit-01-core-conversion-library.md table rows 1-14 and "14 rows minimum" (Success
    Criteria, both mrkdwn and HTML bullets); intent.md Success Criteria bullet 1:
    "仕様表の13要素すべて...区切り線" (14 named items); intent.md Data Sources: "definitive
    mapping for 13 documented Markdown element types"; discovery.md Data Sources:
    "definitive mapping for all 13 documented element types."
  suggested_fix: >
    Change "13" to "14" in intent.md's Data Sources bullet and Success Criteria bullet 1,
    and in discovery.md's Data Sources section, so the stated count matches the table and
    the "14 rows minimum" criteria in unit-01.
  fix_type: spec_edit
  fix_target: intent.md

- id: F003
  category: hidden-complexity
  confidence: medium
  severity: warning
  affected_units: [unit-01-core-conversion-library]
  title: "Table (row 13) column-alignment algorithm is unspecified"
  description: >
    The spec says GFM tables render as "column-aligned monospace text inside a fenced code
    block" for both mrkdwn and HTML outputs, but never specifies the alignment algorithm:
    whether column width is computed by character count or display width, how multi-byte or
    wide (e.g. CJK) characters or emoji are measured, how cells containing newlines or
    literal `|` characters are handled, or how column widths interact with GFM alignment
    markers (`:---`, `---:`, `:---:`). Unlike the nested-bullet-glyph case (explicitly called
    out in discovery.md as "must be an explicit test case"), no equivalent test or algorithm
    is specified for tables, so two builders could produce differently-padded output that
    each plausibly satisfies the vague wording.
  evidence: >
    unit-01-core-conversion-library.md table row 13: "column-aligned monospace text inside a
    fenced code block" (both mrkdwn and HTML columns), with no further detail anywhere in
    Technical Specification or Success Criteria.
  suggested_fix: >
    Specify the padding algorithm explicitly (e.g. pad by Unicode display width per cell
    using a defined library, or explicitly declare character-count padding as acceptable),
    and add at least one dedicated Vitest case with a fixed expected string for a
    multi-column table, including one using GFM alignment markers.
  fix_type: add_criterion
  fix_target: unit-01-core-conversion-library.md

- id: F004
  category: assumption
  confidence: medium
  severity: suggestion
  affected_units: [unit-01-core-conversion-library, unit-03-chrome-extension]
  title: "remark/remark-gfm bundle-size risk for the extension is flagged but never gated"
  description: >
    discovery.md explicitly flags that remark+remark-gfm+unified's bundle size "may prove
    too heavy for the extension's bundle-size expectations" and names markdown-it as the
    fallback to switch to if so -- but no unit defines what "too heavy" means (no KB budget)
    or includes a Success Criterion that measures bundled size for apps/extension. The
    documented risk therefore has no verification mechanism and could go unnoticed until
    the extension is unusably large.
  evidence: >
    discovery.md -> Technology Choice: Markdown Parsing Approach: "flag it as the
    alternative to switch to if remark+remark-gfm+unified prove too heavy for the
    extension's bundle-size expectations." No corresponding criterion exists in unit-01 or
    unit-03.
  suggested_fix: >
    Add a concrete bundle-size budget (e.g. "extension side-panel bundle <= N KB gzipped")
    to unit-03's Success Criteria, checked at build time, with a documented decision point
    to switch to markdown-it if exceeded.
  fix_type: add_criterion
  fix_target: unit-03-chrome-extension.md

- id: F005
  category: assumption
  confidence: medium
  severity: suggestion
  affected_units: [unit-01-core-conversion-library, unit-02-web-app, unit-03-chrome-extension]
  title: "XSS prevention relies entirely on unit-01's single sanitization layer, with no defense-in-depth in the consuming units"
  description: >
    unit-02 and unit-03's XSS success criteria are satisfied purely by trusting
    toSlackHtml's output and inserting it into the DOM without re-interpreting it as
    script -- but neither unit specifies any second-layer sanitization (e.g. DOMPurify) at
    the point of DOM insertion. Given XSS prevention is an explicit intent-level success
    criterion, a single bug in unit-01's escaping logic would produce a real DOM XSS in
    both consuming surfaces simultaneously, with no independent safety net.
  evidence: >
    unit-02-web-app.md Success Criteria: "reuses unit-01's toSlackHtml sanitization
    guarantee and renders its output via a method that does not re-interpret it as
    executable script"; unit-01-core-conversion-library.md's sanitization requirement is
    the sole stated safeguard; no mention of a second sanitization layer in unit-02 or
    unit-03.
  suggested_fix: >
    Either explicitly document (as an accepted risk) that unit-01's output is the single
    source of truth for HTML safety and is trusted by design, or add a defense-in-depth
    criterion requiring the consuming units to run the HTML through a sanitizer (e.g.
    DOMPurify with a strict allowlist matching unit-01's fixed tag set) before insertion.
  fix_type: manual
  fix_target: ""

- id: F006
  category: dependency
  confidence: high
  severity: blocking
  affected_units: [unit-01-core-conversion-library, unit-02-web-app, unit-03-chrome-extension, intent.md]
  title: "No unit owns creating the npm-workspaces root scaffolding that unit-02/unit-03 and intent.md's quality_gates require"
  description: >
    discovery.md's target directory tree includes a workspace-root package.json (with a
    "workspaces" field), tsconfig.base.json, and (per Technology Choice: Build Tooling) an
    ESLint config -- none of which currently exist (greenfield repo). unit-01's Success
    Criteria only grant it ownership of the root package.json's "license" field ("this
    unit... owns adding the repo-wide license file"), explicitly not broader scaffolding;
    unit-01's own Boundaries section excludes "any build tooling for the apps." No unit's
    Success Criteria mention creating the workspace root config or the four root npm
    scripts (npm test, npm run lint, npm run typecheck, npm run build) that intent.md's
    quality_gates block declares and that unit-02/unit-03's "@mdforslack/core":
    "workspace:*" dependency requires to resolve. Without this, the quality gates that
    drive the build/review loop for every unit have nothing to execute.
  evidence: >
    discovery.md -> Architecture Decision: Monorepo Shape (target tree with root
    package.json/tsconfig.base.json) and -> Quality Gate Candidates table (root npm
    scripts); unit-01-core-conversion-library.md Success Criteria: "...this unit has no
    dependencies and is built first, so it owns adding the repo-wide license file" (license
    only) and Boundaries: "does NOT include: ...any build tooling for the apps"; intent.md
    quality_gates block (tests/lint/typecheck/build).
  suggested_fix: >
    Add an explicit Success Criterion (or short preamble task) to unit-01 -- the only
    dependency-free, first-built unit -- for scaffolding the workspace root: package.json
    with the "workspaces" array and the four delegating npm scripts, tsconfig.base.json,
    and the root ESLint config, distinct from and in addition to its existing license-file
    ownership.
  fix_type: add_criterion
  fix_target: unit-01-core-conversion-library.md

- id: F007
  category: scope
  confidence: medium
  severity: suggestion
  affected_units: [intent.md, unit-03-chrome-extension]
  title: "unit-03's Chrome Web Store submission-asset deliverables are not traceable to any intent-level success criterion"
  description: >
    unit-03's Technical Specification requires producing a full Chrome Web Store submission
    package -- icon set, screenshot, promotional description text, and (per its Risks)
    verifying the current developer registration fee -- but intent.md's own Success
    Criteria checklist never requires the extension to be actually published/listed; it
    only requires the extension to function (input/preview/copy, MV3 + sidePanel)
    equivalently to the web app. This is real effort with no corresponding intent-level
    completion gate, and some of it (a screenshot, promotional copy) is arguably outside
    what a coding builder agent can meaningfully produce.
  evidence: >
    intent.md Success Criteria bullet 5 only requires "Chrome拡張機能...で、Webアプリと同じ
    coreモジュールを用いた同等の入力・プレビュー・コピー機能が動作する" (functions
    equivalently) -- no mention of store publication; unit-03-chrome-extension.md Technical
    Specification -> "Chrome Web Store submission assets (deliverables of this unit, not
    just code)" lists icon set, screenshot, promotional description, developer fee
    verification.
  suggested_fix: >
    Either add an explicit intent-level success criterion covering Chrome Web Store
    publication/listing readiness (if genuinely required for this intent), or trim
    unit-03's scope to functional parity only and move store-submission assets to a
    follow-up/adopt-later concern.
  fix_type: manual
  fix_target: ""

- id: F008
  category: completeness
  confidence: high
  severity: warning
  affected_units: [unit-03-chrome-extension]
  title: "Chrome Web Store listing assets (icons, screenshot, promo text) are described in prose but never appear in unit-03's Success Criteria"
  description: >
    unit-03's Technical Specification lists an icon set (16/48/128px), at least one
    screenshot, and a short promotional description as deliverables -- but its Success
    Criteria checklist only captures the privacy policy document as a checkable item. A
    builder could satisfy every listed Success Criterion (manifest, sidePanel, permissions,
    no-network, privacy policy, build, license) while never producing icons, a screenshot,
    or promotional copy, and no automated reviewer would catch the omission.
  evidence: >
    unit-03-chrome-extension.md Technical Specification -> "Chrome Web Store submission
    assets" (icon set / screenshot / promotional description) vs. its Success Criteria
    list, which has no corresponding bullet for any of the three.
  suggested_fix: >
    Add explicit Success Criteria bullets for the icon set (files present at required
    sizes), at least one screenshot file, and the promotional description text, matching
    the privacy-policy bullet's pattern.
  fix_type: add_criterion
  fix_target: unit-03-chrome-extension.md

- id: F009
  category: completeness
  confidence: high
  severity: warning
  affected_units: [intent.md, unit-03-chrome-extension]
  title: "WCAG AA / keyboard-accessibility criterion is scoped to the web app only; the extension has no equivalent criterion"
  description: >
    intent.md's accessibility Success Criteria bullet is worded specifically around
    "Webアプリの主要操作" (the web app's primary operations), and unit-02 mirrors it
    verbatim as a Success Criterion. unit-03's side panel has essentially the same UI
    (textarea + two buttons) but has zero keyboard-operability / aria-label / contrast
    criterion anywhere in its spec, creating an unjustified quality-bar asymmetry between
    the two otherwise-equivalent surfaces.
  evidence: >
    intent.md Success Criteria: "Webアプリの主要操作(...)がキーボード操作のみで完結し...";
    unit-02-web-app.md Success Criteria bullet 4 (keyboard/aria-label/contrast);
    unit-03-chrome-extension.md Success Criteria list has no accessibility bullet.
  suggested_fix: >
    Add a keyboard-operability/aria-label/contrast Success Criterion to unit-03 mirroring
    unit-02's, and broaden intent.md's wording from "Webアプリ" to cover both surfaces.
  fix_type: add_criterion
  fix_target: unit-03-chrome-extension.md

- id: F010
  category: completeness
  confidence: high
  severity: warning
  affected_units: [unit-01-core-conversion-library]
  title: "Divider mrkdwn output is specified only as an example ('e.g.'), not an exact string, undermining the required per-row Vitest test"
  description: >
    unit-01's Success Criteria require "a dedicated Vitest case per table row (14 rows
    minimum)" asserting the exact mrkdwn output from the table. Row 14 (Divider)'s mrkdwn
    output is given only as "a plain long rule line, e.g. ────────────" -- the "e.g." makes
    this an illustrative example rather than the pinned expected value a test assertion
    needs, so two builders could pick different rule lengths/characters and both plausibly
    claim to satisfy the row-14 test.
  evidence: >
    unit-01-core-conversion-library.md conversion table row 14: "a plain long rule line,
    e.g. ────────────"; Success Criteria: "a dedicated Vitest case per table row (14 rows
    minimum)."
  suggested_fix: >
    Replace the divider row's "e.g." example with an exact, pinned string (or an explicit
    character-repeat rule, e.g. "40 '─' characters") that the Vitest case can assert
    against verbatim.
  fix_type: spec_edit
  fix_target: unit-01-core-conversion-library.md

- id: F011
  category: completeness
  confidence: high
  severity: warning
  affected_units: [unit-02-web-app]
  title: "'No visible lag' live-update criterion has no numeric threshold and cannot be verified programmatically"
  description: >
    unit-02's first Success Criterion requires the preview to update "live... with no page
    reload and no visible lag for typical release-note-length input (a few hundred words)."
    "No visible lag" is the same class of unverifiable, subjective phrasing the review
    method calls out as the canonical vague-criterion example ("works well") -- there is no
    millisecond threshold, no defined input fixture size beyond "a few hundred words," and
    no specified measurement method that an automated reviewer could check.
  evidence: >
    unit-02-web-app.md Success Criteria bullet 1: "updates the Slack Preview pane live,
    with no page reload and no visible lag for typical release-note-length input (a few
    hundred words)."
  suggested_fix: >
    Replace "no visible lag" with a concrete, testable threshold, e.g. "preview updates
    within 100ms of the debounced input event for a 500-word input, measured in a
    Vitest/Playwright timing test."
  fix_type: spec_edit
  fix_target: unit-02-web-app.md

- id: F012
  category: boundary
  confidence: medium
  severity: suggestion
  affected_units: [unit-02-web-app, unit-03-chrome-extension]
  title: "Clipboard-write feature-detection/fallback logic is duplicated across unit-02 and unit-03 with no shared home"
  description: >
    Both units independently specify the same non-trivial behavioral logic -- feature-
    detecting multi-MIME ClipboardItem support, falling back to plain-text writeText, and
    showing a confirmation/notice state -- but this logic lives in neither
    @mdforslack/core (deliberately DOM-free, per unit-01's Boundaries) nor any shared
    package. discovery.md's rationale for not centralizing UI ("packages/ui... premature
    abstraction... two textareas and two buttons is trivial and cheap to duplicate") was
    scoped to trivial markup, not to behavioral logic with edge-case branching --
    duplicating this specific logic risks exactly the kind of silent two-surface drift the
    project's core-module-sharing architecture was designed to prevent everywhere else.
  evidence: >
    unit-02-web-app.md Interactions -> "Copy for Slack" clipboard fallback logic;
    unit-03-chrome-extension.md -> "Interaction/data-mapping behavior... is identical to
    unit-02-web-app's Interactions section -- do not re-derive it independently"
    (acknowledges duplication rather than sharing it); discovery.md -> Architecture
    Decision: Monorepo Shape "UI code sharing" rationale (scoped to markup only).
  suggested_fix: >
    Extract the clipboard feature-detection/fallback logic into a small shared,
    DOM-touching helper package (e.g. packages/browser-utils, separate from the DOM-free
    packages/core) that both apps/web and apps/extension import, or explicitly accept the
    duplication as a documented trade-off in unit-02/unit-03's Notes.
  fix_type: manual
  fix_target: ""
```
