import { describe, expect, it } from "vitest";
import { LIMITS } from "@shared/constants";
import {
  createSessionSchema,
  createTaskSchema,
  createTextSchema,
  generateQuizSchema,
  loginSchema,
  registerSchema,
  submitAttemptSchema,
  updateTaskSchema,
} from "@backend/validation/schemas";

/** Every message in the envelope is shown to a student verbatim (NFR-U2). */
const messages = (schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: Array<{ message: string }> } } }, value: unknown) => {
  const r = schema.safeParse(value);
  return r.success ? [] : (r.error?.issues ?? []).map((i) => i.message);
};

const DEVELOPER_SPEAK = /^(Required|Invalid input|Expected .*, received|Invalid)/;

describe("registerSchema (FR-1.2)", () => {
  it("rejects bad emails and short passwords with plain-language messages", () => {
    const r = registerSchema.safeParse({ email: "not-an-email", password: "short" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message).join(" ");
      expect(msgs).toMatch(/valid email/i);
      expect(msgs).toMatch(/at least 8/i);
    }
  });
  it("lower-cases and trims the email", () => {
    const r = registerSchema.parse({ email: "  Student@Example.com ", password: "password123", displayName: "Student" });
    expect(r.email).toBe("student@example.com");
  });
  it("explains a missing field instead of saying 'Required'", () => {
    const msgs = messages(registerSchema, {});
    expect(msgs).toHaveLength(3);
    for (const m of msgs) expect(m).not.toMatch(DEVELOPER_SPEAK);
  });
  it("explains a body that isn't an object at all", () => {
    for (const body of [null, [], "nope", 7]) {
      const msgs = messages(registerSchema, body);
      expect(msgs.join(" ")).toMatch(/request body must be a JSON object/i);
    }
  });
  it("caps the display name at the database's limit", () => {
    expect(registerSchema.safeParse({ email: "a@b.co", password: "12345678", displayName: "x".repeat(LIMITS.DISPLAY_NAME_MAX) }).success).toBe(true);
    expect(registerSchema.safeParse({ email: "a@b.co", password: "12345678", displayName: "x".repeat(LIMITS.DISPLAY_NAME_MAX + 1) }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("requires a password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
});

describe("createTextSchema (FR-2.4)", () => {
  it("turns a blank title into null so the list view has nothing to render", () => {
    expect(createTextSchema.parse({ title: "   ", body: "x" }).title).toBeNull();
    expect(createTextSchema.parse({ body: "x" }).title).toBeNull();
    expect(createTextSchema.parse({ title: " Bio ch. 4 ", body: "x" }).title).toBe("Bio ch. 4");
  });
  it("asks for study text in plain language when the body is missing", () => {
    expect(messages(createTextSchema, {}).join(" ")).toMatch(/paste or upload/i);
  });
});

describe("createTaskSchema (FR-6.2)", () => {
  it("rejects empty subject and non-positive minutes", () => {
    const r = createTaskSchema.safeParse({ subject: "  ", estimatedMinutes: 0 });
    expect(r.success).toBe(false);
  });
  it("coerces numeric strings and turns empty description into null", () => {
    const r = createTaskSchema.parse({ subject: "Read ch. 4", description: "", estimatedMinutes: "45" });
    expect(r.estimatedMinutes).toBe(45);
    expect(r.description).toBeNull();
  });
  it("caps minutes at 600", () => {
    expect(createTaskSchema.safeParse({ subject: "x", estimatedMinutes: 601 }).success).toBe(false);
  });

  // StudyTask.description is `string | null`, so a client round-tripping a task
  // it just fetched was getting "Expected string, received null".
  it("accepts description: null, the shape the API itself returns", () => {
    const r = createTaskSchema.safeParse({ subject: "x", estimatedMinutes: 5, description: null });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.description).toBeNull();
  });

  // z.coerce.number() accepted all of these as real minute counts.
  it("rejects values that are not a number anyone typed", () => {
    for (const bad of [true, false, [5], [], "0x10", "1e2", "12abc", 45.5, null, {}]) {
      expect(createTaskSchema.safeParse({ subject: "x", estimatedMinutes: bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });
  it("still accepts a number or a digits-only string from a form field", () => {
    expect(createTaskSchema.parse({ subject: "x", estimatedMinutes: 45 }).estimatedMinutes).toBe(45);
    expect(createTaskSchema.parse({ subject: "x", estimatedMinutes: " 45 " }).estimatedMinutes).toBe(45);
  });
  it("explains a bad minute value in plain language", () => {
    for (const m of messages(createTaskSchema, { subject: "x", estimatedMinutes: true })) {
      expect(m).not.toMatch(DEVELOPER_SPEAK);
    }
  });
});

describe("updateTaskSchema (FR-6.4 — PATCH semantics)", () => {
  it("accepts a lone isComplete toggle", () => {
    const r = updateTaskSchema.safeParse({ isComplete: true });
    expect(r.success).toBe(true);
  });
  it("accepts description: null to clear a description", () => {
    const r = updateTaskSchema.safeParse({ description: null });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.description).toBeNull();
  });
  it("still validates the fields that are present", () => {
    expect(updateTaskSchema.safeParse({ estimatedMinutes: 0 }).success).toBe(false);
    expect(updateTaskSchema.safeParse({ isComplete: "yes" }).success).toBe(false);
  });
});

describe("generateQuizSchema (FR-3.3)", () => {
  it("defaults to 10 questions and only allows 5/10/15", () => {
    const r = generateQuizSchema.parse({ textId: "8c6f1a2e-0b1d-4c1e-9a3f-1d2e3f4a5b6c" });
    expect(r.questionCount).toBe(10);
    expect(generateQuizSchema.safeParse({ textId: "8c6f1a2e-0b1d-4c1e-9a3f-1d2e3f4a5b6c", questionCount: 12 }).success).toBe(false);
  });
  it("accepts the string a <select> sends", () => {
    const r = generateQuizSchema.parse({ textId: "8c6f1a2e-0b1d-4c1e-9a3f-1d2e3f4a5b6c", questionCount: "15" });
    expect(r.questionCount).toBe(15);
  });
  it("names the allowed counts instead of saying 'Invalid input'", () => {
    const msgs = messages(generateQuizSchema, { textId: "8c6f1a2e-0b1d-4c1e-9a3f-1d2e3f4a5b6c", questionCount: 12 });
    expect(msgs.join(" ")).toMatch(/5, 10, 15/);
    for (const m of msgs) expect(m).not.toMatch(DEVELOPER_SPEAK);
  });
});

describe("submitAttemptSchema (FR-4.3, NFR-R3)", () => {
  const qid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const answer = (n: number) => ({ questionId: qid(n), response: "0" });

  it("accepts a normal submission", () => {
    expect(submitAttemptSchema.safeParse({ answers: [answer(1), answer(2)] }).success).toBe(true);
  });
  it("rejects the same question answered twice with a clean message", () => {
    const r = submitAttemptSchema.safeParse({ answers: [answer(1), answer(1)] });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toMatch(/only be answered once/i);
  });

  // UUIDs are case-insensitive, so this slipped past the duplicate check and
  // came back from Postgres as an opaque unique-violation.
  it("catches a duplicate sent in a different case", () => {
    const r = submitAttemptSchema.safeParse({
      answers: [
        { questionId: "aaaaaaaa-0000-4000-8000-000000000001", response: "" },
        { questionId: "AAAAAAAA-0000-4000-8000-000000000001", response: "" },
      ],
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toMatch(/only be answered once/i);
  });
  it("normalises question ids to lower case for the RPC", () => {
    const r = submitAttemptSchema.parse({ answers: [{ questionId: "AAAAAAAA-0000-4000-8000-000000000001", response: "" }] });
    expect(r.answers[0].questionId).toBe("aaaaaaaa-0000-4000-8000-000000000001");
  });

  it("rejects more answers than any quiz can have", () => {
    const tooMany = Array.from({ length: LIMITS.QUIZ_MAX_QUESTIONS + 1 }, (_, i) => answer(i + 1));
    expect(submitAttemptSchema.safeParse({ answers: tooMany }).success).toBe(false);
    const justEnough = tooMany.slice(0, LIMITS.QUIZ_MAX_QUESTIONS);
    expect(submitAttemptSchema.safeParse({ answers: justEnough }).success).toBe(true);
  });
  it("still rejects an empty submission and over-long short answers", () => {
    expect(submitAttemptSchema.safeParse({ answers: [] }).success).toBe(false);
    const long = { questionId: qid(1), response: "x".repeat(LIMITS.SHORT_ANSWER_RESPONSE_MAX + 1) };
    expect(submitAttemptSchema.safeParse({ answers: [long] }).success).toBe(false);
  });

  // A wrong clock must not cost a student their finished quiz: drop the claim
  // and let the server timestamp it (submit_attempt clamps it the same way).
  it("drops a startedAt from the future rather than failing the submission", () => {
    const r = submitAttemptSchema.parse({
      startedAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      answers: [answer(1)],
    });
    expect(r.startedAt).toBeUndefined();
  });
  it("keeps a plausible startedAt, including one slightly ahead of the server", () => {
    const past = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(submitAttemptSchema.parse({ startedAt: past, answers: [answer(1)] }).startedAt).toBe(past);
    const slightlyAhead = new Date(Date.now() + 60 * 1000).toISOString();
    expect(submitAttemptSchema.parse({ startedAt: slightlyAhead, answers: [answer(1)] }).startedAt).toBe(slightlyAhead);
  });
});

describe("createSessionSchema (FR-7.4, SEC-5)", () => {
  const start = "2026-09-17T10:00:00.000Z";
  const end = "2026-09-17T10:25:30.000Z"; // 25 min 30 s later

  it("derives durationSeconds from the timestamps", () => {
    const r = createSessionSchema.parse({ startTime: start, endTime: end });
    expect(r.durationSeconds).toBe(25 * 60 + 30);
    expect(r.taskId).toBeNull();
  });
  it("ignores a client-supplied durationSeconds rather than trusting it", () => {
    const r = createSessionSchema.parse({ startTime: start, endTime: end, durationSeconds: 999_999 });
    expect(r.durationSeconds).toBe(25 * 60 + 30);
  });
  it("ignores a durationSeconds that isn't even a number", () => {
    const r = createSessionSchema.parse({ startTime: start, endTime: end, durationSeconds: "abc" });
    expect(r.durationSeconds).toBe(25 * 60 + 30);
  });
  it("rejects an end before the start", () => {
    const r = createSessionSchema.safeParse({ startTime: end, endTime: start });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["endTime"]);
  });
  it("rejects a session longer than a day (stuck client)", () => {
    const dayPlus = new Date(Date.parse(start) + (LIMITS.SESSION_MAX_SECONDS + 1) * 1000).toISOString();
    expect(createSessionSchema.safeParse({ startTime: start, endTime: dayPlus }).success).toBe(false);
  });
  it("still rejects malformed timestamps", () => {
    expect(createSessionSchema.safeParse({ startTime: "yesterday", endTime: end }).success).toBe(false);
  });

  it("accepts an ISO timestamp with a UTC offset, not only Z", () => {
    const r = createSessionSchema.safeParse({ startTime: "2026-09-17T12:00:00+02:00", endTime: "2026-09-17T12:30:00+02:00" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.durationSeconds).toBe(1800);
  });

  // A session can't have happened yet. Tolerate ordinary clock skew, not a day.
  it("rejects a session that starts in the future", () => {
    const from = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const to = new Date(from.getTime() + 60_000);
    const r = createSessionSchema.safeParse({ startTime: from.toISOString(), endTime: to.toISOString() });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toContain("startTime");
  });
  it("accepts a session that just ended on a slightly fast clock", () => {
    const from = new Date(Date.now() - 10 * 60 * 1000);
    const to = new Date(Date.now() + 60 * 1000);
    expect(createSessionSchema.safeParse({ startTime: from.toISOString(), endTime: to.toISOString() }).success).toBe(true);
  });
});
