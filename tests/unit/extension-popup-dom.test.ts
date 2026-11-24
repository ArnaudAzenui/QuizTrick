// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_URL, IMPORT_PATH, STORAGE_KEY } from "../../extension/config.js";

/**
 * Runs the real popup.html + popup.js against a fake `chrome`, the way the
 * browser does, so the render path is covered and not only lib/popup-state.js.
 */
const html = readFileSync(path.resolve(__dirname, "../../extension/popup.html"), "utf8");
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

type Opts = { executeFails?: boolean; files?: unknown; download?: unknown };

function fakeChrome(result: unknown, opts: Opts = {}) {
  const data: Record<string, unknown> = {};
  const storage = {
    get: vi.fn(async (key: string) => (key in data ? { [key]: data[key] } : {})),
    set: vi.fn(async (items: Record<string, unknown>) => void Object.assign(data, items)),
    remove: vi.fn(async (key: string) => void delete data[key]),
  };
  const tabs = {
    query: vi.fn(async () => [{ id: 7 }]),
    create: vi.fn(async () => ({})),
  };
  const scripting = {
    executeScript: vi.fn<(injection: { target: { tabId: number }; func: { name: string }; args?: unknown[] }) => Promise<Array<{ result: unknown }>>>(async ({ func }) => {
      if (opts.executeFails) throw new Error("Cannot access a chrome:// URL");
      if (func.name === "findCanvasFiles") return [{ result: opts.files ?? [] }];
      if (func.name === "downloadCanvasFile") return [{ result: opts.download }];
      return [{ result }];
    }),
  };
  return { chrome: { storage: { local: storage }, tabs, scripting }, data, tabs, scripting };
}

async function loadPopup(result: unknown, opts: Opts = {}) {
  const fake = fakeChrome(result, opts);
  vi.stubGlobal("chrome", fake.chrome);
  document.documentElement.innerHTML = html.replace(/<script[^>]*><\/script>/, "");
  vi.resetModules();
  await import("../../extension/popup.js");
  await settle();
  await settle();
  const el = (id: string) => document.getElementById(id) as HTMLElement;
  return { ...fake, el, send: el("send") as HTMLButtonElement, status: el("status") };
}

