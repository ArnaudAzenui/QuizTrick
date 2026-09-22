import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import type { ApiResult } from "@shared/types";
import { AppError } from "./errors";

/** 200/201 envelope. */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json<ApiResult<T>>({ ok: true, data }, { status });
}

/** Turns any thrown value into a safe JSON error response. */
export function fail(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json<ApiResult<never>>(
      { ok: false, error: { code: err.code, message: err.message, fields: err.fields } },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    // First issue wins per field. Zod can report several problems for one field
    // (too long AND not an email); overwriting left `message` quoting one of
    // them and `fields.email` the other, so the form and the banner disagreed.
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      if (!(key in fields)) fields[key] = issue.message;
    }
    const first = err.issues[0]?.message ?? "Please check the highlighted fields.";
    return NextResponse.json<ApiResult<never>>(
      { ok: false, error: { code: "VALIDATION", message: first, fields } },
      { status: 400 },
    );
  }
  // Log server-side only; never echo details to the client (NFR-U2, SEC-3).
  console.error("[api] unhandled error", err);
  return NextResponse.json<ApiResult<never>>(
    { ok: false, error: { code: "INTERNAL", message: "Something went wrong on our side. Please try again." } },
    { status: 500 },
  );
}

/**
 * Wraps a route handler so every error path returns the standard envelope.
 * Usage: export const POST = handle(async (req) => ok(await doThing()));
 */
export function handle<Ctx>(fn: (req: Request, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      return fail(err);
    }
  };
}

/** Parses and validates a JSON body (SEC-5: validate everything server-side). */
export async function parseBody<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.output<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw AppError.validation("The request body must be valid JSON.");
  }
  return schema.parse(json);
}

/** Next 15 passes dynamic route params as a Promise. */
export type RouteCtx<P extends Record<string, string>> = { params: Promise<P> };
