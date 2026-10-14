/**
 * Study tasks API (WBS 1.5.1; Fardin owns the UI).
 *
 *   - listTasks(scope: today|all) (FR-6.3)
 *   - createTask (FR-6.1, FR-6.2)
 *   - updateTask - incl. isComplete toggle (FR-6.4)
 *   - deleteTask (FR-6.5)
 *
 * Errors: throw AppError (src/backend/lib/errors.ts); routes wrap handlers with handle() from lib/api.ts.
 * Data access: the user client only. RLS limits every query here to the
 * caller's own rows, so nothing in this file needs the service-role client.
 */
import type { z } from "zod";
import { AppError } from "@backend/lib/errors";
import { createUserClient } from "@backend/supabase/server";
import { toStudyTask, type StudyTaskRow } from "@backend/db/rows";
import { idSchema, type createTaskSchema, type taskScopeSchema, type updateTaskSchema } from "@backend/validation/schemas";
import type { StudyTask } from "@shared/types";
import { getCurrentUser } from "./auth.service";

const TASK_COLUMNS = "id, owner_id, subject, description, estimated_minutes, is_complete, created_at";

/** Another user's task and a malformed id both read as a task that doesn't exist. */
const taskMissing = () => AppError.notFound("That task");

/** 23514: a length or range check. The schema applies the same limits first. */
function rejectedByCheck(error: { code?: string; message?: string } | null): AppError | null {
  if (error?.code !== "23514") return null;
  console.error("[tasks] a check constraint rejected a value the schema allowed", error.message);
  return AppError.validation("That task couldn't be saved. Check the subject, description and time, then try again.");
}

/** Midnight UTC at the start of the current day. */
function startOfTodayUtc(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

/**
 * FR-6.3. `today` is every task created today plus every task still
 * incomplete, however old — an unfinished task from last week stays on the
 * list until it is done. Incomplete tasks first, then newest first.
 */
export async function listTasks(scope: z.output<typeof taskScopeSchema>): Promise<StudyTask[]> {
  const user = await getCurrentUser();
  const client = await createUserClient();
  let query = client.from("study_tasks").select(TASK_COLUMNS).eq("owner_id", user.userId);
  if (scope === "today") query = query.or(`is_complete.eq.false,created_at.gte."${startOfTodayUtc()}"`);

  const { data, error } = await query
    .order("is_complete", { ascending: true })
    .order("created_at", { ascending: false })
    .returns<StudyTaskRow[]>();
  if (error) {
    console.error("[tasks] list failed", error.code, error.message);
    throw AppError.internal("We couldn't load your tasks. Please try again.");
  }
  return (data ?? []).map(toStudyTask);
}

export async function createTask(input: z.output<typeof createTaskSchema>): Promise<StudyTask> {
  const user = await getCurrentUser();
  const client = await createUserClient();
  const { data, error } = await client
    .from("study_tasks")
    .insert({
      owner_id: user.userId,
      subject: input.subject,
      description: input.description,
      estimated_minutes: input.estimatedMinutes,
    })
    .select(TASK_COLUMNS)
    .single<StudyTaskRow>();

  if (error || !data) {
    console.error("[tasks] insert failed", error?.code, error?.message);
    throw rejectedByCheck(error) ?? AppError.internal("We couldn't save your task. Please try again.");
  }
  return toStudyTask(data);
}

/**
 * FR-6.4. Only the fields present in `input` change; an omitted field is
 * undefined and left out of the update, while description: null clears it.
 * A body with no fields changes nothing and returns the task as it is.
 */
export async function updateTask(taskId: string, input: z.output<typeof updateTaskSchema>): Promise<StudyTask> {
  if (!idSchema.safeParse(taskId).success) throw taskMissing();
  const user = await getCurrentUser();
  const client = await createUserClient();

  const changes: Partial<Pick<StudyTaskRow, "subject" | "description" | "estimated_minutes" | "is_complete">> = {};
  if (input.subject !== undefined) changes.subject = input.subject;
  if (input.description !== undefined) changes.description = input.description;
  if (input.estimatedMinutes !== undefined) changes.estimated_minutes = input.estimatedMinutes;
  if (input.isComplete !== undefined) changes.is_complete = input.isComplete;

  const table = client.from("study_tasks");
  const query = Object.keys(changes).length > 0 ? table.update(changes).select(TASK_COLUMNS) : table.select(TASK_COLUMNS);
  const { data, error } = await query.eq("id", taskId).eq("owner_id", user.userId).maybeSingle<StudyTaskRow>();

  if (error) {
    console.error("[tasks] update failed", error.code, error.message);
    throw rejectedByCheck(error) ?? AppError.internal("We couldn't update that task. Please try again.");
  }
  // RLS turns "not your row" into "no row".
  if (!data) throw taskMissing();
  return toStudyTask(data);
}

/** FR-6.5. Timer sessions linked to the task are kept; their task_id becomes null. */
export async function deleteTask(taskId: string): Promise<{ deleted: true }> {
  if (!idSchema.safeParse(taskId).success) throw taskMissing();
  const user = await getCurrentUser();
  const client = await createUserClient();
  const { data, error } = await client
    .from("study_tasks")
    .delete()
    .eq("id", taskId)
    .eq("owner_id", user.userId)
    .select("id");

  if (error) {
    console.error("[tasks] delete failed", error.code, error.message);
    throw AppError.internal("We couldn't delete that task. Please try again.");
  }
  if (!data || data.length === 0) throw taskMissing();
  return { deleted: true };
}
