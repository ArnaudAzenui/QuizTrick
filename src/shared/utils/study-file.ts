import { LIMITS } from "@shared/constants";

export const STUDY_FILE_ACCEPT = ".txt,.docx,.pdf,.pptx";
export function studyFileExtension(name: string) {
  return name.toLowerCase().split(".").pop() ?? "";
}
export function validateStudyFile(file: { name: string; size: number }): { ok: true } | { ok: false; message: string } {
  const extension = studyFileExtension(file.name);
  if (!["txt", "docx", "pdf", "pptx"].includes(extension)) {
    return { ok: false, message: "Choose a .txt, .docx, .pdf, or .pptx file. For older .doc or .ppt files, save a copy as .docx or .pptx first." };
  }
  if (file.size === 0) return { ok: false, message: "That file is empty. Choose a file with some study text in it." };
  const limit = extension === "txt" ? LIMITS.TEXT_FILE_MAX_BYTES : LIMITS.DOCUMENT_FILE_MAX_BYTES;
  if (file.size > limit) return { ok: false, message: `That file is too large. The limit is ${extension === "txt" ? "100 KB" : "4 MB"}.` };
  return { ok: true };
}
