import { describe, expect, it } from "vitest";
import { MESSAGES } from "../../extension/config.js";
import {
  applyImport,
  clampTitle,
  fileFromImport,
  importFileNote,
  parseImportFileMessage,
  IMPORT_MESSAGES,
  IMPORT_NOTE,
  isExtensionImportUrl,
  parseImportMessage,
  type ExtensionImport,
} from "@frontend/components/texts/extension-import";
import { LIMITS } from "@shared/constants";

const self = { window: { name: "this page" }, origin: "https://quiztrick.vercel.app" };
const body = "Cellular respiration turns glucose into ATP. ".repeat(6);
const good = { type: "quiztrick:import", title: "Week 5: Cell Structure", body, sourceUrl: "https://uncp.instructure.com/courses/1/pages/week-5" };
const event = (data: unknown, over: Partial<{ source: unknown; origin: string }> = {}) => ({
  source: self.window,
  origin: self.origin,
  data,
  ...over,
});

describe("message types match the extension (A3.8)", () => {
  it("uses the same type strings as extension/config.js", () => {
    expect(IMPORT_MESSAGES).toEqual(MESSAGES);
  });

  it("uses the agreed note text (A3.7)", () => {
    expect(IMPORT_NOTE).toBe("Imported from Canvas. Review it below before saving.");
  });
});

describe("isExtensionImportUrl (A3.1)", () => {
  it("is true only when the page was opened with from=extension", () => {
    expect(isExtensionImportUrl("?from=extension")).toBe(true);
    expect(isExtensionImportUrl("?x=1&from=extension")).toBe(true);
    expect(isExtensionImportUrl("")).toBe(false);
    expect(isExtensionImportUrl("?from=file")).toBe(false);
    expect(isExtensionImportUrl("?from=extensions")).toBe(false);
  });
});

describe("parseImportMessage (A3.3)", () => {
  it("accepts a well-formed import from this page", () => {
    expect(parseImportMessage(event(good), self)).toEqual({ title: good.title, body, sourceUrl: good.sourceUrl });
  });

  it("ignores messages from another window or another site", () => {
    expect(parseImportMessage(event(good, { source: {} }), self)).toBeNull();
    expect(parseImportMessage(event(good, { source: null }), self)).toBeNull();
    expect(parseImportMessage(event(good, { origin: "https://evil.example" }), self)).toBeNull();
  });

  it("ignores other message types, including its own request and receipt", () => {
    expect(parseImportMessage(event({ ...good, type: "quiztrick:import-request" }), self)).toBeNull();
    expect(parseImportMessage(event({ type: "quiztrick:import-received" }), self)).toBeNull();
    expect(parseImportMessage(event({ ...good, type: "something-else" }), self)).toBeNull();
  });

  it("ignores messages whose fields are missing or not strings", () => {
    expect(parseImportMessage(event(null), self)).toBeNull();
    expect(parseImportMessage(event("quiztrick:import"), self)).toBeNull();
    expect(parseImportMessage(event({ ...good, title: 42 }), self)).toBeNull();
    expect(parseImportMessage(event({ ...good, body: undefined }), self)).toBeNull();
    expect(parseImportMessage(event({ type: good.type, title: good.title, body }), self)).toBeNull();
  });
});

describe("clampTitle (A3.4)", () => {
  it("cuts the title to the editor's limit and trims spaces", () => {
    const long = "T".repeat(LIMITS.TEXT_TITLE_MAX + 30);
    expect(clampTitle(long)).toHaveLength(LIMITS.TEXT_TITLE_MAX);
    expect(clampTitle("  Week 5  ")).toBe("Week 5");
  });

  it("counts an emoji as one character, like the editor's count", () => {
    const title = "📘".repeat(LIMITS.TEXT_TITLE_MAX + 5);
    expect([...clampTitle(title)]).toHaveLength(LIMITS.TEXT_TITLE_MAX);
  });
});

