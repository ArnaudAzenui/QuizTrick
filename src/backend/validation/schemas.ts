/**
 * Zod schemas for every API payload (SEC-5: all input validated server-side).
 * Messages are written for students, not developers (NFR-U2) — including the
 * ones Zod would otherwise phrase itself ("Required", "Expected number,
 * received nan"), which do reach the browser through the error envelope.
 *
 * These are the same rules migration 0002 enforces in the database. Keep the
 * two in step: the browser holds the anon key, so anything only checked here
 * can be skipped by writing to Supabase directly.
 */
import { z } from "zod";
import { LIMITS, THEMES } from "@shared/constants";

/** A JSON body that isn't an object at all (null, an array, a bare string). */
const objectBody = { required_error: "The request body is missing.", invalid_type_error: "The request body must be a JSON object." };

/**
 * Whole numbers only, from a number or a digits-only string (form fields arrive
 * as strings). z.coerce.number() was too generous: it accepted true as 1, [5]
 * as 5, "0x10" as 16 and "1e2" as 100 — none of which a user ever typed.
 */
function wholeNumber(message: string) {
  return z.preprocess(
    (v) => (typeof v === "string" && /^\s*\d+\s*$/.test(v) ? Number(v.trim()) : v),
    z.number({ required_error: message, invalid_type_error: message }).int(message),
  );
}

/** ISO timestamp that isn't implausibly ahead of the server's clock. */
function notFromTheFuture(iso: string): boolean {
  return Date.parse(iso) <= Date.now() + LIMITS.CLOCK_SKEW_MS;
}

export const emailSchema = z
  .string({ required_error: "Enter your email address.", invalid_type_error: "Enter your email address." })
  .trim()
  .toLowerCase()
  .max(LIMITS.EMAIL_MAX, `Email must be ${LIMITS.EMAIL_MAX} characters or fewer.`)
  .email("Enter a valid email address, like name@example.com.");

export const passwordSchema = z
  .string({ required_error: "Enter a password.", invalid_type_error: "Enter a password." })
  .min(LIMITS.PASSWORD_MIN, `Password must be at least ${LIMITS.PASSWORD_MIN} characters.`)
  .max(LIMITS.PASSWORD_MAX, `Password must be ${LIMITS.PASSWORD_MAX} characters or fewer.`);

const displayNameSchema = z
  .string({ required_error: "Enter a display name.", invalid_type_error: "Enter a display name." })
  .trim()
  .max(LIMITS.DISPLAY_NAME_MAX, `Display name must be ${LIMITS.DISPLAY_NAME_MAX} characters or fewer.`);

export const registerSchema = z.object(
  {
    email: emailSchema,
    password: passwordSchema,
    displayName: displayNameSchema.optional(),
  },
  objectBody,
);

export const loginSchema = z.object(
  {
    email: emailSchema,
    password: z
      .string({ required_error: "Enter your password.", invalid_type_error: "Enter your password." })
      .min(1, "Enter your password."),
  },
  objectBody,
);

export const resetPasswordSchema = z.object({ email: emailSchema }, objectBody);

export const profileUpdateSchema = z.object(
  { displayName: displayNameSchema.min(1, "Display name cannot be empty.") },
  objectBody,
);

export const createTextSchema = z.object(
  {
    // Normalised to null rather than "": `study_texts.title` is nullable and an
    // empty string would render as a blank heading in the texts list.
    title: z
      .string({ invalid_type_error: "Give the text a title, or leave it blank." })
      .trim()
      .max(LIMITS.TEXT_TITLE_MAX, `Title must be ${LIMITS.TEXT_TITLE_MAX} characters or fewer.`)
      .optional()
      .transform((v) => (v ? v : null)),
    // Length is checked by validateStudyText() after cleaning (FR-2.4, FR-2.5),
    // which counts code points the way Postgres does.
    body: z.string({ required_error: "Paste or upload some study text.", invalid_type_error: "Paste or upload some study text." }),
  },
  objectBody,
);

export const generateQuizSchema = z.object(
  {
    textId: z.string({ required_error: "Choose a saved study text first.", invalid_type_error: "Choose a saved study text first." })
      .uuid("Choose a saved study text first."),
    questionCount: z
      .preprocess(
        (v) => (typeof v === "string" && /^\s*\d+\s*$/.test(v) ? Number(v.trim()) : v),
        z.union([z.literal(5), z.literal(10), z.literal(15)], {
          errorMap: () => ({ message: `Choose ${LIMITS.QUESTION_COUNTS.join(", ")} questions.` }),
        }),
      )
      .default(LIMITS.DEFAULT_QUESTION_COUNT as 10),
  },
  objectBody,
);

