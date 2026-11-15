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

function fakeChrome(result: unknown, opts: { executeFails?: boolean } = {}) {
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
    executeScript: vi.fn<(injection: { target: { tabId: number }; func: unknown }) => Promise<Array<{ result: unknown }>>>(async () => {
      if (opts.executeFails) throw new Error("Cannot access a chrome:// URL");
      return [{ result }];
    }),
  };
  return { chrome: { storage: { local: storage }, tabs, scripting }, data, tabs, scripting };
}

async function loadPopup(result: unknown, opts: { executeFails?: boolean } = {}) {
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
