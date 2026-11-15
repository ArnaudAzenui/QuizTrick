/**
 * The popup (H-7): reads the current tab with extractFromPage(), shows what it
 * found, and hands it to QuizTrick with sendToQuizTrick().
 *
 * Clicking the toolbar icon grants `activeTab` for that tab, which is what
 * lets chrome.scripting.executeScript run the extractor there. The popup
 * closes when a new tab opens, so the text is stored before the tab is created
 * (see lib/handoff.js). What each state says is decided in lib/popup-state.js.
 */
import { APP_URL } from "./config.js";
import { extractFromPage } from "./lib/extract.js";
import { resolveAppUrl, sendToQuizTrick } from "./lib/handoff.js";
import { describeCapture } from "./lib/popup-state.js";

const ui = {
  source: document.getElementById("source"),
  title: document.getElementById("title"),
  preview: document.getElementById("preview"),
  count: document.getElementById("count"),
  status: document.getElementById("status"),
  send: document.getElementById("send"),
  target: document.getElementById("target"),
};

/** What the current tab offers, or null on pages Chrome will not let us read. */
async function capture() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return null;
    const [injection] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractFromPage });
    return injection?.result ?? null;
  } catch {
    return null; // chrome:// pages, the Web Store, the built-in PDF viewer
  }
}

function render(view) {
  document.body.dataset.state = view.state;
  ui.source.textContent = view.source;
  ui.title.textContent = view.title;
  ui.title.hidden = !view.title;
  ui.preview.textContent = view.preview;
  ui.preview.hidden = !view.preview;
  ui.count.textContent = view.countLabel;
  ui.count.hidden = !view.countLabel;
  ui.status.textContent = view.message;
  ui.status.dataset.tone = view.tone;
  ui.send.disabled = !view.canSend;
}

function showError(message) {
  ui.status.textContent = message;
  ui.status.dataset.tone = "error";
}

/** The last capture, so Send does not have to read the page a second time. */
let current = null;

ui.send.addEventListener("click", async () => {
  if (!current) return;
  ui.send.disabled = true;
  ui.status.textContent = "Sending…";
  ui.status.dataset.tone = "muted";
  try {
    await sendToQuizTrick({ title: current.title, body: current.body, sourceUrl: current.sourceUrl });
  } catch (error) {
    showError(error instanceof Error ? error.message : "Something went wrong. Try again.");
    ui.send.disabled = false;
  }
});

(async () => {
  current = await capture();
  render(describeCapture(current));
})();

// Say so when this browser is pointed at the dev server, so nobody demos against it by accident.
resolveAppUrl().then((appUrl) => {
  if (appUrl === APP_URL) return;
  ui.target.textContent = `Developer mode: sending to ${appUrl}`;
  ui.target.hidden = false;
});
