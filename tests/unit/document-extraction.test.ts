import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { extractStudyDocument } from "@backend/services/document.service";
import { validateStudyFile } from "@shared/utils/study-file";
import { LIMITS } from "@shared/constants";

describe("document extraction with real files", () => {
  it.each([
    ["notes.docx", "mitochondria"],
    ["slides.pptx", "Photosynthesis"],
    ["notes.pdf", "cells produce energy"],
  ])("reads %s", async (name, expected) => {
    const bytes = await readFile(`tests/fixtures/documents/${name}`);
    const result = await extractStudyDocument(new File([bytes], name));
    expect(result.text).toContain(expected);
  });
  it("rejects a renamed invalid document with a useful message", async () => {
    await expect(extractStudyDocument(new File(["not a PDF"], "broken.pdf"))).rejects.toThrow("couldn't read");
  });
  it("rejects empty text extraction with OCR guidance", async () => {
    await expect(extractStudyDocument(new File(["   "], "blank.txt"))).rejects.toThrow("No readable text");
  });
  it("accepts supported extensions case insensitively and enforces different size limits", () => {
    for (const name of ["notes.DOCX", "notes.PDF", "slides.PPTX"]) {
      expect(validateStudyFile({ name, size: LIMITS.DOCUMENT_FILE_MAX_BYTES }).ok).toBe(true);
      expect(validateStudyFile({ name, size: LIMITS.DOCUMENT_FILE_MAX_BYTES + 1 }).ok).toBe(false);
    }
    expect(validateStudyFile({ name: "notes.doc", size: 20 }).ok).toBe(false);
    expect(validateStudyFile({ name: "notes.txt", size: LIMITS.TEXT_FILE_MAX_BYTES + 1 }).ok).toBe(false);
  });
});
