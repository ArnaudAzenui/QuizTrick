/**
 * Stub popup (A-6). It exists to prove the whole chain works: read the current
 * tab, store the text, open QuizTrick, deliver to the editor. H-7 replaces the
 * screen, and I-5's extractFromPage() replaces readPage().
 */
import { APP_URL } from "./config.js";
import { resolveAppUrl, sendToQuizTrick } from "./lib/handoff.js";

/** Long enough to pass the editor's 200-character minimum. */
const SAMPLE_TEXT = [
  "Photosynthesis is the process plants use to turn light into chemical energy.",
  "It takes place in the chloroplasts, where chlorophyll absorbs sunlight.",
  "The light reactions split water and release oxygen, and the Calvin cycle uses the captured energy to build glucose from carbon dioxide.",
  "This sample text comes from the QuizTrick extension stub.",
].join(" ");

/**
 * Runs inside the page the student is looking at, so it must stay
 * self-contained: Chrome copies the function's source into the tab, and
 * nothing else from this file exists there.
 */
function readPage() {
  return {
    title: document.title,
    selection: String(window.getSelection() ?? ""),
    url: window.location.href,
  };
}

/** What the current tab offers, or null on pages Chrome will not let us read. */
async function capture() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [injection] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readPage });
    return injection.result;
  } catch {
    return null; // chrome:// pages, the Web Store, the built-in PDF viewer
  }
}

const status = document.getElementById("status");
const target = document.getElementById("target");
const send = document.getElementById("send");

send.addEventListener("click", async () => {
  send.disabled = true;
  try {
    const page = await capture();
    const selection = page?.selection.trim();
    await sendToQuizTrick({
      title: page?.title ?? "Sample text",
      body: selection || SAMPLE_TEXT,
      sourceUrl: page?.url ?? "",
    });
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Something went wrong. Try again.";
    send.disabled = false;
  }
});

// Say so when this browser is pointed at the dev server, so nobody demos against it by accident.
resolveAppUrl().then((appUrl) => {
  if (appUrl === APP_URL) return;
  target.textContent = `Developer mode: sending to ${appUrl}`;
  target.hidden = false;
});
