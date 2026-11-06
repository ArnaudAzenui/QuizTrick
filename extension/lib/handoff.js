import { APP_URL, APP_URL_OVERRIDE_KEY, IMPORT_PATH, LOCAL_URL, STORAGE_KEY } from "../config.js";

/**
 * The app the extension sends to: production, unless a developer switched this
 * browser to the local dev server. Only LOCAL_URL is accepted as an override,
 * so a stray value in storage can never point the extension at another site.
 *
 * @returns {Promise<string>}
 */
export async function resolveAppUrl() {
  const stored = await chrome.storage.local.get(APP_URL_OVERRIDE_KEY);
  return stored[APP_URL_OVERRIDE_KEY] === LOCAL_URL ? LOCAL_URL : APP_URL;
}

/**
 * Hands a captured text to QuizTrick: stores it, then opens the Add study text
 * page in a new tab. `content/deliver.js` passes it to the editor from there.
 * Nothing is saved to the student's account until they click Save in the app.
 *
 * @param {{ title?: string, body: string, sourceUrl?: string }} capture
 * @returns {Promise<void>}
 */
export async function sendToQuizTrick({ title, body, sourceUrl }) {
  if (typeof body !== "string" || !body.trim()) throw new Error("There is no text to send.");

  const pending = {
    title: typeof title === "string" ? title : "",
    body,
    sourceUrl: typeof sourceUrl === "string" ? sourceUrl : "",
    capturedAt: Date.now(),
  };
  // Stored before the tab opens: opening the tab closes the popup, and with it
  // any code still waiting to run.
  await chrome.storage.local.set({ [STORAGE_KEY]: pending });
  await chrome.tabs.create({ url: (await resolveAppUrl()) + IMPORT_PATH });
}
