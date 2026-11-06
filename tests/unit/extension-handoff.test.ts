import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  APP_URL,
  APP_URL_OVERRIDE_KEY,
  IMPORT_MAX_AGE_MS,
  IMPORT_PATH,
  LOCAL_URL,
  MESSAGES,
  STORAGE_KEY,
} from "../../extension/config.js";
import { resolveAppUrl, sendToQuizTrick } from "../../extension/lib/handoff.js";
import { ROUTES } from "@shared/constants";

const extensionDir = path.resolve(__dirname, "../../extension");
const read = (file: string) => readFileSync(path.join(extensionDir, file), "utf8");

/** An in-memory stand-in for chrome.storage.local. */
function fakeStorage(initial: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...initial };
  return {
    data,
    get: vi.fn(async (key: string) => (key in data ? { [key]: data[key] } : {})),
    set: vi.fn(async (items: Record<string, unknown>) => void Object.assign(data, items)),
    remove: vi.fn(async (key: string) => void delete data[key]),
  };
}

/** Lets the promise chains inside the extension code settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("extension manifest", () => {
  const manifest = JSON.parse(read("manifest.json"));

  it("is Manifest V3 and asks only for the current tab, script injection and storage", () => {
    expect(manifest.manifest_version).toBe(3);
    expect([...manifest.permissions].sort()).toEqual(["activeTab", "scripting", "storage"]);
    expect(manifest.host_permissions).toBeUndefined();
  });

  it("runs the delivery script on every page of both app origins in config.js", () => {
    // Every page, not only the editor: a signed-out student reaches the editor
    // from /login by a client-side navigation, which loads no new page.
    const [script] = manifest.content_scripts;
    expect([...script.matches].sort()).toEqual([`${APP_URL}/*`, `${LOCAL_URL}/*`].sort());
    expect(script.js).toEqual(["content/deliver.js"]);
  });

  it("points at files that exist", () => {
    expect(() => read(manifest.action.default_popup)).not.toThrow();
    for (const file of manifest.content_scripts[0].js) expect(() => read(file)).not.toThrow();
  });
});

describe("the contract in config.js", () => {
  it("opens the app's real Add study text route", () => {
    expect(IMPORT_PATH).toBe(`${ROUTES.newText}?from=extension`);
  });

  it("is repeated exactly in content/deliver.js, which cannot import it", () => {
    const source = read("content/deliver.js");
    for (const value of [STORAGE_KEY, MESSAGES.request, MESSAGES.import, MESSAGES.received, ROUTES.newText]) {
      expect(source).toContain(`"${value}"`);
    }
    expect(IMPORT_MAX_AGE_MS).toBe(10 * 60 * 1000);
    expect(source).toContain("IMPORT_MAX_AGE_MS = 10 * 60 * 1000");
  });
});

describe("sendToQuizTrick", () => {
  let storage: ReturnType<typeof fakeStorage>;
  let createTab: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storage = fakeStorage();
    createTab = vi.fn(async () => ({}));
    vi.stubGlobal("chrome", { storage: { local: storage }, tabs: { create: createTab } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("stores the capture with a timestamp, then opens the editor on production", async () => {
    const before = Date.now();
    await sendToQuizTrick({ title: "Week 5", body: "Cells divide.", sourceUrl: "https://canvas.example/pages/week-5" });

    const pending = storage.data[STORAGE_KEY] as { capturedAt: number };
    expect(pending).toMatchObject({ title: "Week 5", body: "Cells divide.", sourceUrl: "https://canvas.example/pages/week-5" });
    expect(pending.capturedAt).toBeGreaterThanOrEqual(before);
    expect(createTab).toHaveBeenCalledWith({ url: `${APP_URL}${IMPORT_PATH}` });
    // Opening the tab closes the popup, so the text has to be stored first.
    expect(storage.set.mock.invocationCallOrder[0]).toBeLessThan(createTab.mock.invocationCallOrder[0]);
  });

  it("fills in an empty title and source when the page gave none", async () => {
    await sendToQuizTrick({ body: "Cells divide." });
    expect(storage.data[STORAGE_KEY]).toMatchObject({ title: "", sourceUrl: "" });
  });

  it("refuses to send nothing, and opens no tab", async () => {
    await expect(sendToQuizTrick({ body: "   \n " })).rejects.toThrow("no text");
    expect(createTab).not.toHaveBeenCalled();
    expect(storage.data[STORAGE_KEY]).toBeUndefined();
  });

  it("sends to the dev server only when a developer switched it on", async () => {
    storage.data[APP_URL_OVERRIDE_KEY] = LOCAL_URL;
    await sendToQuizTrick({ body: "Cells divide." });
    expect(createTab).toHaveBeenCalledWith({ url: `${LOCAL_URL}${IMPORT_PATH}` });
  });

  it("ignores any other override, so storage can never point it at another site", async () => {
    storage.data[APP_URL_OVERRIDE_KEY] = "https://evil.example";
    expect(await resolveAppUrl()).toBe(APP_URL);
  });
});

describe("content/deliver.js", () => {
  const ORIGIN = "http://localhost:3000";
  const capture = { title: "Week 5", body: "Cells divide.", sourceUrl: "https://canvas.example/pages/week-5" };

  /** Runs the content script against a fake page and fake extension storage. */
  function load(pathname: string, stored: Record<string, unknown> = {}) {
    const storage = fakeStorage(stored);
    const listeners: Array<(event: unknown) => void> = [];
    const posted: Array<{ data: unknown; targetOrigin: string }> = [];
    const page = {
      location: { origin: ORIGIN, pathname },
      addEventListener: (_type: string, listener: (event: unknown) => void) => void listeners.push(listener),
      postMessage: (data: unknown, targetOrigin: string) => void posted.push({ data, targetOrigin }),
    };
    new Function("chrome", "window", read("content/deliver.js"))({ storage: { local: storage } }, page);
    /** Delivers a message the way the browser would, from this page unless told otherwise. */
    const receive = (data: unknown, from: { source?: unknown; origin?: string } = {}) =>
      listeners.forEach((listener) => listener({ data, source: from.source ?? page, origin: from.origin ?? ORIGIN }));
    return { storage, posted, receive };
  }

  const fresh = () => ({ [STORAGE_KEY]: { ...capture, capturedAt: Date.now() } });

  it("offers the text as soon as it loads on the editor page", async () => {
    const { posted } = load(ROUTES.newText, fresh());
    await settle();
    expect(posted).toEqual([{ data: { type: MESSAGES.import, ...capture }, targetOrigin: ORIGIN }]);
  });

  it("stays quiet on other pages, then answers when the editor asks (signed-out flow)", async () => {
    const { posted, receive } = load(ROUTES.login, fresh());
    await settle();
    expect(posted).toEqual([]);

    receive({ type: MESSAGES.request });
    await settle();
    expect(posted).toEqual([{ data: { type: MESSAGES.import, ...capture }, targetOrigin: ORIGIN }]);
  });

  it("keeps the text until the editor confirms, then forgets it", async () => {
    const { storage, receive } = load(ROUTES.newText, fresh());
    await settle();
    expect(storage.data[STORAGE_KEY]).toBeDefined();

    receive({ type: MESSAGES.received });
    await settle();
    expect(storage.data[STORAGE_KEY]).toBeUndefined();
  });

  it("ignores messages from another origin or another window", async () => {
    const { storage, posted, receive } = load(ROUTES.login, fresh());
    receive({ type: MESSAGES.request }, { origin: "https://evil.example" });
    receive({ type: MESSAGES.request }, { source: {} });
    receive({ type: MESSAGES.received }, { origin: "https://evil.example" });
    await settle();
    expect(posted).toEqual([]);
    expect(storage.data[STORAGE_KEY]).toBeDefined();
  });

  it("throws away a capture older than ten minutes instead of delivering it", async () => {
    const stale = { [STORAGE_KEY]: { ...capture, capturedAt: Date.now() - IMPORT_MAX_AGE_MS - 1000 } };
    const { storage, posted } = load(ROUTES.newText, stale);
    await settle();
    expect(posted).toEqual([]);
    expect(storage.data[STORAGE_KEY]).toBeUndefined();
  });

  it("does nothing when there is no capture, or when the extension's storage is gone", async () => {
    const empty = load(ROUTES.newText);
    await settle();
    expect(empty.posted).toEqual([]);

    // What Chrome does after the extension is reloaded while the tab stays open.
    const broken = load(ROUTES.login, fresh());
    broken.storage.get.mockRejectedValue(new Error("Extension context invalidated."));
    broken.storage.remove.mockRejectedValue(new Error("Extension context invalidated."));
    broken.receive({ type: MESSAGES.request });
    broken.receive({ type: MESSAGES.received });
    await settle();
    expect(broken.posted).toEqual([]);
  });
});
