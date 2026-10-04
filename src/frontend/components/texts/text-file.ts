import { LIMITS } from "@shared/constants";

export type TextFileCheck = { ok: true } | { ok: false; message: string };

/**
 * Checks a chosen file before it is read into the editor (FR-2.2, FR-2.3).
 * Only plain .txt files up to 100 KB are accepted in the MVP. The API checks
 * the text again after it is cleaned; this just gives a fast, clear message.
 */
export function validateTextFile(file: { name: string; size: number }): TextFileCheck {
  if (!file.name.toLowerCase().endsWith(".txt")) {
    return { ok: false, message: "Only .txt files are supported. Choose a plain text file, or paste your notes instead." };
  }
  if (file.size === 0) {
    return { ok: false, message: "That file is empty. Choose a file with some study text in it." };
  }
  if (file.size > LIMITS.TEXT_FILE_MAX_BYTES) {
    const maxKb = Math.round(LIMITS.TEXT_FILE_MAX_BYTES / 1024);
    return { ok: false, message: `That file is too large. The limit is ${maxKb} KB.` };
  }
  return { ok: true };
}

/** "notes-chapter4.txt" -> "notes-chapter4", trimmed to the title limit. Used to pre-fill an empty title. */
export function titleFromFileName(name: string): string {
  return name.replace(/\.txt$/i, "").trim().slice(0, LIMITS.TEXT_TITLE_MAX);
}
