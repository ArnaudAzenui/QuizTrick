import { OfficeParser } from "officeparser";
import { AppError } from "@backend/lib/errors";
import { cleanStudyText } from "@shared/utils/text";
import { studyFileExtension, validateStudyFile } from "@shared/utils/study-file";

/** Extract in memory: the original upload is never stored or sent to an AI service. */
export async function extractStudyDocument(file: File): Promise<{ text: string }> {
  const validation = validateStudyFile(file);
  if (!validation.ok) throw AppError.validation(validation.message);
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
