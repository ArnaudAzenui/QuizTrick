import { afterEach, describe, expect, it, vi } from "vitest";
import { fail, handle, parseBody } from "@backend/lib/api";
import { AppError } from "@backend/lib/errors";
import { registerSchema } from "@backend/validation/schemas";
import type { ApiResult } from "@shared/types";

type ErrorEnvelope = Extract<ApiResult<never>, { ok: false }>;

const read = async (res: Response) => ({ status: res.status, body: (await res.json()) as ErrorEnvelope });

const jsonRequest = (body: string) =>
  new Request("http://localhost/api/test", { method: "POST", body, headers: { "content-type": "application/json" } });

afterEach(() => vi.restoreAllMocks());

describe("fail() — the envelope every route returns (SRS §3.1)", () => {
  it("maps an AppError to its status and message", async () => {
    const { status, body } = await read(fail(AppError.notFound("That quiz")));
    expect(status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toMatch(/could not be found/i);
  });

  it("turns a ZodError into per-field messages", async () => {
    const parsed = registerSchema.safeParse({ email: "nope", password: "short" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const { status, body } = await read(fail(parsed.error));
    expect(status).toBe(400);
    expect(body.error.code).toBe("VALIDATION");
    expect(body.error.fields?.email).toMatch(/valid email/i);
    expect(body.error.fields?.password).toMatch(/at least 8/i);
  });

  // Zod can report two problems for one field. The banner quoted the first and
  // the field showed the last, so the form contradicted itself.
  it("keeps the first problem per field, so the banner and the field agree", async () => {
    const parsed = registerSchema.safeParse({ email: "a".repeat(260) + "@b.co", password: "12345678" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const { body } = await read(fail(parsed.error));
    expect(body.error.fields?.email).toBe(body.error.message);
  });

  it("never leaks an unexpected error's details to the client (NFR-U2, SEC-3)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { status, body } = await read(fail(new Error("connect ECONNREFUSED 10.0.0.5:5432")));
    expect(status).toBe(500);
    expect(body.error.code).toBe("INTERNAL");
    expect(JSON.stringify(body)).not.toMatch(/ECONNREFUSED|10\.0\.0\.5/);
    expect(spy).toHaveBeenCalled(); // but it is logged server-side
  });
});

describe("parseBody() via handle()", () => {
  const route = handle(async (req: Request) => Response.json(await parseBody(req, registerSchema)));

  it("accepts a valid body", async () => {
    const res = await route(jsonRequest(JSON.stringify({ email: "a@b.co", password: "password123" })), {});
    expect(res.status).toBe(200);
  });

  it("explains malformed JSON instead of throwing a 500", async () => {
    for (const bad of ["{not json", ""]) {
      const { status, body } = await read(await route(jsonRequest(bad), {}));
      expect(status).toBe(400);
      expect(body.error.message).toMatch(/valid JSON/i);
    }
  });

  it("explains a JSON body that isn't an object", async () => {
    for (const bad of ["null", "[]", '"hello"']) {
      const { status, body } = await read(await route(jsonRequest(bad), {}));
      expect(status).toBe(400);
      expect(body.error.message).toMatch(/must be a JSON object/i);
      expect(body.error.message).not.toMatch(/^Expected /);
    }
  });
});
