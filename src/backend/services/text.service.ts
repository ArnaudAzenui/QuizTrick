/**
 * Study texts (WBS 1.4.2).
 *
 *   - listTexts (FR-2.6)
 *   - createText - validate + clean via @shared/utils/text, then insert (FR-2.4, FR-2.5)
 *   - getText
 *   - deleteText (SEC-10)
 *
 * A text is immutable once saved: there is no update policy (migration 0002),
 * because quizzes generated from it would stop matching the material.
 *
 * Errors: throw AppError (src/backend/lib/errors.ts); routes wrap handlers with handle() from lib/api.ts.
 * Data access: the user client only. RLS limits every query here to the
 * caller's own rows, so nothing in this file needs the service-role client.
 */
import type { z } from "zod";
import { AppError } from "@backend/lib/errors";
import { createUserClient } from "@backend/supabase/server";
import { toStudyText, type StudyTextRow } from "@backend/db/rows";
import { idSchema, type createTextSchema } from "@backend/validation/schemas";
import type { StudyText, StudyTextSummary } from "@shared/types";
import { validateStudyText } from "@shared/utils/text";
import { getCurrentUser } from "./auth.service";

const TEXT_COLUMNS = "id, owner_id, title, body, char_count, created_at";
// quizzes(count) is PostgREST's embedded aggregate; RLS applies to it too.
const SUMMARY_COLUMNS = "id, owner_id, title, char_count, created_at, quizzes(count)";

type StudyTextSummaryRow = Omit<StudyTextRow, "body"> & { quizzes: Array<{ count: number }> | null };

/**
 * A malformed id would reach Postgres as a uuid cast error (22P02) and come
 * back as a 500. To the caller it is simply a text that doesn't exist.
 */
const textMissing = () => AppError.notFound("That study text");

/**
 * Loads one of `userId`'s texts. Exported for the quiz generator, which has
 * already established the caller and would otherwise verify the session twice.
 */
export async function findOwnedText(userId: string, textId: string): Promise<StudyText> {
  if (!idSchema.safeParse(textId).success) throw textMissing();
  const client = await createUserClient();
  const { data, error } = await client
    .from("study_texts")
    .select(TEXT_COLUMNS)
    .eq("id", textId)
    .eq("owner_id", userId)
    .maybeSingle<StudyTextRow>();

  if (error) {
    console.error("[texts] select failed", error.code, error.message);
    throw AppError.internal("We couldn't load that study text. Please try again.");
  }
  if (!data) throw textMissing();
  return toStudyText(data);
}

export async function listTexts(): Promise<StudyTextSummary[]> {
  const user = await getCurrentUser();
  const client = await createUserClient();
  const { data, error } = await client
    .from("study_texts")
    .select(SUMMARY_COLUMNS)
    .eq("owner_id", user.userId)
    .order("created_at", { ascending: false })
    .returns<StudyTextSummaryRow[]>();

  if (error) {
    console.error("[texts] list failed", error.code, error.message);
    throw AppError.internal("We couldn't load your study texts. Please try again.");
  }
  return (data ?? []).map((r) => ({
    textId: r.id,
    ownerId: r.owner_id,
    title: r.title,
    charCount: r.char_count,
    createdAt: r.created_at,
    quizCount: r.quizzes?.[0]?.count ?? 0,
  }));
}

export async function createText(input: z.infer<typeof createTextSchema>): Promise<StudyText> {
  // Validated before the session check costs a round trip; the result is the
  // same whoever is asking.
  const checked = validateStudyText(input.body);
  if (!checked.ok) throw AppError.validation(checked.message, { body: checked.message });

  const user = await getCurrentUser();
  const client = await createUserClient();
  // Both values come from validateStudyText(), which counts code points the way
  // the `char_count = char_length(body)` check does — never String.length.
  const { data, error } = await client
    .from("study_texts")
    .insert({ owner_id: user.userId, title: input.title, body: checked.cleaned, char_count: checked.charCount })
    .select(TEXT_COLUMNS)
    .single<StudyTextRow>();

  if (error || !data) {
    // 23514: a length or char_count check. validateStudyText() applies the same
    // rules first, so reaching this means the two have drifted apart.
    console.error("[texts] insert failed", error?.code, error?.message);
    if (error?.code === "23514") {
      const message = "That text couldn't be saved. Check its length and try again.";
      throw AppError.validation(message, { body: message });
    }
    throw AppError.internal("We couldn't save your study text. Please try again.");
  }
  return toStudyText(data);
}

export async function getText(textId: string): Promise<StudyText> {
  const user = await getCurrentUser();
  return findOwnedText(user.userId, textId);
}

/** SEC-10. Cascades to the text's quizzes, questions and attempts. */
export async function deleteText(textId: string): Promise<{ deleted: true }> {
  if (!idSchema.safeParse(textId).success) throw textMissing();
  const user = await getCurrentUser();
  const client = await createUserClient();
  // .select() returns what was deleted; RLS turns "not yours" into "nothing".
  const { data, error } = await client
    .from("study_texts")
    .delete()
    .eq("id", textId)
    .eq("owner_id", user.userId)
    .select("id");

  if (error) {
    console.error("[texts] delete failed", error.code, error.message);
    throw AppError.internal("We couldn't delete that study text. Please try again.");
  }
  if (!data || data.length === 0) throw textMissing();
  return { deleted: true };
}
