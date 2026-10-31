import { handle, ok, parseBody } from "@backend/lib/api";
import { listSessions, saveSession } from "@backend/services/session.service";
import { createSessionSchema } from "@backend/validation/schemas";

/**
 * GET /api/sessions - -> StudySession[] (the last 20, newest first)
 * POST /api/sessions - { taskId?, startTime, endTime } -> StudySession (201)
 *
 * durationSeconds is derived server-side from the timestamps; a client-sent
 * value is ignored (SEC-5).
 *
 * Full contract: docs/API.md - FR-7.4
 */
export const GET = handle(async () => ok(await listSessions()));

export const POST = handle(async (req) => ok(await saveSession(await parseBody(req, createSessionSchema)), 201));
