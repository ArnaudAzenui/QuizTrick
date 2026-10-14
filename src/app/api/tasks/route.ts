import { handle, ok, parseBody } from "@backend/lib/api";
import { createTask, listTasks } from "@backend/services/task.service";
import { createTaskSchema, taskScopeSchema } from "@backend/validation/schemas";

/**
 * GET /api/tasks - ?scope=today|all -> StudyTask[]
 * POST /api/tasks - { subject, description?, estimatedMinutes } -> StudyTask (201)
 *
 * Full contract: docs/API.md - FR-6.1 - FR-6.3
 */
export const GET = handle(async (req) => {
  const scope = taskScopeSchema.parse(new URL(req.url).searchParams.get("scope") ?? undefined);
  return ok(await listTasks(scope));
});

export const POST = handle(async (req) => ok(await createTask(await parseBody(req, createTaskSchema)), 201));
