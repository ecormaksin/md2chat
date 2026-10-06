import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Interaction + accessibility smoke tests for src/main.ts, the UI shell.
 * @md2chat/browser-utils is mocked here (per unit-02-web-app.md's own
 * boundary: this app never re-implements clipboard feature-detection, it
 * only calls the shared helper and renders the outcome) so these tests
 * verify the WIRING, not browser-utils' own clipboard logic (already
 * covered by that package's own test suite).
 */

const copySlackRichText = vi.fn();
const copyPlainText = vi.fn();

vi.mock("@md2chat/browser-utils", () => ({
  copySlackRichText: (html: string, mrkdwn: string) => copySlackRichText(html, mrkdwn),
  copyPlainText: (text: string) => copyPlainText(text)
}));

function mountDom(): void {
  document.body.innerHTML = `
    <header class="site-header">
      <h1>MD2Chat</h1>
      <p class="tagline">Type Markdown, get Slack-ready formatting.</p>
    </header>
    <main>
      <div class="panes">
        <section class="pane" aria-labelledby="input-pane-label">
          <h2 class="pane-label" id="input-pane-label">Markdown Input</h2>
          <textarea
            id="markdown-input"
            aria-labelledby="input-pane-label"
            placeholder="Type or paste Markdown here…"
          ></textarea>
        </section>
        <section class="pane" aria-labelledby="preview-pane-label">
          <h2 class="pane-label" id="preview-pane-label">Slack Preview</h2>
          <div
            id="slack-preview"
            role="region"
            aria-labelledby="preview-pane-label"
            aria-live="polite"
          ></div>
        </section>
      </div>
      <div class="footer-row">
        <div class="btn-row">
          <button id="copy-for-slack" type="button">Copy for Slack</button>
          <button id="copy-mrkdwn" type="button">Copy mrkdwn</button>
        </div>
        <p class="privacy-note">Free · No sign-up · Runs locally in your browser</p>
      </div>
      <p id="copy-status" role="status" aria-live="polite"></p>
    </main>
  `;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(() => {
  mountDom();
  copySlackRichText.mockReset();
  copyPlainText.mockReset();
});

afterEach(() => {
  vi.resetModules();
});

describe("apps/web UI wiring", () => {
  it("gives the textarea and both buttons accessible names, in logical tab order", async () => {
    await import("../src/main.ts");

    const input = document.getElementById("markdown-input") as HTMLTextAreaElement;
    const copyForSlack = document.getElementById("copy-for-slack") as HTMLButtonElement;
    const copyMrkdwn = document.getElementById("copy-mrkdwn") as HTMLButtonElement;

    expect(input.getAttribute("aria-labelledby")).toBe("input-pane-label");
    expect(document.getElementById("input-pane-label")?.textContent).toBe("Markdown Input");
    expect(copyForSlack.textContent?.trim()).toBe("Copy for Slack");
    expect(copyMrkdwn.textContent?.trim()).toBe("Copy mrkdwn");

    // Default DOM order alone must already put these three controls in the
    // right Tab order — no explicit tabindex needed.
    const focusable = Array.from(document.querySelectorAll("textarea, button"));
    expect(focusable).toEqual([input, copyForSlack, copyMrkdwn]);
  });

  it("shows the empty-state placeholder and disables both copy buttons before any input", async () => {
    await import("../src/main.ts");

    const preview = document.getElementById("slack-preview") as HTMLDivElement;
    const copyForSlack = document.getElementById("copy-for-slack") as HTMLButtonElement;
    const copyMrkdwn = document.getElementById("copy-mrkdwn") as HTMLButtonElement;

    expect(preview.textContent).toBe("Your Slack-ready preview will appear here");
    expect(copyForSlack.disabled).toBe(true);
    expect(copyMrkdwn.disabled).toBe(true);
  });

  it("renders the preview from SlackHtmlFragment.html (not raw mrkdwn) after the debounce fires", async () => {
    await import("../src/main.ts");

    const input = document.getElementById("markdown-input") as HTMLTextAreaElement;
    const preview = document.getElementById("slack-preview") as HTMLDivElement;
    const copyForSlack = document.getElementById("copy-for-slack") as HTMLButtonElement;

    input.value = "**bold** text";
    input.dispatchEvent(new Event("input"));

    await wait(200);

    expect(preview.innerHTML).toContain("<b>bold</b>");
    expect(preview.textContent).not.toContain("*bold*");
    expect(copyForSlack.disabled).toBe(false);
  });

  it("shows the large-input notice and disables both copy buttons once input exceeds the size guard", async () => {
    const { MAX_INPUT_LENGTH, LARGE_INPUT_MESSAGE } = await import("../src/pipeline");
    await import("../src/main.ts");

    const input = document.getElementById("markdown-input") as HTMLTextAreaElement;
    const preview = document.getElementById("slack-preview") as HTMLDivElement;
    const copyForSlack = document.getElementById("copy-for-slack") as HTMLButtonElement;
    const copyMrkdwn = document.getElementById("copy-mrkdwn") as HTMLButtonElement;

    input.value = "a".repeat(MAX_INPUT_LENGTH + 1);
    input.dispatchEvent(new Event("input"));
    await wait(200);

    expect(preview.textContent).toBe(LARGE_INPUT_MESSAGE);
    expect(copyForSlack.disabled).toBe(true);
    expect(copyMrkdwn.disabled).toBe(true);
  });

  it('calls copySlackRichText with the core html + mrkdwn and shows "Copied!" on a rich resolve', async () => {
    copySlackRichText.mockResolvedValue("rich");
    await import("../src/main.ts");

    const input = document.getElementById("markdown-input") as HTMLTextAreaElement;
    const copyForSlack = document.getElementById("copy-for-slack") as HTMLButtonElement;
    const status = document.getElementById("copy-status") as HTMLElement;

    input.value = "**bold**";
    input.dispatchEvent(new Event("input"));
    await wait(200);

    copyForSlack.click();
    await wait(50);

    expect(copySlackRichText).toHaveBeenCalledWith("<b>bold</b>", "*bold*");
    expect(status.textContent).toBe("Copied!");
  });

  it('shows a visible, distinct "only mrkdwn was copied" notice on a plain-fallback resolve', async () => {
    copySlackRichText.mockResolvedValue("plain-fallback");
    await import("../src/main.ts");

    const input = document.getElementById("markdown-input") as HTMLTextAreaElement;
    const copyForSlack = document.getElementById("copy-for-slack") as HTMLButtonElement;
    const status = document.getElementById("copy-status") as HTMLElement;

    input.value = "**bold**";
    input.dispatchEvent(new Event("input"));
    await wait(200);

    copyForSlack.click();
    await wait(50);

    expect(status.textContent?.toLowerCase()).toContain("only mrkdwn was copied");
    expect(status.textContent).not.toBe("Copied!");
  });

  it("calls copyPlainText with the mrkdwn string and shows Copied! when Copy mrkdwn is clicked", async () => {
    copyPlainText.mockResolvedValue(undefined);
    await import("../src/main.ts");

    const input = document.getElementById("markdown-input") as HTMLTextAreaElement;
    const copyMrkdwn = document.getElementById("copy-mrkdwn") as HTMLButtonElement;
    const status = document.getElementById("copy-status") as HTMLElement;

    input.value = "**bold**";
    input.dispatchEvent(new Event("input"));
    await wait(200);

    copyMrkdwn.click();
    await wait(50);

    expect(copyPlainText).toHaveBeenCalledWith("*bold*");
    expect(status.textContent).toBe("Copied!");
  });
});
