import { handle, ok, parseBody, type RouteCtx } from "@backend/lib/api";
import { deleteTask, updateTask } from "@backend/services/task.service";
import { updateTaskSchema } from "@backend/validation/schemas";

/**
 * PATCH /api/tasks/:id - partial task -> StudyTask
 * DELETE /api/tasks/:id - -> { deleted: true }
 *
 * Full contract: docs/API.md - FR-6.4, FR-6.5
 */
export const PATCH = handle<RouteCtx<{ id: string }>>(async (req, { params }) =>
  ok(await updateTask((await params).id, await parseBody(req, updateTaskSchema))),
);

export const DELETE = handle<RouteCtx<{ id: string }>>(async (_req, { params }) => ok(await deleteTask((await params).id)));
