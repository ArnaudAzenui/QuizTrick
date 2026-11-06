/**
 * Runs on every QuizTrick page and passes a captured text to the editor.
 *
 * It runs on the whole app, not only /texts/new, because a signed-out student
 * is sent to /login first and reaches the editor afterwards by a client-side
 * navigation. The browser loads no new page for that, so a script limited to
 * /texts/new would never start.
 *
 * Either side may load first, so both speak first: this script offers the text
 * as soon as it loads on the editor page, and again whenever the editor asks.
 *
 * Content scripts cannot import modules. The constants below repeat
 * ../config.js; tests/unit/extension-handoff.test.ts fails if they drift.
 */
(() => {
  const STORAGE_KEY = "quiztrickPendingImport";
  const IMPORT_MAX_AGE_MS = 10 * 60 * 1000;
  const REQUEST = "quiztrick:import-request";
  const IMPORT = "quiztrick:import";
  const RECEIVED = "quiztrick:import-received";
  const EDITOR_PATH = "/texts/new";

  /** The stored capture, or null if there is none or it is too old to trust. */
  async function pendingImport() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const pending = stored[STORAGE_KEY];
    if (!pending) return null;
    const age = Date.now() - pending.capturedAt;
    if (typeof pending.capturedAt !== "number" || age > IMPORT_MAX_AGE_MS) {
      await chrome.storage.local.remove(STORAGE_KEY);
      return null;
    }
    return pending;
  }

  async function deliver() {
    try {
      const pending = await pendingImport();
      if (!pending) return;
      window.postMessage(
        { type: IMPORT, title: pending.title, body: pending.body, sourceUrl: pending.sourceUrl },
        window.location.origin,
      );
    } catch {
      // The extension was reloaded or removed while this tab stayed open, so
      // its storage is gone. There is nothing to deliver and nothing to report.
    }
  }

  async function forget() {
    try {
      await chrome.storage.local.remove(STORAGE_KEY);
    } catch {
      // Same case as above.
    }
  }

  window.addEventListener("message", (event) => {
    // Only the page this script is attached to may ask for the text.
    if (event.source !== window || event.origin !== window.location.origin) return;
    const type = event.data?.type;
    if (type === REQUEST) void deliver();
    else if (type === RECEIVED) void forget();
  });

  if (window.location.pathname === EDITOR_PATH) void deliver();
})();
