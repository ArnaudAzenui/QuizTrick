import { readFile } from "node:fs/promises";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const admin = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), insert: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@backend/supabase/admin", () => ({ createAdminClient: () => admin }));

import { extractStudyDocument } from "@backend/services/document.service";
import { validateStudyFile } from "@shared/utils/study-file";
import { LIMITS } from "@shared/constants";

const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
afterAll(() => quiet.mockRestore());

beforeEach(() => {
  vi.clearAllMocks();
  admin.rpc.mockResolvedValue({ data: 0, error: null });
  admin.insert.mockResolvedValue({ error: null });
  admin.from.mockReturnValue({ insert: admin.insert });
});

describe("document extraction with real files", () => {
  it.each([
    ["notes.docx", "mitochondria"],
    ["slides.pptx", "Photosynthesis"],
    ["notes.pdf", "cells produce energy"],
  ])("reads %s", async (name, expected) => {
    const bytes = await readFile(`tests/fixtures/documents/${name}`);
    const result = await extractStudyDocument("user-1", new File([bytes], name));
    expect(result.text).toContain(expected);
  });
  it("rejects a renamed invalid document with a useful message", async () => {
    await expect(extractStudyDocument("user-1", new File(["not a PDF"], "broken.pdf"))).rejects.toThrow("couldn't read");
  });
  it("rejects empty text extraction with OCR guidance", async () => {
    await expect(extractStudyDocument("user-1", new File(["   "], "blank.txt"))).rejects.toThrow("No readable text");
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

describe("upload rate limit (SEC-6)", () => {
  const pdf = async () => new File([await readFile("tests/fixtures/documents/notes.pdf")], "notes.pdf");

  it("counts the caller's last hour, then logs the request before parsing", async () => {
    await extractStudyDocument("user-1", await pdf());
    expect(admin.rpc).toHaveBeenCalledWith("count_recent_extractions", { p_owner_id: "user-1" });
    expect(admin.from).toHaveBeenCalledWith("extraction_requests");
    expect(admin.insert).toHaveBeenCalledWith({ owner_id: "user-1" });
  });
  it("allows the last upload inside the limit", async () => {
    admin.rpc.mockResolvedValue({ data: LIMITS.EXTRACTIONS_PER_HOUR - 1, error: null });
    await expect(extractStudyDocument("user-1", await pdf())).resolves.toHaveProperty("text");
  });
  it("refuses the next one with RATE_LIMITED and logs nothing", async () => {
    admin.rpc.mockResolvedValue({ data: LIMITS.EXTRACTIONS_PER_HOUR, error: null });
    await expect(extractStudyDocument("user-1", await pdf())).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(admin.insert).not.toHaveBeenCalled();
  });
  it("counts a document that turns out to be unreadable", async () => {
    await expect(extractStudyDocument("user-1", new File(["not a PDF"], "broken.pdf"))).rejects.toThrow("couldn't read");
    expect(admin.insert).toHaveBeenCalledTimes(1);
  });
  it("costs no quota for a file type or size it would never parse", async () => {
    await expect(extractStudyDocument("user-1", new File(["x"], "notes.doc"))).rejects.toMatchObject({ code: "VALIDATION" });
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(admin.insert).not.toHaveBeenCalled();
  });
  it.each([
    ["the count", () => admin.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "down" } })],
    ["the log write", () => admin.insert.mockResolvedValue({ error: { code: "XX000", message: "down" } })],
  ])("fails closed with INTERNAL when %s fails", async (_label, breakIt) => {
    breakIt();
    await expect(extractStudyDocument("user-1", await pdf())).rejects.toMatchObject({ code: "INTERNAL" });
  });
});
