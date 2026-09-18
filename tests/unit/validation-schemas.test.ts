import { describe, expect, it } from "vitest";
import { LIMITS } from "@shared/constants";
import {
  createSessionSchema,
  createTaskSchema,
  generateQuizSchema,
  loginSchema,
  registerSchema,
  submitAttemptSchema,
} from "@backend/validation/schemas";

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
    const r = registerSchema.parse({ email: "  Student@Example.com ", password: "password123" });
    expect(r.email).toBe("student@example.com");
  });
});

describe("loginSchema", () => {
  it("requires a password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
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
});

describe("generateQuizSchema (FR-3.3)", () => {
  it("defaults to 10 questions and only allows 5/10/15", () => {
    const r = generateQuizSchema.parse({ textId: "8c6f1a2e-0b1d-4c1e-9a3f-1d2e3f4a5b6c" });
    expect(r.questionCount).toBe(10);
    expect(generateQuizSchema.safeParse({ textId: "8c6f1a2e-0b1d-4c1e-9a3f-1d2e3f4a5b6c", questionCount: 12 }).success).toBe(false);
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
});
