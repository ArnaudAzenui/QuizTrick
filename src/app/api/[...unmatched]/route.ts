import { NextResponse } from "next/server";
import type { ApiResult } from "@shared/types";

/**
 * Catch-all for unknown /api paths.
 *
 * Without it Next serves the HTML not-found page, so a client typo or a stale
 * deployed route came back as an HTML 404 — and api-client.ts, which expects
 * the JSON envelope on every response, reported "Something went wrong" instead
 * of saying the endpoint doesn't exist. Real routes are matched first; a
 * catch-all is the lowest-priority segment in Next's router.
 */
function notFound(): NextResponse {
  return NextResponse.json<ApiResult<never>>(
    { ok: false, error: { code: "NOT_FOUND", message: "That QuizTrick endpoint doesn't exist." } },
    { status: 404 },
  );
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
export const OPTIONS = notFound;
