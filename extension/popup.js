import { APP_URL, FILE_LIMITS } from "./config.js";
import { downloadCanvasFile, findCanvasFiles } from "./lib/canvas-files.js";
import { extractFromPage } from "./lib/extract.js";
import { resolveAppUrl, sendFileToQuizTrick, sendToQuizTrick } from "./lib/handoff.js";
import { describeCapture, describeFileFailure, withFiles } from "./lib/popup-state.js";

const ui = {
  source: document.getElementById("source"),
  title: document.getElementById("title"),
  preview: document.getElementById("preview"),
  count: document.getElementById("count"),
  status: document.getElementById("status"),
  send: document.getElementById("send"),
  target: document.getElementById("target"),
  files: document.getElementById("files"),
  fileList: document.getElementById("file-list"),
};

/** The tab the popup was opened on. */
async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

/** Runs one of the self-contained page functions in the tab and returns what it returned. */
async function runInTab(tabId, func, args = []) {
  const [injection] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  return injection?.result ?? null;
}

// Some browser pages do not allow extensions to read them.
async function capture(tabId) {
  try {
    if (!tabId) return null;
    return await runInTab(tabId, extractFromPage);
  } catch {
    return null; // chrome:// pages, the Web Store, the built-in PDF viewer
  }
}

// Word, PDF and PowerPoint files the Canvas page shows or links to.
async function listFiles(tabId) {
  try {
    const files = tabId ? await runInTab(tabId, findCanvasFiles) : null;
    return Array.isArray(files) ? files : [];
  } catch {
    return [];
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

// Send the same text shown in the preview.
let current = null;

ui.send.addEventListener("click", async () => {
  if (!current || ui.send.disabled) return;
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

// One button per file. Nothing is downloaded until the student picks one.
function renderFiles(tabId, files) {
  ui.fileList.replaceChildren(
    ...files.map((file) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "file";
      button.textContent = file.name;
      button.addEventListener("click", () => void sendFile(tabId, file));
      const item = document.createElement("li");
      item.append(button);
      return item;
    }),
  );
  ui.files.hidden = files.length === 0;
}

let sendingFile = false;

async function sendFile(tabId, file) {
  if (sendingFile) return;
  sendingFile = true;
  const buttons = [...ui.fileList.querySelectorAll("button")];
  const sendWasDisabled = ui.send.disabled;
  buttons.forEach((button) => (button.disabled = true));
  ui.send.disabled = true;
  ui.status.textContent = `Getting ${file.name} from Canvas…`;
  ui.status.dataset.tone = "muted";
  try {
    let result = null;
    try {
      result = await runInTab(tabId, downloadCanvasFile, [file, FILE_LIMITS]);
    } catch {
      result = null; // the tab was closed or navigated away
    }
    if (!result?.ok) throw new Error(describeFileFailure(result ?? { name: file.name }));
    const sourceUrl = current && typeof current.sourceUrl === "string" ? current.sourceUrl : "";
    await sendFileToQuizTrick({ name: result.name, mimeType: result.mimeType, dataBase64: result.dataBase64, sourceUrl });
  } catch (error) {
    showError(error instanceof Error ? error.message : "Something went wrong. Try again.");
    buttons.forEach((button) => (button.disabled = false));
    ui.send.disabled = sendWasDisabled;
    sendingFile = false;
  }
}

(async () => {
  let tabId = null;
  try {
    tabId = await activeTabId();
  } catch {
    tabId = null;
  }
  current = await capture(tabId);
  const files = current ? await listFiles(tabId) : [];
  render(withFiles(describeCapture(current), files.length));
  renderFiles(tabId, files);
})();

// Show the address when using the local app.
resolveAppUrl().then((appUrl) => {
  if (appUrl === APP_URL) return;
  ui.target.textContent = `Developer mode: sending to ${appUrl}`;
  ui.target.hidden = false;
}).catch(() => {
  // The popup can still show the preview if the app address is unavailable.
});
