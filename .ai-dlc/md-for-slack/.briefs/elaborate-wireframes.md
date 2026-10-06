---
intent_slug: md-for-slack
worktree_path: <repo-root>/.ai-dlc/worktrees/md-for-slack
intent_title: MDforSlack — Markdown to Slack Converter
design_provider_type:
design_provider_capabilities:
design_provider_mcp_hint:
design_blueprint_path: <repo-root>/.ai-dlc/worktrees/md-for-slack/.ai-dlc/md-for-slack/design-blueprint.md
---

# Frontend & Design Units

## unit-02-web-app

**File:** unit-02-web-app.md
**Description:** The public static website for MDforSlack — a single-page, two-pane Markdown→Slack
converter (Markdown input left, live Slack preview right), consuming `@mdforslack/core` for all
conversion logic. Two buttons below the panes: "Copy for Slack" (writes rich text + mrkdwn to the
clipboard) and "Copy mrkdwn" (plain text only). Below 768px, panes stack vertically.
**Domain Entities:** MarkdownDocument, SlackMrkdwnOutput, SlackHtmlFragment, ClipboardPayload, WebApp
**Technical Spec:** See the full "Layout" and "Interactions" subsections of unit-02-web-app.md's
Technical Specification — two-pane desktop layout (input left / preview right), live-update-on-
keystroke, "Copy for Slack" / "Copy mrkdwn" buttons, small privacy note in the footer, responsive
stacking below 768px.

## unit-03-chrome-extension

**File:** unit-03-chrome-extension.md
**Description:** The Chrome (Manifest V3) extension surface for MDforSlack, using `chrome.sidePanel`
(not a popup, since a popup closes on blur — which conflicts with the compose→alt-tab-to-Slack→paste
workflow). Same core conversion module and same two-button copy behavior as the web app, but laid out
as a single narrow stacked column (input above, preview below) to fit the side panel's width.
**Domain Entities:** MarkdownDocument, SlackMrkdwnOutput, SlackHtmlFragment, ClipboardPayload, ExtensionPanel
**Technical Spec:** See the full "UI" subsection of unit-03-chrome-extension.md's Technical
Specification — single stacked column, header "MDforSlack", Markdown Input box then Slack Preview
box, "Copy for Slack" / "Copy mrkdwn" buttons stacked vertically, footer privacy note.

# Design Context

Design direction: **Editorial** archetype (see `design-blueprint.md` referenced above, and
`.ai-dlc/knowledge/design.md`) — serif headings (`Georgia, 'Times New Roman', serif`), sans-serif
body, generous whitespace, warm neutral palette (`--color-primary: #1a1a1a`,
`--color-background: #f8f7f4`, `--color-accent: #c5a572`). Understated text-based buttons with subtle
borders; minimal card borders; subtle hover color shifts, not dramatic transforms.

Discovery already produced ASCII wireframes for both units — see `discovery.md` sections
"## UI Mockup: Web App Main View" and "## UI Mockup: Extension Side Panel View" for the exact pane
layout, button placement, and sample content used to validate the layout during elaboration. Treat
those ASCII layouts as the structural source of truth; the HTML wireframes you generate should render
the same structure and copy at low fidelity, not invent a different layout.

**Important — do not reuse the original site's branding/copy/CSS.** marktoslack.com was a third-party
site the user does not own; only its documented Markdown→Slack functional mapping rules are reused
(as facts), never its HTML, CSS, wording, or visual branding. All wireframe copy must be original
MDforSlack wording (e.g. do not reuse phrases like "paste markdown, copy formatting Slack actually
understands").

# Domain Model Reference

MarkdownDocument (raw input) → ConversionAst (remark+remark-gfm) → rendered once each into
SlackMrkdwnOutput (plain mrkdwn) and SlackHtmlFragment (Slack-paste-compatible rich HTML) —
single parse, two renderers, so the two outputs can never drift from each other. ClipboardPayload
wraps both outputs for "Copy for Slack"; "Copy mrkdwn" uses SlackMrkdwnOutput alone. WebApp and
ExtensionPanel are thin UI shells over the shared CoreConversionModule (`@mdforslack/core`), with no
dependency on each other.