const words = (n: number) => "Cells divide. ".repeat(Math.ceil(n / 14)).slice(0, n);
const page = { kind: "page", title: "Week 5", body: words(900), sourceUrl: "https://canvas.example/courses/1/pages/week-5" };

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("popup.js in a document", () => {
  it("reads the active tab with the injected extractor and renders the ready state", async () => {
    const { el, send, status, scripting, tabs } = await loadPopup(page);
    expect(tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(scripting.executeScript).toHaveBeenCalledWith(expect.objectContaining({ target: { tabId: 7 } }));
    expect(typeof scripting.executeScript.mock.calls[0]?.[0].func).toBe("function");
    expect(document.body.dataset.state).toBe("ready");
    expect(el("source").textContent).toBe("Canvas page");
    expect(el("title").textContent).toBe("Week 5");
    expect(el("preview").hidden).toBe(false);
    expect(el("count").textContent).toBe("900 / 20,000 characters");
    expect(status.dataset.tone).toBe("ok");
    expect(send.disabled).toBe(false);
  });

  it("Send stores the capture and opens the editor on production", async () => {
    const { send, data, tabs } = await loadPopup(page);
    send.click();
    await settle();
    await settle();
    expect(data[STORAGE_KEY]).toMatchObject({ title: "Week 5", body: page.body, sourceUrl: page.sourceUrl });
    expect(tabs.create).toHaveBeenCalledWith({ url: `${APP_URL}${IMPORT_PATH}` });
  });

  it("disables Send and says so when the text is too short", async () => {
    const { send, status } = await loadPopup({ ...page, body: words(120) });
    expect(document.body.dataset.state).toBe("short");
    expect(send.disabled).toBe(true);
    expect(status.textContent).toMatch(/too short/i);
  });

  it("warns but still allows Send when the text is too long", async () => {
    const { send, status } = await loadPopup({ ...page, body: words(20_001) });
    expect(document.body.dataset.state).toBe("long");
    expect(send.disabled).toBe(false);
    expect(status.dataset.tone).toBe("warn");
  });

  it("shows the can't-read state when Chrome refuses to inject", async () => {
    const { send, status, el } = await loadPopup(null, { executeFails: true });
    expect(document.body.dataset.state).toBe("unreadable");
    expect(send.disabled).toBe(true);
    expect(status.textContent).toMatch(/can't read this page/i);
    expect(el("preview").hidden).toBe(true);
  });

  it("asks for a highlight when a readable page has nothing to send", async () => {
    const { send, status } = await loadPopup({ kind: "none", title: "Wikipedia", body: "", sourceUrl: "https://example.org" });
    expect(document.body.dataset.state).toBe("empty");
    expect(send.disabled).toBe(true);
    expect(status.textContent).toMatch(/highlight/i);
  });

  it("stays on production unless the developer override is set", async () => {
    const { el } = await loadPopup(page);
    expect(el("target").hidden).toBe(true);
  });
});

describe("files on the Canvas page", () => {
  const filePage = { kind: "content", title: "Lecture 3.pptx", body: "Download Lecture 3.pptx", sourceUrl: "https://canvas.example/courses/12/files/345" };
  const files = [
    { id: "345", courseId: "12", name: "Lecture 3.pptx" },
    { id: "346", courseId: "12", name: "Notes.pdf" },
  ];
  const fileButtons = () => [...document.querySelectorAll<HTMLButtonElement>("#file-list button")];

  it("hides the list when the page has no files", async () => {
    const { el } = await loadPopup(page);
    expect(el("files").hidden).toBe(true);
    expect(fileButtons()).toHaveLength(0);
  });

  it("lists one button per file and points at them when there is no text to send", async () => {
    const { el, send, status } = await loadPopup(filePage, { files });
    expect(el("files").hidden).toBe(false);
    expect(fileButtons().map((button) => button.textContent)).toEqual(["Lecture 3.pptx", "Notes.pdf"]);
    expect(send.disabled).toBe(true);
    expect(status.textContent).toMatch(/choose one below/i);
  });

  it("downloads the chosen file in the tab with the app's limits, stores it and opens the editor", async () => {
    const download = { ok: true, name: "Lecture 3.pptx", mimeType: "application/x-test", size: 3, dataBase64: "AAEC" };
    const { data, tabs, scripting } = await loadPopup(filePage, { files, download });
    fileButtons()[0].click();
    await settle();
    await settle();

    const call = scripting.executeScript.mock.calls.find(([injection]) => injection.func.name === "downloadCanvasFile")!;
    expect(call[0].target).toEqual({ tabId: 7 });
    expect(call[0].args).toEqual([files[0], { maxBytes: 4 * 1024 * 1024, textMaxBytes: 100 * 1024 }]);
    expect(data[STORAGE_KEY]).toMatchObject({
      file: { name: "Lecture 3.pptx", mimeType: "application/x-test", dataBase64: "AAEC" },
      sourceUrl: filePage.sourceUrl,
    });
    expect(tabs.create).toHaveBeenCalledWith({ url: `${APP_URL}${IMPORT_PATH}` });
    expect(fileButtons().every((button) => button.disabled)).toBe(true);
  });

  it("says why a file could not be sent, opens nothing, and lets the student pick again", async () => {
    const { data, tabs, status, send } = await loadPopup({ ...page }, { files, download: { ok: false, reason: "unsupported", name: "Lecture 3.ppt" } });
    fileButtons()[0].click();
    await settle();
    await settle();
    expect(status.dataset.tone).toBe("error");
    expect(status.textContent).toMatch(/Lecture 3\.ppt is not a type/);
    expect(data[STORAGE_KEY]).toBeUndefined();
    expect(tabs.create).not.toHaveBeenCalled();
    expect(fileButtons().every((button) => !button.disabled)).toBe(true);
    expect(send.disabled).toBe(false); // the page text can still be sent
  });
});
