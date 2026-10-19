import { AppError } from "@backend/lib/errors";
import { createUserClient } from "@backend/supabase/server";
import type { HistoryEntry } from "@shared/types";
import { getCurrentUser } from "./auth.service";

type HistoryRow = {
  id: string;
  quiz_id: string;
  score: number;
  submitted_at: string;
  started_at: string;
  quizzes: { study_texts: { title: string | null } | null } | null;
};

/** Invalid legacy timestamps should show unavailable, rather than a fabricated duration. */
export function attemptDurationSeconds(startedAt: string, submittedAt: string): number | null {
  const milliseconds = Date.parse(submittedAt) - Date.parse(startedAt);
  return Number.isFinite(milliseconds) && milliseconds >= 0 ? Math.floor(milliseconds / 1000) : null;
}

/** Read only the caller's saved attempts through the RLS-protected client. */
export async function listHistory(): Promise<HistoryEntry[]> {
  const user = await getCurrentUser();
  const client = await createUserClient();
  const { data, error } = await client
    .from("attempts")
    .select("id, quiz_id, score, started_at, submitted_at, quizzes(study_texts(title))")
    .eq("owner_id", user.userId)
    .order("submitted_at", { ascending: false })
    .order("id", { ascending: false })
    .returns<HistoryRow[]>();

  if (error) {
    console.error("[history] attempt lookup failed", error.code, error.message);
    throw AppError.internal("We couldn't load your score history. Please try again.");
  }

  const rows = data ?? [];
  const best = new Map<string, number>();
  for (const row of rows) best.set(row.quiz_id, Math.max(best.get(row.quiz_id) ?? -1, row.score));
  return rows.map(row => ({
    attemptId: row.id,
    quizId: row.quiz_id,
    quizTitle: row.quizzes?.study_texts?.title ?? null,
    score: row.score,
    submittedAt: row.submitted_at,
    durationSeconds: attemptDurationSeconds(row.started_at, row.submitted_at),
    isBest: row.score === best.get(row.quiz_id),
  }));
}
