import { handle, ok, type RouteCtx } from "@backend/lib/api";
import { deleteText, getText } from "@backend/services/text.service";

/**
 * GET /api/texts/:id - -> StudyText
 * DELETE /api/texts/:id - -> { deleted: true } (cascades)
 *
 * Full contract: docs/API.md - FR-2.6, SEC-10
 */
export const GET = handle<RouteCtx<{ id: string }>>(async (_req, { params }) => ok(await getText((await params).id)));

export const DELETE = handle<RouteCtx<{ id: string }>>(async (_req, { params }) => ok(await deleteText((await params).id)));
