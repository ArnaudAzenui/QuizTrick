import { handle, ok } from "@backend/lib/api";
import { AppError } from "@backend/lib/errors";
import { getCurrentUser } from "@backend/services/auth.service";
import { extractStudyDocument } from "@backend/services/document.service";
import { LIMITS } from "@shared/constants";

export const runtime = "nodejs";
export const maxDuration = 30;

export const POST = handle(async request => {
  await getCurrentUser();
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data;")) throw AppError.validation("Choose a document to upload.");
  // Bound the actual stream, including requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw AppError.validation("Choose a document to upload.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > LIMITS.DOCUMENT_FILE_MAX_BYTES + 64 * 1024) {
        await reader.cancel();
        throw AppError.validation("That upload is too large. The document limit is 4 MB.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let form: FormData;
  try {
    form = await new Response(Buffer.concat(chunks), { headers: { "content-type": contentType } }).formData();
  } catch {
    throw AppError.validation("We couldn't read that upload. Please choose the file again.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw AppError.validation("Choose a document to upload.");
  return ok(await extractStudyDocument(file));
});
