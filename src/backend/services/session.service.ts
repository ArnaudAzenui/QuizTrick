/**
 * Study timer sessions (WBS 1.5.2).
 *
 *   - listSessions - the caller's 20 most recent sessions, newest first
 *   - saveSession (FR-7.4)
 *
 * durationSeconds is derived twice on purpose — by createSessionSchema and
 * again by the study_sessions trigger (migration 0002) — because the browser
 * can insert here directly with the anon key. The schema's output already
 * carries the derived value (a client-sent one never gets this far); it is
 * passed through and the trigger recomputes it regardless. A task_id belonging
 * to another user raises P0002.
 *
 * Errors: throw AppError (src/backend/lib/errors.ts); routes wrap handlers with handle() from lib/api.ts.
 * Data access: the user client only. RLS limits every query here to the
 * caller's own rows, so nothing in this file needs the service-role client.
 */
import type { z } from "zod";
import { AppError } from "@backend/lib/errors";
import { createUserClient } from "@backend/supabase/server";
import { toStudySession, type StudySessionRow } from "@backend/db/rows";
import type { createSessionSchema } from "@backend/validation/schemas";
import type { StudySession } from "@shared/types";
import { getCurrentUser } from "./auth.service";

const SESSION_COLUMNS = "id, owner_id, task_id, start_time, end_time, duration_seconds, created_at";

/** How many sessions GET /api/sessions returns (docs/API.md). */
export const SESSION_LIST_LIMIT = 20;

/**
 * The 20 most recent sessions, newest start first. A session still open
 * (end_time null — only possible through a direct browser insert) is included
 * as-is: StudySession.endTime allows null.
 */
export async function listSessions(): Promise<StudySession[]> {
  const user = await getCurrentUser();
  const client = await createUserClient();
  const { data, error } = await client
    .from("study_sessions")
    .select(SESSION_COLUMNS)
    .eq("owner_id", user.userId)
    .order("start_time", { ascending: false })
    .limit(SESSION_LIST_LIMIT)
    .returns<StudySessionRow[]>();
  if (error) {
    console.error("[sessions] list failed", error.code, error.message);
    throw AppError.internal("We couldn't load your study sessions. Please try again.");
  }
  return (data ?? []).map(toStudySession);
}

/**
 * FR-7.4. Saves a finished timer session. `input` is the parsed
 * createSessionSchema output, so durationSeconds is the server-derived value.
 *
 * P0002: the task is gone or isn't the caller's (deleted between picking it and
 * stopping the timer, or a forged id). 23514: a time rule the trigger enforces
 * that the schema let through, e.g. a clock-skew edge.
 */
export async function saveSession(input: z.output<typeof createSessionSchema>): Promise<StudySession> {
  const user = await getCurrentUser();
  const client = await createUserClient();
  const { data, error } = await client
    .from("study_sessions")
    .insert({
      owner_id: user.userId,
      task_id: input.taskId ?? null,
      start_time: input.startTime,
      end_time: input.endTime,
      duration_seconds: input.durationSeconds, // derived by the schema; the trigger recomputes it anyway
    })
    .select(SESSION_COLUMNS)
    .single<StudySessionRow>();

  if (error || !data) {
    if (error?.code === "P0002") throw AppError.notFound("That study task");
    if (error?.code === "23514") {
      console.error("[sessions] a trigger rejected a session the schema allowed", error.message);
      throw AppError.validation("That study session couldn't be saved. Check its start and end times, then try again.");
    }
    console.error("[sessions] insert failed", error?.code, error?.message);
    throw AppError.internal("We couldn't save your study session. Please try again.");
  }
  return toStudySession(data);
}
