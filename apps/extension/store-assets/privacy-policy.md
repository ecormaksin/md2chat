# MD2Chat — Privacy Policy

_Last updated: 2026-10-04_

## Summary

MD2Chat collects no user data. All Markdown-to-Slack conversion happens locally, inside your
browser. Nothing you type, paste, or copy is ever transmitted anywhere.

## What this extension does

MD2Chat is a Chrome side panel that converts Markdown you type into Slack-formatted text
(`mrkdwn` and rich HTML for pasting), and copies the result to your clipboard when you click one
of its two copy buttons.

## What data is collected

None. Specifically:

- **No analytics or telemetry.** The extension does not use any analytics, crash-reporting, or
  usage-tracking service.
- **No accounts, no sign-up.** There is nothing to register for and nothing to log into.
- **No network requests.** The extension makes no `fetch`, `XMLHttpRequest`, or `WebSocket` calls,
  to the developer's servers or to any third party. This is enforced mechanically: an automated
  test fails the build if any such call is introduced into the source.
- **No `host_permissions`.** The extension cannot read or modify the content of any web page or
  tab you visit — it has no permission to do so, and the code that runs inside the side panel has
  no access to other tabs' content.
- **No persistent storage of your input.** The Markdown you type and the converted output live only
  in the side panel's in-memory state while it is open.

## Clipboard access

The extension requests the `clipboardWrite` permission solely to let its "Copy for Slack" and
"Copy mrkdwn" buttons write the converted text to your system clipboard when you click them. It
never reads your clipboard, and the write only happens in direct response to your own button
click.

## Where conversion happens

All Markdown parsing and Slack-format conversion runs locally in the side panel's own JavaScript,
which is bundled inside the extension. No document you type is ever sent to a server — there is
no server in this extension's architecture at all.

## Changes to this policy

Any future change to this policy will be published at this same location, with the "Last
updated" date above revised accordingly.

## Contact

Questions about this policy can be sent to the developer contact email shown on the extension's
Chrome Web Store listing.