export const submitAttemptSchema = z
  .object(
    {
      startedAt: z.string().datetime({ offset: true, message: "Attempt start time is invalid." }).optional(),
      answers: z
        .array(
          z.object({
            // Lower-cased so the duplicate check below can't be slipped past by
            // sending the same id in mixed case — that reached submit_attempt
            // and came back as an opaque unique-violation.
            questionId: z
              .string({ required_error: "That answer is missing its question.", invalid_type_error: "That answer is missing its question." })
              .uuid("That answer is missing its question.")
              .transform((s) => s.toLowerCase()),
            response: z
              .string({ required_error: "Answers must be text.", invalid_type_error: "Answers must be text." })
              .max(LIMITS.SHORT_ANSWER_RESPONSE_MAX, `Answers must be ${LIMITS.SHORT_ANSWER_RESPONSE_MAX} characters or fewer.`),
          }),
          { required_error: "Answer at least one question before submitting.", invalid_type_error: "Answer at least one question before submitting." },
        )
        .min(1, "Answer at least one question before submitting.")
        // A quiz never has more than QUIZ_MAX_QUESTIONS questions (DB check), so anything
        // bigger is not a real submission. Duplicates would otherwise surface as a DB
        // unique-violation (500) instead of a clean validation error.
        .max(LIMITS.QUIZ_MAX_QUESTIONS, "That submission has more answers than the quiz has questions.")
        .refine((answers) => new Set(answers.map((a) => a.questionId)).size === answers.length, {
          message: "Each question can only be answered once.",
        }),
    },
    objectBody,
  )
  // startedAt only decides how long the attempt took; a skewed clock must not
  // cost a student their finished quiz, so drop it and let the server use now()
  // (submit_attempt clamps it the same way).
  .transform((s) => (s.startedAt && !notFromTheFuture(s.startedAt) ? { ...s, startedAt: undefined } : s));

export const createTaskSchema = z.object(
  {
    subject: z
      .string({ required_error: "Enter a subject for the task.", invalid_type_error: "Enter a subject for the task." })
      .trim()
      .min(LIMITS.TASK_SUBJECT_MIN, "Enter a subject for the task.")
      .max(LIMITS.TASK_SUBJECT_MAX, `Subject must be ${LIMITS.TASK_SUBJECT_MAX} characters or fewer.`),
    // nullish, not optional: `StudyTask.description` is `string | null`, so a
    // client echoing a task back with description: null was getting a 400.
    description: z
      .string({ invalid_type_error: "Description must be text." })
      .trim()
      .max(LIMITS.TASK_DESCRIPTION_MAX, `Description must be ${LIMITS.TASK_DESCRIPTION_MAX} characters or fewer.`)
      .nullish()
      .transform((v) => (v ? v : null)),
    estimatedMinutes: wholeNumber("Estimated time must be a whole number of minutes.")
      .pipe(
        z
          .number()
          .min(LIMITS.TASK_MINUTES_MIN, `Estimated time must be at least ${LIMITS.TASK_MINUTES_MIN} minute.`)
          .max(LIMITS.TASK_MINUTES_MAX, `Estimated time must be ${LIMITS.TASK_MINUTES_MAX} minutes or fewer.`),
      ),
  },
  objectBody,
);

export const updateTaskSchema = createTaskSchema.partial().extend({
  isComplete: z.boolean({ invalid_type_error: "Task completion must be true or false." }).optional(),
});

/**
 * A saved timer session always has both ends (FR-7.4 saves on stop). The
 * client may send durationSeconds for convenience but it is NEVER trusted:
 * the server derives it from the timestamps (SEC-5), so a tampered value
 * can't inflate study history. Migration 0002 derives it again in the database,
 * because the browser can write to `study_sessions` without going through here.
 */
export const createSessionSchema = z
  .object(
    {
      taskId: z.string().uuid("That study task is no longer available.").nullable().optional(),
      startTime: z.string({ required_error: "Session start time is missing.", invalid_type_error: "Session start time is invalid." })
        .datetime({ offset: true, message: "Session start time is invalid." }),
      endTime: z.string({ required_error: "Session end time is missing.", invalid_type_error: "Session end time is invalid." })
        .datetime({ offset: true, message: "Session end time is invalid." }),
      // Accepted and ignored, so an older client can keep sending it.
      durationSeconds: z.unknown().optional(),
    },
    objectBody,
  )
  .superRefine((s, ctx) => {
    const ms = Date.parse(s.endTime) - Date.parse(s.startTime);
    if (ms < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endTime"], message: "Session end time must be after its start time." });
    } else if (ms > LIMITS.SESSION_MAX_SECONDS * 1000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endTime"], message: "A single session can't be longer than 24 hours." });
    }
    if (!notFromTheFuture(s.startTime)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["startTime"], message: "Session start time can't be in the future." });
    }
    if (!notFromTheFuture(s.endTime)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endTime"], message: "Session end time can't be in the future." });
    }
  })
  .transform((s) => ({
    taskId: s.taskId ?? null,
    startTime: s.startTime,
    endTime: s.endTime,
    durationSeconds: Math.round((Date.parse(s.endTime) - Date.parse(s.startTime)) / 1000),
  }));

export const preferenceSchema = z.object(
  { theme: z.enum(THEMES, { errorMap: () => ({ message: "Theme must be light or dark." }) }) },
  objectBody,
);
