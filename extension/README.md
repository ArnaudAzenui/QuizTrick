# QuizTrick for Canvas (browser extension)

Sends a Canvas page, a Word, PDF or PowerPoint file on it, or the text a student highlighted, to QuizTrick's Add study text page. The student reviews it there and clicks Save; the extension never saves anything to an account by itself.

Plain JavaScript, no build step. Works in Chrome and Edge, loaded unpacked.

## Load it

1. Open `chrome://extensions` (Edge: `edge://extensions`).
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose this `extension/` folder.
4. Pin "QuizTrick for Canvas" from the puzzle-piece menu so the icon stays visible.

After changing any file here, click the reload arrow on the extension's card. Then reload any QuizTrick tab that was already open, or the delivery script in it stops answering.

## Try it

1. Open a Canvas page, assignment or syllabus in your course.
2. Click the QuizTrick icon. The popup shows where the text came from, the title, a preview and the character count.
3. Click **Send to QuizTrick**. A new tab opens on Add study text with the title and text filled in and the note "Imported from Canvas. Review it below before saving." If you were signed out, sign in and you land on the editor with the text.
4. Review, edit if you like, click **Save study text**, then generate a quiz.

To send only part of a page, highlight it first. Highlighted text always wins over the page. On pages like Modules or Grades the whole content column is read, which picks up a lot of interface text: highlight what you want instead.

### Files (Word, PDF, PowerPoint)

When the Canvas page is a file (Modules or Files, then a file) or links to files, the popup lists them under **Files on this page**. Click one: the extension downloads it from Canvas, opens Add study text, and the editor reads it exactly as if you had chosen the file there, with the note "Imported <name> from Canvas. Review it below before saving."

- `.docx`, `.pdf` and `.pptx` up to 4 MB, `.txt` up to 100 KB: the app's own upload limits. Older `.doc` and `.ppt` files, bigger files and files locked in Canvas are refused in the popup, before anything is downloaded.
- Scanned PDFs and image-only slides have no text to read; the editor says so.
- Each file counts toward the 30 documents an hour the app reads per student.
- A Modules list shows file names but not which file each one is, so open the file first. Up to 8 files are listed per page.
- If the popup says it couldn't get the file from Canvas, download it there and upload it on Add study text.

What the popup says:

| State | When | Send |
|---|---|---|
| Ready | 200 to 20,000 characters | enabled |
| Too short | under 200 characters, or nothing to read | disabled |
| Too long | over 20,000 characters; highlight a section, or send it all and trim in the editor | enabled |
| Can't read this page | `chrome://` pages, the Web Store, the built-in PDF viewer | disabled |

The popup follows the operating system's light or dark setting.

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

| File | What it does | Written by |
|---|---|---|
| `manifest.json` | Permissions (`activeTab`, `scripting`, `storage`) and where `deliver.js` runs | Arnaud |
| `config.js` | App URLs, the storage key, the message types | Arnaud |
| `lib/handoff.js` | `sendToQuizTrick({ title, body, sourceUrl })` and `sendFileToQuizTrick({ name, mimeType, dataBase64, sourceUrl })`: store the text or file, open the editor | Arnaud |
| `content/deliver.js` | Runs on QuizTrick pages and passes the stored text to the editor | Arnaud |
| `lib/extract.js` | `extractFromPage()`: reads the Canvas page; injected into the tab | Isaiah |
| `lib/canvas-files.js` | `findCanvasFiles()` and `downloadCanvasFile()`: list the page's files and download one; both injected into the tab | Arnaud |
| `lib/popup-state.js` | What the popup shows for a capture: state, count, message; what it says when a file can't be sent | Arnaud |
| `popup.html`, `popup.css`, `popup.js` | The popup | Arnaud |
| (web app) `src/frontend/components/texts/extension-import.ts` | The editor's side of the handoff | Fardin |

The production URL appears in two files that cannot share it: `config.js` (`APP_URL`) and `manifest.json` (`content_scripts.matches`). Change both together; `tests/unit/extension-handoff.test.ts` fails if they differ. The 200 and 20,000 character limits are repeated in `lib/popup-state.js`; `tests/unit/extension-popup.test.ts` fails if they drift from `src/shared/constants.ts`.

## How the text reaches the editor

1. The popup runs `extractFromPage()` in the current tab. It returns `{ kind, title, body, sourceUrl }`: highlighted text first, then the Canvas page body, assignment description, syllabus, or the `#content` column. Outside Canvas only highlighted text is read.
2. `sendToQuizTrick()` stores `{ title, body, sourceUrl, capturedAt }` in `chrome.storage.local` under `quiztrickPendingImport` and opens `/texts/new?from=extension`.
3. `content/deliver.js` posts `{ type: "quiztrick:import", title, body, sourceUrl }` to the page when it loads on the editor, and again whenever the page posts `{ type: "quiztrick:import-request" }`.
4. The editor fills in the form, cuts the title to 120 characters, never overwrites text the student already typed, and posts `{ type: "quiztrick:import-received" }`. `deliver.js` then deletes the stored text. A text older than 10 minutes is deleted without being delivered.

## How a file reaches the editor

1. The popup runs `findCanvasFiles()` in the tab. It returns `{ id, courseId, name }` for the file the page is about and for every same-site `/files/<id>` link in `#content`.
2. On a click it runs `downloadCanvasFile()` in the tab. That asks Canvas about the file (`/api/v1/courses/<course>/files/<id>`, then `/api/v1/files/<id>`), checks the type and size, downloads it and returns it as base64. Both requests are made from the Canvas page, so they carry the student's Canvas session and nothing else: the extension still has no Canvas permission of its own, and no developer key is involved.
3. `sendFileToQuizTrick()` stores `{ file: { name, mimeType, dataBase64 }, sourceUrl, capturedAt }` under the same `quiztrickPendingImport` key and opens `/texts/new?from=extension`.
4. `content/deliver.js` posts `{ type: "quiztrick:import-file", name, mimeType, dataBase64, sourceUrl }`. The editor checks it, rebuilds the file, posts `quiztrick:import-received`, and sends the file to `POST /api/texts/extract` like any upload. It is dropped if the student already typed something.

The 4 MB and 100 KB limits are repeated in `config.js` (`FILE_LIMITS`); `tests/unit/extension-files.test.ts` fails if they drift from `src/shared/constants.ts`.

To test the editor without the extension, open `/texts/new?from=extension` and post the import message from the page's console:

```js
window.postMessage({ type: "quiztrick:import", title: "Week 5", body: "…at least 200 characters…", sourceUrl: "" }, location.origin);
```

Unit tests: `npx vitest run tests/unit/extension-handoff.test.ts tests/unit/extension-extract.test.ts tests/unit/extension-popup.test.ts tests/unit/extension-import.test.ts tests/unit/extension-files.test.ts tests/unit/extension-import-editor.test.tsx`.
