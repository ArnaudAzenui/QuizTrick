import { handle, ok } from "@backend/lib/api";
import { listHistory } from "@backend/services/history.service";

/** GET /api/history - saved attempts, newest first, with per-quiz best scores. */
export const GET = handle(async () => ok(await listHistory()));
