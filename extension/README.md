# QuizTrick for Canvas (browser extension)

Sends a Canvas page, or the text a student highlighted, to QuizTrick's Add study text page. The student reviews it there and clicks Save; the extension never saves anything to an account by itself.

Plain JavaScript, no build step. Works in Chrome and Edge.

## Load it

1. Open `chrome://extensions` (Edge: `edge://extensions`).
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose this `extension/` folder.
4. Pin "QuizTrick for Canvas" from the puzzle-piece menu so the icon stays visible.

After changing any file here, click the reload arrow on the extension's card. Then reload any QuizTrick tab that was already open, or the delivery script in it stops answering.

## Try it

1. Open any web page and highlight a paragraph or two (at least 200 characters).
2. Click the QuizTrick icon, then **Send to QuizTrick**.
3. A new tab opens on `/texts/new?from=extension`. Once F-6 is merged, the title and text appear in the editor. If you were signed out, sign in and you land on the editor with the text.

With nothing highlighted, the stub popup sends a fixed sample text.

## Send to your local dev server

By default the extension opens the production app. To send to `http://localhost:3000` instead, right-click the extension icon, choose **Inspect popup**, and run this in the console:

```js
chrome.storage.local.set({ quiztrickAppUrl: "http://localhost:3000" });
```

The popup then shows "Developer mode: sending to http://localhost:3000". To go back to production:

```js
chrome.storage.local.remove("quiztrickAppUrl");
```

## What is where

| File | What it does | Owner |
|---|---|---|
| `manifest.json` | Permissions (`activeTab`, `scripting`, `storage`) and where `deliver.js` runs | Arnaud |
| `config.js` | App URLs, the storage key, the message types | Arnaud |
| `lib/handoff.js` | `sendToQuizTrick({ title, body, sourceUrl })`: store the text, open the editor | Arnaud |
| `content/deliver.js` | Runs on QuizTrick pages and passes the stored text to the editor | Arnaud |
| `popup.html`, `popup.css`, `popup.js` | The popup. A stub for now | Hillary (H-7) |
| `lib/extract.js` | `extractFromPage()`: reads the Canvas page. Not written yet | Isaiah (I-5) |

The production URL appears in two files that cannot share it: `config.js` (`APP_URL`) and `manifest.json` (`content_scripts.matches`). Change both together; `tests/unit/extension-handoff.test.ts` fails if they differ.

## How the text reaches the editor

1. The popup calls `sendToQuizTrick()`, which stores `{ title, body, sourceUrl, capturedAt }` in `chrome.storage.local` under `quiztrickPendingImport` and opens `/texts/new?from=extension`.
2. `content/deliver.js` posts `{ type: "quiztrick:import", title, body, sourceUrl }` to the page when it loads on the editor, and again whenever the page posts `{ type: "quiztrick:import-request" }`.
3. The editor fills in the form and posts `{ type: "quiztrick:import-received" }`. `deliver.js` then deletes the stored text. A text older than 10 minutes is deleted without being delivered.

To test the editor without the extension, post the import message yourself from the page's console:

```js
window.postMessage({ type: "quiztrick:import", title: "Week 5", body: "…at least 200 characters…", sourceUrl: "" }, location.origin);
```

Unit tests: `npx vitest run tests/unit/extension-handoff.test.ts`.
