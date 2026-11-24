import { OfficeParser } from "officeparser";
import { AppError } from "@backend/lib/errors";
import { createAdminClient } from "@backend/supabase/admin";
import { LIMITS } from "@shared/constants";
import { cleanStudyText } from "@shared/utils/text";
import { studyFileExtension, validateStudyFile } from "@shared/utils/study-file";

/**
 * SEC-6. Counted, then logged, before the file is parsed, so every parse
 * attempt uses up quota whether or not the document turns out to be readable.
 */
async function enforceRateLimit(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: recent, error: countError } = await admin.rpc("count_recent_extractions", { p_owner_id: userId });
  if (countError) {
    console.error("[documents] count_recent_extractions failed", countError.code, countError.message);
    throw AppError.internal();
  }
  if (typeof recent === "number" && recent >= LIMITS.EXTRACTIONS_PER_HOUR) {
    throw AppError.rateLimited(
      `You can upload up to ${LIMITS.EXTRACTIONS_PER_HOUR} documents an hour. Please wait a little, or paste the text instead.`,
    );
  }

  const { error: logError } = await admin.from("extraction_requests").insert({ owner_id: userId });
  if (logError) {
    console.error("[documents] could not record extraction request", logError.code, logError.message);
    throw AppError.internal();
  }
}

/** Extract in memory: the original upload is never stored or sent to an AI service. */
export async function extractStudyDocument(userId: string, file: File): Promise<{ text: string }> {
  const validation = validateStudyFile(file);
  if (!validation.ok) throw AppError.validation(validation.message);
  // After validation, so a wrong file type or an oversized file costs no quota.
  await enforceRateLimit(userId);
  const extension = studyFileExtension(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  let text: string;
  try {
    if (extension === "txt") {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } else {
      const pdf = extension === "pdf";
      if (pdf ? !buffer.subarray(0, 1024).includes(Buffer.from("%PDF-")) : buffer.readUInt32LE(0) !== 0x04034b50) {
        throw new Error("Invalid document signature");
      }
      const ast = await OfficeParser.parseOffice(buffer, {
        fileType: extension as "docx" | "pdf" | "pptx",
        ocr: false,
        extractAttachments: false,
        ignoreNotes: false,
        abortSignal: AbortSignal.timeout(20_000),
        // Compressed Office files can expand far beyond their upload size.
        decompressionLimits: { maxUncompressedBytes: 32 * 1024 * 1024, maxZipEntries: 2000, maxXmlElements: 150_000, maxTableCells: 20_000 },
      });
      text = (await ast.to("text")).value as string;
    }
  } catch {
    throw AppError.validation("We couldn't read that document. It may be damaged, password-protected, or too complex. Try exporting it again, or paste the text instead.");
  }
  const cleaned = cleanStudyText(text);
  if (!cleaned.trim()) throw AppError.validation("No readable text was found. Scanned PDFs and image-only slides need OCR first. Try a document with selectable text, or paste your notes.");
  // Keep all extracted text for review; the existing editor enforces the save limit.
  return { text: cleaned };
}
