// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FILE_LIMITS } from "../../extension/config.js";
import { downloadCanvasFile, findCanvasFiles } from "../../extension/lib/canvas-files.js";
import { describeFileFailure, withFiles, describeCapture } from "../../extension/lib/popup-state.js";
import { LIMITS } from "@shared/constants";
import { validateStudyFile } from "@shared/utils/study-file";

const fixturesDir = path.resolve(__dirname, "../fixtures/canvas");
const sourcePath = path.resolve(__dirname, "../../extension/lib/canvas-files.js");

/** Swaps the whole test document for `html` and moves the URL to `url`. */
function loadPage(html: string, url = "/") {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.replaceChild(document.importNode(parsed.documentElement, true), document.documentElement);
  window.history.replaceState(null, "", url);
}

const canvasPage = (content: string, title = "Canvas") =>
  `<html><head><title>${title}</title></head><body><div id="application" class="ic-app">` +
  `<div id="left-side"><a href="/courses/1/files/999">Sidebar file</a></div>` +
  `<div id="content" role="main">${content}</div></div></body></html>`;

/** What Chrome does: copy the function's source into the tab and call it there. */
const injected = <T>(fn: T): T => new Function(`return (${String(fn)})`)() as T;

afterEach(() => vi.unstubAllGlobals());

describe("canvas-files.js is injected with chrome.scripting.executeScript({ func })", () => {
  it("uses no imports and holds only its two self-contained functions", () => {
    const source = readFileSync(sourcePath, "utf8");
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source.match(/^(export\s+)?(async\s+)?function\s/gm)).toHaveLength(2);
    expect(source.match(/^(export\s+)?(const|let|var|class)\s/gm)).toBeNull();
  });

  it("repeats the app's upload limits exactly", () => {
    expect(FILE_LIMITS).toEqual({ maxBytes: LIMITS.DOCUMENT_FILE_MAX_BYTES, textMaxBytes: LIMITS.TEXT_FILE_MAX_BYTES });
  });
});

describe("findCanvasFiles", () => {
  it("finds the file linked from a real assignment page, rebuilt from source alone", () => {
    loadPage(readFileSync(path.join(fixturesDir, "assignment.html"), "utf8"), "/courses/40856/assignments/1");
    const files = injected(findCanvasFiles)();
    expect(files).toEqual(findCanvasFiles());
    expect(files).toContainEqual({ id: "7539352", courseId: "40856", name: "Presentation- Marking Scheme- Group.docx" });
  });

  it("lists the file a preview page is about first, named by the page heading", () => {
    loadPage(
      canvasPage(`<h2>Lecture 3.pptx</h2><a href="/courses/12/files/345/download?download_frd=1">Download Lecture 3.pptx</a>`),
      "/courses/12/files/345?module_item_id=77",
    );
    expect(findCanvasFiles()).toEqual([{ id: "345", courseId: "12", name: "Lecture 3.pptx" }]);
  });

  it("reads the file previewed inside the Files area (?preview=)", () => {
    loadPage(canvasPage("<h1>Files</h1>"), "/courses/12/files?preview=345");
    expect(findCanvasFiles()).toEqual([{ id: "345", courseId: "12", name: "File 345" }]);
  });

  it("lists each linked file once, taking the name from the text link and not the icon link", () => {
    loadPage(
      canvasPage(
        `<p><a href="/courses/12/files/1/download"><img alt=""></a><a href="/courses/12/files/1?wrap=1">Notes.pdf</a></p>` +
          `<p><a href="${window.location.origin}/files/2/download" title="Slides.pptx"></a></p>` +
          `<p><a href="/courses/12/pages/week-5">A page</a> <a href="https://elsewhere.example/courses/12/files/3">Other site</a></p>`,
      ),
      "/courses/12/pages/week-5",
    );
    expect(findCanvasFiles()).toEqual([
      { id: "1", courseId: "12", name: "Notes.pdf" },
      { id: "2", courseId: "", name: "Slides.pptx" },
    ]);
  });

  it("ignores links outside the content column, caps the list, and finds nothing outside Canvas", () => {
    const many = Array.from({ length: 12 }, (_, n) => `<a href="/courses/1/files/${n + 1}">f${n + 1}.pdf</a>`).join("");
    loadPage(canvasPage(many), "/courses/1/pages/x");
    const files = findCanvasFiles();
    expect(files).toHaveLength(8);
    expect(files.map((file) => file.id)).not.toContain("999");

    loadPage(`<html><body><div id="content"><a href="/courses/1/files/5">notes.pdf</a></div></body></html>`, "/courses/1/files/5");
    expect(findCanvasFiles()).toEqual([]);
  });
});

