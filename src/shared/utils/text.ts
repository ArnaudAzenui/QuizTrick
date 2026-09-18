import { LIMITS } from "../constants";

/**
 * StudyText.clean() — FR-2.5: trim whitespace and strip non-printable
 * control characters (keeps \n and \t so paragraphs survive).
 */
export function cleanStudyText(raw: string): string {
  // Keep \t (0x09), \n (0x0A), \r (0x0D); drop every other C0/C1 control character.
  const withoutControls = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");
  return withoutControls.replace(/\r\n?/g, "\n").trim();
}

export type TextValidation =
  | { ok: true; cleaned: string; charCount: number }
  | { ok: false; message: string; charCount: number };

/**
 * StudyText.validate() — FR-2.4. Runs the same way in the browser (live
 * feedback) and on the server (authoritative check, SEC-5).
 */
export function validateStudyText(raw: string): TextValidation {
  const cleaned = cleanStudyText(raw ?? "");
  const charCount = cleaned.length;
  if (charCount === 0) {
    return { ok: false, charCount, message: "Paste or upload some study text to get started." };
  }
  if (charCount < LIMITS.TEXT_MIN_CHARS) {
    return {
      ok: false,
      charCount,
      message: `Study text must be at least ${LIMITS.TEXT_MIN_CHARS} characters (you have ${charCount}). Add more material and try again.`,
    };
  }
  if (charCount > LIMITS.TEXT_MAX_CHARS) {
    return {
      ok: false,
      charCount,
      message: `Study text must be at most ${LIMITS.TEXT_MAX_CHARS.toLocaleString()} characters (you have ${charCount.toLocaleString()}). Shorten it and try again.`,
    };
  }
  return { ok: true, cleaned, charCount };
}

/** Splits a question count into the 70/30 MCQ / short-answer mix, rounded (FR-3.3). */
export function splitQuestionMix(total: number): { mcq: number; shortAnswer: number } {
  const mcq = Math.round(total * LIMITS.MCQ_RATIO);
  return { mcq, shortAnswer: total - mcq };
}
