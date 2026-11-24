/**
 * Finds and downloads the files on a Canvas page: Word, PDF and PowerPoint.
 *
 * Both functions are injected with `chrome.scripting.executeScript({ func })`,
 * like extractFromPage(). Chrome copies only the function's source into the
 * tab, so each one declares everything it needs inside itself: no imports, no
 * calls to anything else in this file. tests/unit/extension-files.test.ts
 * rebuilds each from its source text to keep it that way.
 *
 * They run in the Canvas tab on purpose. A request made there carries the
 * student's Canvas session, so the extension needs no Canvas permission of its
 * own and can only reach files the student can already open.
 */

/**
 * Lists the files this page shows or links to, the file the page is about
 * first. Only inside Canvas (`#application.ic-app`); anywhere else it is [].
 *
 * @returns {Array<{ id: string, courseId: string, name: string }>}
 *   `courseId` is "" when the link does not say which course the file is in.
 */
export function findCanvasFiles() {
  const MAX_FILES = 8;
  if (!document.querySelector("#application.ic-app")) return [];

  // /courses/12/files/345, /files/345/download, /courses/12/files/345/preview ...
  const FILE_PATH = /^(?:\/courses\/(\d+))?\/files\/(\d+)(?:\/|$)/;
  const clean = (text) => String(text ?? "").replace(/\s+/g, " ").trim();
  const found = new Map();
  const add = (pathname, name) => {
    const match = FILE_PATH.exec(pathname);
    if (!match) return;
    const [, courseId = "", id] = match;
    const known = found.get(id);
    if (!known) found.set(id, { id, courseId, name });
    else if (!known.name && name) known.name = name; // an icon link came first
  };

  // The file this page previews (Modules -> a file, or Files -> a file).
  const heading = document.querySelector("#content h1, #content h2");
  const here = clean(heading?.textContent) || clean(document.title);
  add(window.location.pathname, here);
  // The Files area previews a file without leaving the list: /courses/12/files?preview=345
  const preview = new URLSearchParams(window.location.search).get("preview");
  if (preview && /^\d+$/.test(preview)) {
    const course = /^\/courses\/(\d+)\/files/.exec(window.location.pathname);
    add(`${course ? `/courses/${course[1]}` : ""}/files/${preview}`, "");
  }

  // Files linked from the page body.
  for (const link of document.querySelectorAll("#content a[href]")) {
    let url;
    try {
      url = new URL(link.getAttribute("href"), window.location.href);
    } catch {
      continue;
    }
    if (url.origin !== window.location.origin) continue;
    // Canvas adds a second, icon-only link per file: "Download notes.pdf".
    const name = clean(link.textContent).replace(/^Download\s+/i, "") || clean(link.getAttribute("title"));
    add(url.pathname, name);
  }

  return [...found.values()].slice(0, MAX_FILES).map((file) => ({ ...file, name: file.name || `File ${file.id}` }));
}

/**
 * Downloads one file through the student's Canvas session and returns it as
 * base64, ready to store. Asks Canvas about the file first, so a file of the
 * wrong type or size is refused before any of it is downloaded.
 *
 * @param {{ id: string, courseId?: string }} file  One entry from findCanvasFiles().
 * @param {{ maxBytes: number, textMaxBytes: number }} limits  The app's upload limits.
 * @returns {Promise<
 *   { ok: true, name: string, mimeType: string, size: number, dataBase64: string } |
 *   { ok: false, reason: "not-found" | "locked" | "unsupported" | "too-large" | "empty" | "download-failed", name: string }
 * >}
 */
export async function downloadCanvasFile(file, limits) {
  const TYPES = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
  };
  const origin = window.location.origin;
  const id = String(file?.id ?? "");
  const courseId = String(file?.courseId ?? "");
  const fail = (reason, name = "") => ({ ok: false, reason, name });
  if (!/^\d+$/.test(id) || (courseId && !/^\d+$/.test(courseId))) return fail("not-found");

  // 1. What Canvas knows about the file: its name, size and where to get it.
  const describe = async (path) => {
    const response = await fetch(origin + path, { headers: { Accept: "application/json" }, credentials: "same-origin" });
    if (!response.ok) return null;
    // Canvas puts `while(1);` in front of JSON it serves to a signed-in browser.
    return JSON.parse((await response.text()).replace(/^while\(1\);/, ""));
  };
  let meta = null;
  try {
    if (courseId) meta = await describe(`/api/v1/courses/${courseId}/files/${id}`);
    if (!meta) meta = await describe(`/api/v1/files/${id}`);
  } catch {
    meta = null;
  }
  if (!meta || typeof meta !== "object") return fail("not-found");

  const name = String(meta.display_name || meta.filename || `file-${id}`);
  if (meta.locked_for_user) return fail("locked", name);
  const extension = name.toLowerCase().split(".").pop() ?? "";
  if (!Object.hasOwn(TYPES, extension)) return fail("unsupported", name);
  const limit = extension === "txt" ? limits.textMaxBytes : limits.maxBytes;
  if (typeof meta.size === "number" && meta.size > limit) return fail("too-large", name);

  // 2. The bytes. Canvas answers with a redirect to wherever it stores files.
  const places = [meta.url, `${origin}/files/${id}/download?download_frd=1`].filter((url) => typeof url === "string" && url);
  let bytes = null;
  for (const url of places) {
    try {
      const response = await fetch(url, { credentials: "same-origin" });
      if (!response.ok) continue;
      bytes = new Uint8Array(await response.arrayBuffer());
      break;
    } catch {
      // Blocked or offline: try the next place.
    }
  }
  if (!bytes) return fail("download-failed", name);
  if (bytes.byteLength === 0) return fail("empty", name);
  if (bytes.byteLength > limit) return fail("too-large", name);

  // 3. As text, because that is all extension storage and messages can carry.
  let binary = "";
  const CHUNK = 0x8000;
  for (let start = 0; start < bytes.length; start += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(start, start + CHUNK));
  }
  return { ok: true, name, mimeType: TYPES[extension], size: bytes.byteLength, dataBase64: btoa(binary) };
}
