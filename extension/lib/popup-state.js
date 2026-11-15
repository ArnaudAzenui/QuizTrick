/**
 * What the popup shows for a capture, as a pure function so it can be tested
 * without a browser (H-7). popup.js only renders what this returns.
 *
 * The limits repeat LIMITS.TEXT_MIN_CHARS and LIMITS.TEXT_MAX_CHARS from
 * src/shared/constants.ts, which this file cannot import.
 * tests/unit/extension-popup.test.ts fails if they drift.
 */

export const TEXT_MIN_CHARS = 200;
export const TEXT_MAX_CHARS = 20_000;

/** How much of the text the popup previews, in characters. */
export const PREVIEW_CHARS = 500;

/** Counts characters the way the editor does: by code point, so an emoji is 1. */
export function countCharacters(text) {
  return [...String(text ?? "")].length;
}

const SOURCE_LABELS = {
  selection: "Highlighted text",
  page: "Canvas page",
  assignment: "Canvas assignment",
  syllabus: "Course syllabus",
  content: "Page content",
};

/** The first PREVIEW_CHARS characters, with an ellipsis when there is more. */
export function previewOf(body) {
  const characters = [...String(body ?? "")];
  if (characters.length <= PREVIEW_CHARS) return characters.join("");
  return characters.slice(0, PREVIEW_CHARS).join("").trimEnd() + "…";
}

/**
 * @param {{ kind?: string, title?: string, body?: string, sourceUrl?: string } | null | undefined} capture
 *   What extractFromPage() returned, or null when the page could not be read.
 * @returns {{
 *   state: "unreadable" | "empty" | "short" | "long" | "ready",
 *   source: string, title: string, count: number, countLabel: string,
 *   preview: string, message: string, tone: "muted" | "ok" | "warn" | "error", canSend: boolean,
 * }}
 */
export function describeCapture(capture) {
  if (!capture || typeof capture.body !== "string") {
    return {
      state: "unreadable",
      source: "",
      title: "",
      count: 0,
      countLabel: "",
      preview: "",
      message: "Can't read this page. Chrome keeps extensions out of its own pages, the Web Store and the PDF viewer. Open a Canvas page and try again.",
      tone: "error",
      canSend: false,
    };
  }

  const body = capture.body;
  const count = countCharacters(body);
  const title = typeof capture.title === "string" ? capture.title.trim() : "";
  const source = SOURCE_LABELS[capture.kind] ?? "";
  const max = TEXT_MAX_CHARS.toLocaleString("en-US");
  const base = { source, title, count, preview: previewOf(body) };

  if (count === 0) {
    return {
      ...base,
      state: "empty",
      countLabel: "",
      message: "Nothing to send yet. Highlight the text you want to study, then click the QuizTrick icon again.",
      tone: "muted",
      canSend: false,
    };
  }

  if (count < TEXT_MIN_CHARS) {
    const more = TEXT_MIN_CHARS - count;
    return {
      ...base,
      state: "short",
      countLabel: `${count.toLocaleString("en-US")} / ${max} characters · ${more.toLocaleString("en-US")} more needed (minimum ${TEXT_MIN_CHARS})`,
      message: `Too short for a quiz. Highlight at least ${TEXT_MIN_CHARS} characters and click the icon again.`,
      tone: "warn",
      canSend: false,
    };
  }

  if (count > TEXT_MAX_CHARS) {
    return {
      ...base,
      state: "long",
      countLabel: `${count.toLocaleString("en-US")} / ${max} characters · too long`,
      message: `Over ${max} characters. QuizTrick saves up to ${max}, so highlight the section you want to study, or send it all and trim it in the editor.`,
      tone: "warn",
      canSend: true,
    };
  }

  return {
    ...base,
    state: "ready",
    countLabel: `${count.toLocaleString("en-US")} / ${max} characters`,
    message: "Ready. You can review and edit it in QuizTrick before saving.",
    tone: "ok",
    canSend: true,
  };
}
