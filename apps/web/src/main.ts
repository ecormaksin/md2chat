import "./style.css";
import { handleCopyForSlack, handleCopyMrkdwn } from "./copy-actions";
import { LARGE_INPUT_MESSAGE, renderPreview } from "./pipeline";

/**
 * apps/web's UI shell: wires the textarea input, the debounced conversion
 * pipeline (src/pipeline.ts, which is the ONLY place this app calls into
 * @md2chat/core), and the two copy buttons (src/copy-actions.ts, the ONLY
 * place this app calls into @md2chat/browser-utils). See
 * .ai-dlc/md-for-slack/unit-02-web-app.md for the full spec this implements.
 */

const DEBOUNCE_MS = 150;
const COPY_STATUS_DISMISS_MS = 2000;
const EMPTY_PREVIEW_MESSAGE = "Your Slack-ready preview will appear here";

interface ConversionState {
  /** SlackHtmlFragment.html — used for the "Copy for Slack" clipboard write. */
  html: string;
  /** SlackMrkdwnOutput.text — used for both copy actions. */
  mrkdwn: string;
}

let state: ConversionState = { html: "", mrkdwn: "" };
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let copyStatusTimer: ReturnType<typeof setTimeout> | undefined;

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Expected #${id} to exist in the document`);
  }
  return element as T;
}

const markdownInput = requireElement<HTMLTextAreaElement>("markdown-input");
const previewEl = requireElement<HTMLDivElement>("slack-preview");
const copyForSlackBtn = requireElement<HTMLButtonElement>("copy-for-slack");
const copyMrkdwnBtn = requireElement<HTMLButtonElement>("copy-mrkdwn");
const copyStatusEl = requireElement<HTMLElement>("copy-status");

function setEmptyState(): void {
  state = { html: "", mrkdwn: "" };
  previewEl.classList.add("empty");
  previewEl.textContent = EMPTY_PREVIEW_MESSAGE;
  copyForSlackBtn.disabled = true;
  copyMrkdwnBtn.disabled = true;
}

function setTooLargeState(): void {
  state = { html: "", mrkdwn: "" };
  previewEl.classList.remove("empty");
  // Conversion was skipped entirely by the input-size guard (see
  // src/pipeline.ts MAX_INPUT_LENGTH) — there is no html/mrkdwn to copy.
  previewEl.textContent = LARGE_INPUT_MESSAGE;
  copyForSlackBtn.disabled = true;
  copyMrkdwnBtn.disabled = true;
}

function setFilledState(markdown: string): void {
  const { html, mrkdwn, sanitizedHtml, tooLarge } = renderPreview(markdown);
  if (tooLarge) {
    setTooLargeState();
    return;
  }
  state = { html, mrkdwn };
  previewEl.classList.remove("empty");
  // Defense-in-depth: only the DOMPurify-sanitized HTML is ever inserted
  // into the DOM (see src/pipeline.ts SANITIZE_ALLOWED_TAGS).
  previewEl.innerHTML = sanitizedHtml;
  copyForSlackBtn.disabled = false;
  copyMrkdwnBtn.disabled = false;
}

/** Runs the empty-check + conversion pipeline; called once the 150ms debounce fires. */
export function commitRender(markdown: string): void {
  if (markdown.trim() === "") {
    setEmptyState();
  } else {
    setFilledState(markdown);
  }
}

function scheduleRender(markdown: string): void {
  if (debounceTimer !== undefined) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    commitRender(markdown);
  }, DEBOUNCE_MS);
}

function showCopyStatus(message: string): void {
  if (copyStatusTimer !== undefined) {
    clearTimeout(copyStatusTimer);
  }
  copyStatusEl.textContent = message;
  if (message !== "") {
    copyStatusTimer = setTimeout(() => {
      copyStatusEl.textContent = "";
    }, COPY_STATUS_DISMISS_MS);
  }
}

markdownInput.addEventListener("input", () => {
  scheduleRender(markdownInput.value);
});

copyForSlackBtn.addEventListener("click", () => {
  if (state.html === "" && state.mrkdwn === "") {
    return;
  }
  // handleCopyForSlack is called synchronously from this listener (no await
  // beforehand) so the browser's user-gesture context for
  // navigator.clipboard.write is preserved.
  void handleCopyForSlack(state.html, state.mrkdwn).then((status) => {
    showCopyStatus(
      status.kind === "copied"
        ? "Copied!"
        : "Only mrkdwn was copied — rich copy isn't supported in this browser."
    );
  });
});

copyMrkdwnBtn.addEventListener("click", () => {
  if (state.mrkdwn === "") {
    return;
  }
  void handleCopyMrkdwn(state.mrkdwn).then((status) => {
    showCopyStatus(status.kind === "copied" ? "Copied!" : "");
  });
});

setEmptyState();
