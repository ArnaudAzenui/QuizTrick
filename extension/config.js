/**
 * Settings and the contract shared by every part of the extension.
 *
 * Two places repeat values from this file because they cannot import it:
 * `manifest.json` (the two app origins) and `content/deliver.js` (the storage
 * key, the message types and the maximum age). tests/unit/extension-handoff.test.ts
 * fails if either one drifts.
 */

/** Where the deployed QuizTrick app lives. No trailing slash. */
export const APP_URL = "https://replace-with-production-url.invalid";

/** The local dev server. Used only when a developer switches it on (see README). */
export const LOCAL_URL = "http://localhost:3000";

/** `chrome.storage.local` key: set to LOCAL_URL to send to the dev server instead. */
export const APP_URL_OVERRIDE_KEY = "quiztrickAppUrl";

/** `chrome.storage.local` key holding the text on its way to the editor. */
export const STORAGE_KEY = "quiztrickPendingImport";

/** The page the popup opens. The editor only listens when `from=extension` is present. */
export const IMPORT_PATH = "/texts/new?from=extension";

/** A captured text older than this is thrown away instead of delivered. */
export const IMPORT_MAX_AGE_MS = 10 * 60 * 1000;

/** `window.postMessage` types exchanged between `content/deliver.js` and the editor. */
export const MESSAGES = {
  /** editor -> extension: "I am ready, do you have a text for me?" */
  request: "quiztrick:import-request",
  /** extension -> editor: `{ type, title, body, sourceUrl }` */
  import: "quiztrick:import",
  /** editor -> extension: "got it, you can forget it now" */
  received: "quiztrick:import-received",
};
