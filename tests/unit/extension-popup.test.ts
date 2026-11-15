import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  countCharacters,
  describeCapture,
  PREVIEW_CHARS,
  previewOf,
  TEXT_MAX_CHARS,
  TEXT_MIN_CHARS,
} from "../../extension/lib/popup-state.js";
import { LIMITS } from "@shared/constants";

const extensionDir = path.resolve(__dirname, "../../extension");
const read = (file: string) => readFileSync(path.join(extensionDir, file), "utf8");

const capture = (body: string, over: Partial<{ kind: string; title: string; sourceUrl: string }> = {}) => ({
  kind: "page",
  title: "Week 5: Cell Structure",
  sourceUrl: "https://canvas.example/courses/1/pages/week-5",
  body,
  ...over,
});
const words = (n: number) => "Cells divide. ".repeat(Math.ceil(n / 14)).slice(0, n);

describe("the popup's limits match the editor's (A2.2)", () => {
  it("uses the same minimum and maximum as src/shared/constants.ts", () => {
    expect(TEXT_MIN_CHARS).toBe(LIMITS.TEXT_MIN_CHARS);
    expect(TEXT_MAX_CHARS).toBe(LIMITS.TEXT_MAX_CHARS);
  });

  it("counts by code point, like the editor: an emoji is one character", () => {
    expect(countCharacters("abc")).toBe(3);
    expect(countCharacters("📘📘")).toBe(2);
    expect(countCharacters("")).toBe(0);
    expect(countCharacters(undefined)).toBe(0);
  });
});

describe("describeCapture (A2.1)", () => {
  it("can't read this page: null capture, Send disabled", () => {
    const view = describeCapture(null);
    expect(view.state).toBe("unreadable");
    expect(view.canSend).toBe(false);
    expect(view.message).toMatch(/can't read this page/i);
    expect(view.tone).toBe("error");
  });

  it("treats a capture without a string body as unreadable", () => {
    expect(describeCapture({ kind: "page", title: "x" } as never).state).toBe("unreadable");
  });

  it("nothing to send: an empty body on a readable page, Send disabled, asks for a highlight", () => {
    const view = describeCapture(capture("", { kind: "none" }));
    expect(view.state).toBe("empty");
    expect(view.canSend).toBe(false);
    expect(view.count).toBe(0);
    expect(view.message).toMatch(/highlight/i);
  });

  it("too short: under the minimum, Send disabled, says how many more are needed", () => {
    const view = describeCapture(capture(words(150)));
    expect(view.state).toBe("short");
    expect(view.canSend).toBe(false);
    expect(view.count).toBe(150);
    expect(view.countLabel).toContain("50 more needed");
    expect(view.countLabel).toContain(`minimum ${LIMITS.TEXT_MIN_CHARS}`);
  });

  it("ready: at the minimum and up to the maximum, Send enabled", () => {
    expect(describeCapture(capture(words(LIMITS.TEXT_MIN_CHARS)))).toMatchObject({ state: "ready", canSend: true, tone: "ok" });
    expect(describeCapture(capture(words(LIMITS.TEXT_MAX_CHARS)))).toMatchObject({ state: "ready", canSend: true });
    expect(describeCapture(capture(words(1234))).countLabel).toBe("1,234 / 20,000 characters");
  });

  it("too long: over the maximum, warns to highlight a section, Send still allowed", () => {
    const view = describeCapture(capture(words(LIMITS.TEXT_MAX_CHARS + 1)));
    expect(view.state).toBe("long");
    expect(view.canSend).toBe(true);
    expect(view.tone).toBe("warn");
    expect(view.message).toMatch(/highlight the section/i);
    expect(view.countLabel).toContain("too long");
  });

  it("labels where the text came from and trims the title", () => {
    expect(describeCapture(capture(words(300), { kind: "selection" })).source).toBe("Highlighted text");
    expect(describeCapture(capture(words(300), { kind: "assignment" })).source).toBe("Canvas assignment");
    expect(describeCapture(capture(words(300), { kind: "syllabus" })).source).toBe("Course syllabus");
    expect(describeCapture(capture(words(300), { kind: "content" })).source).toBe("Page content");
    expect(describeCapture(capture(words(300), { kind: "mystery" })).source).toBe("");
    expect(describeCapture(capture(words(300), { title: "  Week 5  " })).title).toBe("Week 5");
  });
});

describe("previewOf", () => {
  it("shows the whole text when it is short, and the first characters with an ellipsis when it is long", () => {
    expect(previewOf("Short.")).toBe("Short.");
    const long = words(PREVIEW_CHARS + 200);
    const preview = previewOf(long);
    expect(preview.endsWith("…")).toBe(true);
    expect(countCharacters(preview)).toBeLessThanOrEqual(PREVIEW_CHARS + 1);
    expect(long.startsWith(preview.slice(0, -1))).toBe(true);
  });

  it("counts the preview by code point too", () => {
    expect(previewOf("📘".repeat(PREVIEW_CHARS))).toBe("📘".repeat(PREVIEW_CHARS));
  });
});

describe("popup files agree with each other (A2.3, A2.5, B1)", () => {
  const html = read("popup.html");
  const js = read("popup.js");

  it("popup.js reads the real extractor and the handoff, and the stub is gone", () => {
    expect(js).toContain('from "./lib/extract.js"');
    expect(js).toContain("func: extractFromPage");
    expect(js).toContain('from "./lib/handoff.js"');
    expect(js).toContain("sendToQuizTrick(");
    expect(js).not.toContain("SAMPLE_TEXT");
    expect(js).not.toContain("readPage");
    expect(js).not.toContain("chrome.storage.local.set");
    expect(js).not.toContain("chrome.tabs.create");
  });

  it("every element popup.js looks up exists in popup.html", () => {
    const ids = [...js.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(html).toContain(`id="${id}"`);
  });

  it("popup.html loads popup.js as a module and popup.css", () => {
    expect(html).toContain('<script type="module" src="popup.js">');
    expect(html).toContain('href="popup.css"');
    expect(html).toContain('role="status"');
  });

  it("popup.css has a dark theme", () => {
    expect(read("popup.css")).toContain("@media (prefers-color-scheme: dark)");
  });
});
