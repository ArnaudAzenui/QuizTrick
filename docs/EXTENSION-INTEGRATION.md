# Canvas extension — integration, real-page run and demo (A-7)

Owner: Arnaud · Due: Fri Nov 13, 2026 · Depends on I-5, H-7 and F-6 (all due Wed Nov 11).

The contract every piece codes against is `extension/config.js` and the "How the text reaches the editor" section of `extension/README.md`. This file is the checklist for landing the three pieces on top of the A-6 skeleton (#29), the record of the run on a real Canvas page, and the demo script. Tick a box only when the recorded result matches the expected one.

## Part A — Reviewing each PR against the contract

Any one teammate other than the author can approve `/extension/` and `/tests/` (CODEOWNERS). Whoever reviews checks these; the author ticks nothing.

### A1 — I-5 `feat/ext-extract` (Isaiah): `extension/lib/extract.js`

| # | Check | OK |
|---|---|---|
| A1.1 | `extractFromPage()` is one self-contained function: no call to anything else in the file, no import used inside it. `chrome.scripting.executeScript({ func })` copies only the function's source into the tab. | ☐ |
| A1.2 | Order: highlighted text, then Canvas page (`.show-content.user_content`, title `h1.page-title`), assignment (`#assignment_show .description.user_content`), syllabus, then the `#content` column. On a page without `#application.ic-app`, highlighted text only. | ☐ |
| A1.3 | Returns `{ kind, title, body, sourceUrl }` with string fields; `body` is clean paragraphs (no runs of blank lines, no nav or sidebar text). | ☐ |
| A1.4 | Falls back to `textContent` when `innerText` is missing (jsdom). | ☐ |
| A1.5 | Fixtures in `tests/fixtures/canvas/` are real saved pages from our courses with anything personal removed (names, emails, grades, student IDs). The syllabus selector was checked on a real syllabus page and the PR says which one. | ☐ |
| A1.6 | `jsdom` is a dev dependency; the test file starts with `// @vitest-environment jsdom`; `vitest.config.ts` still says `environment: "node"` so no other test changes. | ☐ |
| A1.7 | `npm run check` green. | ☐ |

### A2 — H-7 `feat/ext-popup` (Hillary): `extension/popup.html`, `popup.css`, `popup.js`

| # | Check | OK |
|---|---|---|
| A2.1 | Four states render: ready; too short (under 200, Send disabled); too long (over 20,000, warning to highlight a section, Send still allowed); can't read this page (chrome://, Web Store, PDF viewer). | ☐ |
| A2.2 | Character count is `[...text].length`, the same count as the editor. The limits are 200 and 20,000, matching `LIMITS.TEXT_MIN_CHARS` and `LIMITS.TEXT_MAX_CHARS` in `src/shared/constants.ts`. | ☐ |
| A2.3 | Send calls `sendToQuizTrick()` from `lib/handoff.js` and nothing else writes to `chrome.storage.local` or opens a tab. | ☐ |
| A2.4 | Light and dark follow `prefers-color-scheme`; text and buttons are readable in both. | ☐ |
| A2.5 | `extractFromPage()` is stubbed inside `popup.js` (or imported from `lib/extract.js` if I-5 merged first). The stub is marked so A-7 can remove it. | ☐ |
| A2.6 | The "Developer mode: sending to …" line from the skeleton is kept (it stops someone demoing against localhost by accident). | ☐ |
| A2.7 | `manifest.json` unchanged except, if icons were added, `action.default_icon` and `icons`. Permissions stay `activeTab`, `scripting`, `storage`. The manifest test still passes. | ☐ |

### A3 — F-6 `feat/ext-import-editor` (Fardin): `StudyTextEditor.tsx` + `extension-import.ts`

| # | Check | OK |
|---|---|---|
| A3.1 | Listens only when `window.location.search` contains `from=extension`, read inside `useEffect`. No `useSearchParams` (it needs a Suspense boundary and can break the build). | ☐ |
| A3.2 | On mount the editor posts `{ type: "quiztrick:import-request" }` to `window.location.origin`. | ☐ |
| A3.3 | Accepts an import only when `event.source === window`, `event.origin === window.location.origin`, `type === "quiztrick:import"`, and `title`, `body`, `sourceUrl` are strings. Anything else is ignored silently. | ☐ |
| A3.4 | Title cut to 120 characters (`LIMITS.TEXT_TITLE_MAX`). Body left as sent; the existing count and validation handle too short/too long. | ☐ |
| A3.5 | Never overwrites text the student already typed: an import arriving when `body` is non-empty is dropped. Never saves by itself. | ☐ |
| A3.6 | After filling in, posts `{ type: "quiztrick:import-received" }` so the extension deletes the stored text. | ☐ |
| A3.7 | Shows "Imported from Canvas. Review it below before saving." in the existing file-note area (`fileNote`). | ☐ |
| A3.8 | The message checks are pure functions in `extension-import.ts` with their own tests. The three type strings are asserted equal to `MESSAGES` in `extension/config.js` in a test, so the two sides cannot drift. | ☐ |
| A3.9 | A second import message after the first does nothing (the editor is no longer empty). | ☐ |
| A3.10 | One extension task added to the external tester session sheet (F-5). | ☐ |

## Part B — Wiring once all three are on main

Branch `docs/ext-integration`. Rebase on main after the last of the three merges.

| # | Do | OK |
|---|---|---|
| B1 | In `popup.js`, replace the stub `extractFromPage()` with `import { extractFromPage } from "./lib/extract.js"` and pass it as `func` to `chrome.scripting.executeScript`. Remove the `SAMPLE_TEXT` fallback and `readPage()` from the skeleton. | ☐ |
| B2 | `extension/README.md`: remove "A stub for now", "Once F-6 is merged" and "Not written yet"; fill in the owner column; update the "Try it" steps to describe a Canvas page. | ☐ |
| B3 | Confirm the deployed app URL equals `APP_URL` in `config.js` and the first `matches` entry in `manifest.json`. If the Vercel URL differs, nothing is ever delivered: change both together and let the manifest test confirm. | ☐ |
| B4 | `npm run check` green; `npx vitest run tests/unit/extension-handoff.test.ts` and the I-5 and F-6 test files pass. | ☐ |
| B5 | Load unpacked in Chrome and Edge, reload any open QuizTrick tab, then run Part C. | ☐ |

## Part C — Run on a real Canvas page

Browser: ____________ · Extension loaded from commit: ____________ · App: production · Date: ____________

Use a real course. Record what the popup showed and what landed in the editor. Where a row says "signed out", log out first.

| # | Do | Expected | Result | OK |
|---|---|---|---|---|
| C1 | Open a Canvas **page** (Modules → a page). Nothing highlighted. Click the icon. | Popup shows the page title, a preview, a count over 200, Send enabled. | | ☐ |
| C2 | Click Send. | A new tab opens on `/texts/new?from=extension`. Title and text are filled in. The note "Imported from Canvas. Review it below before saving." shows. Nothing is saved yet. | | ☐ |
| C3 | Click Save study text, then Generate quiz. | Text saves; a quiz generates from it as usual. | | ☐ |
| C4 | Open an **assignment**. Click the icon, Send. | Assignment title and description arrive; no due date, points or rubric text. | | ☐ |
| C5 | Open the **syllabus**. Click the icon, Send. | Syllabus text arrives; no course summary table rows. | | ☐ |
| C6 | On any Canvas page, **highlight** two paragraphs. Click the icon. | Preview is the highlighted text only; count matches. | | ☐ |
| C7 | On a **non-Canvas** page (e.g. Wikipedia), highlight text, click the icon. | Highlighted text arrives. With nothing highlighted, the too-short state (0 characters, Send disabled): the page body is never read outside Canvas. | | ☐ |
| C8 | On a `chrome://` page or the Web Store, click the icon. | "Can't read this page" state. Send disabled. | | ☐ |
| C9 | Highlight under 200 characters. | Too-short state, Send disabled, count shown. | | ☐ |
| C10 | A page over 20,000 characters (or paste one into a Canvas page you own). | Too-long warning suggesting to highlight a section; Send still allowed; the editor shows "too long" and refuses to save. | | ☐ |
| C11 | **Signed out**, Send from a Canvas page. | Lands on `/login`; after signing in, arrives on the editor with the text filled in. | | ☐ |
| C12 | On `/texts/new?from=extension`, type something in the body first, then post an import from the console. | Typed text stays. Nothing is overwritten. | | ☐ |
| C13 | Send, then wait 11 minutes before opening the tab's editor (close the tab, reopen `/texts/new?from=extension`). | Nothing arrives; the stored text is gone. | | ☐ |
| C14 | A page whose title is over 120 characters. | Title field holds the first 120 characters. | | ☐ |
| C15 | Repeat C1–C3 in **Edge**. | Same as Chrome. | | ☐ |
| C16 | Open `/texts/new` with **no** `?from=extension`, post an import from the console. | Ignored. | | ☐ |

Console import for C12 and C16:

```js
window.postMessage({ type: "quiztrick:import", title: "Console test", body: "x".repeat(250), sourceUrl: "" }, location.origin);
```

### Findings

One line each: row id, what happened, who fixes it.

-
-

## Part D — Demo script (about 4 minutes)

Before the demo: extension loaded from the merged main in Chrome, signed in to production, a Canvas course open on a module page, popup not pointed at localhost (no "Developer mode" line).

1. **The problem** (20 s). "Students' notes live in Canvas. Until now you had to copy and paste them into QuizTrick."
2. **Canvas page → quiz** (90 s). On the Canvas page, click the QuizTrick icon. Point out the title, preview and character count. Click Send to QuizTrick. In the new tab, show the filled title and text and the "Imported from Canvas" note. Say: "Nothing is saved until I click Save; the student reviews first." Click Save, then Generate quiz, answer one question.
3. **Highlight only** (40 s). Back in Canvas, highlight two paragraphs, click the icon: the preview is just the highlight. Send. Show it arrive.
4. **Guard rails** (40 s). Highlight one sentence: Send is disabled with the count. Open a `chrome://` tab: "can't read this page". Say: "Only the active tab, only when clicked. No background access to Canvas, no Canvas admin key needed."
5. **What it is and isn't** (30 s). Chrome and Edge, loaded unpacked, no Web Store. Pages, assignments, syllabus, highlighted text. Not PDFs or slides. No API or database change on our side.
6. **Who built what** (20 s). Isaiah the page reader, Hillary the popup, Fardin the editor import, Arnaud the skeleton and handoff.

Fallback if Canvas is slow or down: open a saved page from `tests/fixtures/canvas/` as a local file. Chrome only injects into `file://` tabs when **Allow access to file URLs** is on in the extension's details, so switch that on before the demo and check it once.
