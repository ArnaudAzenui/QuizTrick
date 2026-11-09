export type ContentQuality = { level: "ok" | "warning" | "unusable"; message?: string };

/** Conservative, language-independent checks; equations and unfamiliar vocabulary are valid notes. */
export function assessContentQuality(text: string): ContentQuality {
  const compact = [...text.replace(/\s/gu, "")];
  if (!compact.length) return { level: "ok" }; // Existing length validation handles empty input.
  const readable = compact.filter(character => /[\p{L}\p{N}]/u.test(character)).length;
  const broken = compact.filter(character => character === "\uFFFD").length;
  const tokens = text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const unique = new Set(tokens);
  if (broken / compact.length > 0.08 || (compact.length >= 100 && readable / compact.length < 0.1)) {
    return { level: "unusable", message: "This text appears unreadable or garbled. Review the extraction, try another file, or paste clean notes before generating a quiz." };
  }
  if ((tokens.length >= 30 && unique.size <= 3) || /([^\s])\1{49}/u.test(text)) {
    return { level: "unusable", message: "This text contains mostly repeated content. Add clear study material with several distinct facts before generating a quiz." };
  }
  if (text.trim().length >= 200 && (unique.size < 15 || readable / compact.length < 0.45)) {
    return { level: "warning", message: "This material may contain little useful text or extraction errors. Review it before generating. Equations, vocabulary lists, and technical notes can still be valid." };
  }
  return { level: "ok" };
}
