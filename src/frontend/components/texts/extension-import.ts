import { LIMITS } from "@shared/constants";

/**
 * The editor's half of the Canvas extension handoff (F-6).
 *
 * The extension's content script (extension/content/deliver.js) and the
 * editor talk over window.postMessage on /texts/new?from=extension:
 *   editor -> extension   { type: "quiztrick:import-request" }
 *   extension -> editor   { type: "quiztrick:import", title, body, sourceUrl }
 *   extension -> editor   { type: "quiztrick:import-file", name, mimeType, dataBase64, sourceUrl }
 *   editor -> extension   { type: "quiztrick:import-received" }
 *
 * Everything here is a pure function so the rules can be tested without a
 * browser. The type strings must match MESSAGES in extension/config.js; a unit
 * test fails if they drift.
 */

export const IMPORT_MESSAGES = {
  request: "quiztrick:import-request",
  import: "quiztrick:import",
  importFile: "quiztrick:import-file",
  received: "quiztrick:import-received",
} as const;

/** Shown in the editor's file-note area after an import fills the form. */
export const IMPORT_NOTE = "Imported from Canvas. Review it below before saving.";

/** A text the extension handed over, after its checks passed. */
export type ExtensionImport = { title: string; body: string; sourceUrl: string };

/** True only when the page was opened by the extension (?from=extension). */
export function isExtensionImportUrl(search: string): boolean {
  try {
    return new URLSearchParams(search).get("from") === "extension";
  } catch {
    return false;
  }
}

/** The parts of a MessageEvent the check needs, so tests can pass plain objects. */
export type ImportEvent = { source: unknown; origin: string; data: unknown };

/**
 * Returns the import when the message is a well-formed import from this very
 * page (same window, same origin, all three fields strings), otherwise null.
 * Anything else, including messages from other frames or sites, is ignored.
 */
export function parseImportMessage(event: ImportEvent, self: { window: unknown; origin: string }): ExtensionImport | null {
  if (event.source !== self.window || event.origin !== self.origin) return null;
  const data = event.data;
  if (typeof data !== "object" || data === null) return null;
  const { type, title, body, sourceUrl } = data as Record<string, unknown>;
  if (type !== IMPORT_MESSAGES.import) return null;
  if (typeof title !== "string" || typeof body !== "string" || typeof sourceUrl !== "string") return null;
  return { title, body, sourceUrl };
}

/** Cuts a title to LIMITS.TEXT_TITLE_MAX characters, counting characters the way the editor does. */
export function clampTitle(title: string): string {
  return [...title.trim()].slice(0, LIMITS.TEXT_TITLE_MAX).join("");
}

/**
 * What the form should hold after an import, or null to drop the import.
 * Never overwrites the student's work: if the body already has text, the
 * import is dropped, and a title the student typed is kept. The body is left
 * exactly as sent; the editor's own count and checks handle too short or too long.
 */
export function applyImport(
  current: { title: string; body: string },
  incoming: ExtensionImport,
): { title: string; body: string } | null {
  if (current.body.trim().length > 0) return null;
  if (incoming.body.trim().length === 0) return null;
  const title = current.title.trim() ? current.title : clampTitle(incoming.title);
  return { title, body: incoming.body };
}

/** A Canvas file the extension handed over, still base64, after its checks passed. */
export type ExtensionFileImport = { name: string; mimeType: string; dataBase64: string; sourceUrl: string };

/** Shown in the editor's file-note area after an imported file has been read. */
export function importFileNote(name: string): string {
  return `Imported ${name} from Canvas. Review it below before saving.`;
}

/** Longest base64 text a file within the upload limit can produce; anything longer is not decoded. */
const FILE_BASE64_MAX = Math.ceil(LIMITS.DOCUMENT_FILE_MAX_BYTES / 3) * 4;
const FILE_NAME_MAX = 255;

/**
 * Returns the file import when the message is a well-formed one from this very
 * page, otherwise null: same rules as parseImportMessage(), plus a file name
 * with no path in it and base64 no longer than the upload limit allows.
 */
export function parseImportFileMessage(event: ImportEvent, self: { window: unknown; origin: string }): ExtensionFileImport | null {
  if (event.source !== self.window || event.origin !== self.origin) return null;
  const data = event.data;
  if (typeof data !== "object" || data === null) return null;
  const { type, name, mimeType, dataBase64, sourceUrl } = data as Record<string, unknown>;
  if (type !== IMPORT_MESSAGES.importFile) return null;
  if (typeof name !== "string" || typeof mimeType !== "string" || typeof dataBase64 !== "string" || typeof sourceUrl !== "string") return null;
  const cleanName = name.trim();
  if (!cleanName || cleanName.length > FILE_NAME_MAX || /[\\/\u0000-\u001f]/u.test(cleanName)) return null;
  if (!dataBase64 || dataBase64.length > FILE_BASE64_MAX || !/^[A-Za-z0-9+/]+={0,2}$/.test(dataBase64)) return null;
  return { name: cleanName, mimeType, dataBase64, sourceUrl };
}

/**
 * Turns an imported file back into a File, so the editor can read it exactly
 * as if the student had chosen it. Null when the base64 does not decode.
 */
export function fileFromImport(incoming: ExtensionFileImport): File | null {
  try {
    const binary = atob(incoming.dataBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], incoming.name, { type: incoming.mimeType });
  } catch {
    return null;
  }
}
