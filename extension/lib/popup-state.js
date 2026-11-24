// Keep these limits in sync with the study text editor.
export const TEXT_MIN_CHARS = 200;
export const TEXT_MAX_CHARS = 20_000;

// Show a short preview without changing the text we send.
export const PREVIEW_CHARS = 500;

// Count characters the same way as the editor.
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

/**
 * The same view, reworded when the page has files and no text worth sending:
 * on a file's own page the text is only Canvas's "Download" line, and "too
 * short" would send the student off to highlight something that is not there.
 *
 * @param {ReturnType<typeof describeCapture>} view
 * @param {number} fileCount  How many files findCanvasFiles() listed.
 */
export function withFiles(view, fileCount) {
  if (!fileCount || view.state === "unreadable" || view.canSend) return view;
  return {
    ...view,
    // The few words on a file's page are Canvas's own ("Download notes.pdf"), not study text.
    source: fileCount === 1 ? "Canvas file" : "Canvas files",
    preview: "",
    countLabel: "",
    message: fileCount === 1
      ? "This page has a file. Choose it below to send it to QuizTrick."
      : "This page has files. Choose one below to send it to QuizTrick.",
    tone: "muted",
  };
}

/**
 * What to tell the student when a Canvas file could not be sent.
 *
 * @param {{ reason?: string, name?: string } | null | undefined} result
 *   What downloadCanvasFile() returned, or null when it could not run at all.
 * @returns {string}
 */
export function describeFileFailure(result) {
  const name = typeof result?.name === "string" && result.name.trim() ? result.name.trim() : "That file";
  switch (result?.reason) {
    case "unsupported":
      return `${name} is not a type QuizTrick reads. It reads Word (.docx), PDF, PowerPoint (.pptx) and .txt. For older .doc or .ppt files, save a copy as .docx or .pptx first.`;
    case "too-large":
      return `${name} is over the 4 MB limit (100 KB for .txt). Open it and highlight the part you want instead.`;
    case "locked":
      return `${name} is locked in Canvas, so it can't be read yet.`;
    case "empty":
      return `${name} is empty.`;
    case "not-found":
      return "Canvas would not show that file. Check that you can open it, then try again.";
    default:
      return `Couldn't get ${name} from Canvas. Download it there, then upload it on QuizTrick's Add study text page.`;
  }
}
