import { LIMITS } from "@shared/constants";
export { validateStudyFile as validateTextFile } from "@shared/utils/study-file";

/** Pre-fill the title without changing an existing title in the editor. */
export function titleFromFileName(name: string): string {
  return name.replace(/\.(txt|docx|pdf|pptx)$/i, "").trim().slice(0, LIMITS.TEXT_TITLE_MAX);
}
