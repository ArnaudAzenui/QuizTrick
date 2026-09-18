import { NextResponse } from "next/server";
import type { ApiResult } from "@shared/types";

/**
 * Placeholder response while a route is being built. Every route below /api
 * starts life returning this; replace the body with the real implementation
 * per docs/API.md, then delete this file once no route uses it.
 */
export function notImplemented(): NextResponse {
  return NextResponse.json<ApiResult<never>>(
    { ok: false, error: { code: "INTERNAL", message: "This endpoint is not implemented yet." } },
    { status: 501 },
  );
}