describe("downloadCanvasFile", () => {
  const origin = window.location.origin;
  const bytes = new Uint8Array(70_000).map((_, i) => i % 251);
  const meta = (over: Record<string, unknown> = {}) => ({
    display_name: "Lecture 3.pptx",
    filename: "Lecture+3.pptx",
    size: bytes.byteLength,
    url: `${origin}/files/345/download?download_frd=1&verifier=abc`,
    ...over,
  });
  const json = (value: unknown, status = 200) => new Response(`while(1);${JSON.stringify(value)}`, { status });

  /** A fake Canvas: answers by URL, records every request. */
  function canvas(routes: Record<string, () => Response | Promise<Response>>) {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      const route = routes[String(url).replace(origin, "")];
      if (!route) throw new TypeError("Failed to fetch");
      return route();
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }
  const download = injected(downloadCanvasFile);

  it("asks Canvas about the file, strips while(1);, downloads it and returns exact base64", async () => {
    const fetchMock = canvas({
      "/api/v1/courses/12/files/345": () => json(meta()),
      "/files/345/download?download_frd=1&verifier=abc": () => new Response(bytes),
    });
    const result = await download({ id: "345", courseId: "12" }, FILE_LIMITS);
    expect(result).toMatchObject({
      ok: true,
      name: "Lecture 3.pptx",
      size: bytes.byteLength,
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
    if (!result.ok) throw new Error("expected a file");
    expect(Uint8Array.from(atob(result.dataBase64), (c) => c.charCodeAt(0))).toEqual(bytes);
    // What comes back passes the editor's own file check.
    expect(validateStudyFile({ name: result.name, size: result.size })).toEqual({ ok: true });
    // Only the student's own Canvas session is used, and only on Canvas.
    for (const [, init] of fetchMock.mock.calls) expect(init?.credentials).toBe("same-origin");
  });

  it("falls back to the file's own address when the course one refuses, and to the plain download link", async () => {
    canvas({
      "/api/v1/courses/12/files/345": () => json({ status: "unauthorized" }, 403),
      "/api/v1/files/345": () => json(meta({ url: undefined })),
      "/files/345/download?download_frd=1": () => new Response(bytes),
    });
    expect(await download({ id: "345", courseId: "12" }, FILE_LIMITS)).toMatchObject({ ok: true, name: "Lecture 3.pptx" });
  });

  it.each([
    ["an old PowerPoint", meta({ display_name: "Lecture 3.ppt" }), "unsupported"],
    ["a file over 4 MB", meta({ size: FILE_LIMITS.maxBytes + 1 }), "too-large"],
    ["a .txt over 100 KB", meta({ display_name: "notes.txt", size: FILE_LIMITS.textMaxBytes + 1 }), "too-large"],
    ["a locked file", meta({ locked_for_user: true }), "locked"],
  ])("refuses %s before downloading any of it", async (_label, described, reason) => {
    const fetchMock = canvas({ "/api/v1/files/345": () => json(described) });
    expect(await download({ id: "345" }, FILE_LIMITS)).toEqual({ ok: false, reason, name: described.display_name });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("checks the real size too, when Canvas understated it", async () => {
    canvas({
      "/api/v1/files/345": () => json(meta({ display_name: "notes.txt", size: 10 })),
      "/files/345/download?download_frd=1&verifier=abc": () => new Response(new Uint8Array(FILE_LIMITS.textMaxBytes + 1)),
    });
    expect(await download({ id: "345" }, FILE_LIMITS)).toMatchObject({ ok: false, reason: "too-large" });
  });

  it("reports an empty file, a blocked download, and a file Canvas will not show", async () => {
    canvas({ "/api/v1/files/1": () => json(meta()), "/files/345/download?download_frd=1&verifier=abc": () => new Response(new Uint8Array(0)) });
    expect(await download({ id: "1" }, FILE_LIMITS)).toMatchObject({ ok: false, reason: "empty" });

    canvas({ "/api/v1/files/2": () => json(meta()) }); // every download throws, as a blocked cross-site redirect does
    expect(await download({ id: "2" }, FILE_LIMITS)).toEqual({ ok: false, reason: "download-failed", name: "Lecture 3.pptx" });

    canvas({ "/api/v1/files/3": () => json({ message: "not found" }, 404) });
    expect(await download({ id: "3" }, FILE_LIMITS)).toEqual({ ok: false, reason: "not-found", name: "" });
  });

  it("never builds a request from an id that is not a number", async () => {
    const fetchMock = canvas({});
    expect(await download({ id: "345/../../users/self" }, FILE_LIMITS)).toMatchObject({ ok: false, reason: "not-found" });
    expect(await download({ id: "345", courseId: "x" }, FILE_LIMITS)).toMatchObject({ ok: false, reason: "not-found" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("what the popup says about files", () => {
  const short = describeCapture({ kind: "content", title: "Lecture 3.pptx", body: "Download Lecture 3.pptx", sourceUrl: "" });

  it("points at the file list instead of 'too short' when the page is a file", () => {
    expect(short.state).toBe("short");
    const view = withFiles(short, 1);
    expect(view.message).toMatch(/choose it below/i);
    expect(view.tone).toBe("muted");
    expect(view.canSend).toBe(false);
    expect(withFiles(short, 3).message).toMatch(/choose one below/i);
  });

  it("leaves the view alone when there are no files, or the text can be sent anyway", () => {
    expect(withFiles(short, 0)).toBe(short);
    const ready = describeCapture({ kind: "page", title: "Week 5", body: "x".repeat(400), sourceUrl: "" });
    expect(withFiles(ready, 2)).toBe(ready);
    const unreadable = describeCapture(null);
    expect(withFiles(unreadable, 2)).toBe(unreadable);
  });

  it("explains each failure in words a student can act on", () => {
    expect(describeFileFailure({ reason: "unsupported", name: "Lecture 3.ppt" })).toMatch(/Lecture 3\.ppt is not a type.*\.pptx/);
    expect(describeFileFailure({ reason: "too-large", name: "Big.pdf" })).toContain("4 MB");
    expect(describeFileFailure({ reason: "locked", name: "Exam.pdf" })).toContain("locked");
    expect(describeFileFailure({ reason: "empty", name: "Blank.docx" })).toContain("empty");
    expect(describeFileFailure({ reason: "not-found", name: "" })).toMatch(/would not show/);
    expect(describeFileFailure({ reason: "download-failed", name: "Notes.pdf" })).toMatch(/Download it there, then upload/);
    expect(describeFileFailure(null)).toMatch(/Couldn't get That file/);
  });
});