describe("applyImport (A3.4, A3.5, A3.9)", () => {
  const incoming: ExtensionImport = { title: good.title, body, sourceUrl: good.sourceUrl };

  it("fills an empty form with the imported title and body", () => {
    expect(applyImport({ title: "", body: "" }, incoming)).toEqual({ title: "Week 5: Cell Structure", body });
  });

  it("leaves the body exactly as sent, even when it is short; the editor's checks handle that", () => {
    expect(applyImport({ title: "", body: "" }, { ...incoming, body: "Too short." })?.body).toBe("Too short.");
  });

  it("never overwrites text the student already typed", () => {
    expect(applyImport({ title: "", body: "my own notes" }, incoming)).toBeNull();
  });

  it("keeps a title the student typed", () => {
    expect(applyImport({ title: "My title", body: "" }, incoming)).toEqual({ title: "My title", body });
  });

  it("does nothing for a second import once the form is filled", () => {
    const first = applyImport({ title: "", body: "" }, incoming)!;
    expect(applyImport(first, { ...incoming, title: "Other", body: "Other text ".repeat(30) })).toBeNull();
  });

  it("drops an empty import", () => {
    expect(applyImport({ title: "", body: "" }, { ...incoming, body: "   " })).toBeNull();
  });
});

describe("a Canvas file from the extension", () => {
  const goodFile = { type: "quiztrick:import-file", name: "Lecture 3.pptx", mimeType: "application/pdf", dataBase64: "AAEC/w==", sourceUrl: "https://uncp.instructure.com/courses/1/files/3" };

  it("accepts a well-formed file message from this page and trims the name", () => {
    expect(parseImportFileMessage(event({ ...goodFile, name: "  Lecture 3.pptx " }), self)).toEqual({
      name: "Lecture 3.pptx",
      mimeType: "application/pdf",
      dataBase64: "AAEC/w==",
      sourceUrl: goodFile.sourceUrl,
    });
  });

  it("ignores another window, another origin, and the text message type", () => {
    expect(parseImportFileMessage(event(goodFile, { source: {} }), self)).toBeNull();
    expect(parseImportFileMessage(event(goodFile, { origin: "https://evil.example" }), self)).toBeNull();
    expect(parseImportFileMessage(event(good), self)).toBeNull();
    expect(parseImportMessage(event(goodFile), self)).toBeNull();
  });

  it.each([
    ["a missing field", { ...goodFile, mimeType: undefined }],
    ["an empty name", { ...goodFile, name: "   " }],
    ["a name with a path in it", { ...goodFile, name: "../../etc/passwd.pdf" }],
    ["a name over 255 characters", { ...goodFile, name: `${"a".repeat(252)}.pdf` }],
    ["empty contents", { ...goodFile, dataBase64: "" }],
    ["contents that are not base64", { ...goodFile, dataBase64: "<script>" }],
    ["more base64 than a 4 MB file can produce", { ...goodFile, dataBase64: "A".repeat(Math.ceil(LIMITS.DOCUMENT_FILE_MAX_BYTES / 3) * 4 + 4) }],
  ])("drops %s", (_label, data) => {
    expect(parseImportFileMessage(event(data), self)).toBeNull();
  });

  it("accepts exactly as much base64 as a file at the limit produces", () => {
    const dataBase64 = "A".repeat(Math.ceil(LIMITS.DOCUMENT_FILE_MAX_BYTES / 3) * 4);
    expect(parseImportFileMessage(event({ ...goodFile, dataBase64 }), self)).not.toBeNull();
  });

  it("turns the base64 back into the same bytes, name and type", async () => {
    const file = fileFromImport({ name: "Lecture 3.pptx", mimeType: "application/pdf", dataBase64: "AAEC/w==", sourceUrl: "" })!;
    expect(file.name).toBe("Lecture 3.pptx");
    expect(file.type).toBe("application/pdf");
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(new Uint8Array([0, 1, 2, 255]));
  });

  it("returns null when the base64 does not decode", () => {
    expect(fileFromImport({ name: "a.pdf", mimeType: "", dataBase64: "A", sourceUrl: "" })).toBeNull();
  });

  it("says where the file came from", () => {
    expect(importFileNote("Lecture 3.pptx")).toBe("Imported Lecture 3.pptx from Canvas. Review it below before saving.");
  });
});
