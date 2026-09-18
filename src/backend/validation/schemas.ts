/**
 * Zod schemas for every API payload (SEC-5: all input validated server-side).
 * Messages are written for students, not developers (NFR-U2).
 */
import { z } from "zod";
import { LIMITS, THEMES } from "@shared/constants";

export const emailSchema = z
  .string({ required_error: "Enter your email address." })
  .trim()
  .toLowerCase()
  .max(LIMITS.EMAIL_MAX, `Email must be ${LIMITS.EMAIL_MAX} characters or fewer.`)
  .email("Enter a valid email address, like name@example.com.");

export const passwordSchema = z
  .string({ required_error: "Enter a password." })
  .min(LIMITS.PASSWORD_MIN, `Password must be at least ${LIMITS.PASSWORD_MIN} characters.`)
  .max(LIMITS.PASSWORD_MAX, `Password must be ${LIMITS.PASSWORD_MAX} characters or fewer.`);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().max(60, "Display name must be 60 characters or fewer.").optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ required_error: "Enter your password." }).min(1, "Enter your password."),
});

export const resetPasswordSchema = z.object({ email: emailSchema });

export const profileUpdateSchema = z.object({
  displayName: z
    .string({ required_error: "Enter a display name." })
    .trim()
    .min(1, "Display name cannot be empty.")
    .max(60, "Display name must be 60 characters or fewer."),
});

export const createTextSchema = z.object({
  title: z.string().trim().max(LIMITS.TEXT_TITLE_MAX, `Title must be ${LIMITS.TEXT_TITLE_MAX} characters or fewer.`).optional(),
  body: z.string({ required_error: "Paste or upload some study text." }),
});

export const generateQuizSchema = z.object({
  textId: z.string().uuid("Choose a saved study text first."),
  questionCount: z
    .union([z.literal(5), z.literal(10), z.literal(15)])
    .default(LIMITS.DEFAULT_QUESTION_COUNT as 10),
});

export const submitAttemptSchema = z.object({
  startedAt: z.string().datetime().optional(),
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        response: z
          .string()
          .max(LIMITS.SHORT_ANSWER_RESPONSE_MAX, `Answers must be ${LIMITS.SHORT_ANSWER_RESPONSE_MAX} characters or fewer.`),
      }),
    )
    .min(1, "Answer at least one question before submitting.")
    // A quiz never has more than QUIZ_MAX_QUESTIONS questions (DB check), so anything
    // bigger is not a real submission. Duplicates would otherwise surface as a DB
    // unique-violation (500) instead of a clean validation error.
    .max(LIMITS.QUIZ_MAX_QUESTIONS, "That submission has more answers than the quiz has questions.")
    .refine((answers) => new Set(answers.map((a) => a.questionId)).size === answers.length, {
      message: "Each question can only be answered once.",
    }),
});

export const createTaskSchema = z.object({
  subject: z
    .string({ required_error: "Enter a subject for the task." })
    .trim()
    .min(LIMITS.TASK_SUBJECT_MIN, "Enter a subject for the task.")
    .max(LIMITS.TASK_SUBJECT_MAX, `Subject must be ${LIMITS.TASK_SUBJECT_MAX} characters or fewer.`),
  description: z
    .string()
    .trim()
    .max(LIMITS.TASK_DESCRIPTION_MAX, `Description must be ${LIMITS.TASK_DESCRIPTION_MAX} characters or fewer.`)
    .optional()
    .transform((v) => (v ? v : null)),
  estimatedMinutes: z.coerce
    .number({ invalid_type_error: "Estimated time must be a whole number of minutes." })
    .int("Estimated time must be a whole number of minutes.")
    .min(LIMITS.TASK_MINUTES_MIN, "Estimated time must be at least 1 minute.")
    .max(LIMITS.TASK_MINUTES_MAX, `Estimated time must be ${LIMITS.TASK_MINUTES_MAX} minutes or fewer.`),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  isComplete: z.boolean().optional(),
});

/**
 * A saved timer session always has both ends (FR-7.4 saves on stop). The
 * client may send durationSeconds for convenience but it is NEVER trusted:
 * the server derives it from the timestamps (SEC-5), so a tampered value
 * can't inflate study history.
 */
export const createSessionSchema = z
  .object({
    taskId: z.string().uuid().nullable().optional(),
    startTime: z.string().datetime({ message: "Session start time is invalid." }),
    endTime: z.string().datetime({ message: "Session end time is invalid." }),
    durationSeconds: z.coerce.number().int().min(0).optional(),
  })
  .superRefine((s, ctx) => {
    const ms = Date.parse(s.endTime) - Date.parse(s.startTime);
    if (ms < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endTime"], message: "Session end time must be after its start time." });
    } else if (ms > LIMITS.SESSION_MAX_SECONDS * 1000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endTime"], message: "A single session can't be longer than 24 hours." });
    }
  })
  .transform((s) => ({
    taskId: s.taskId ?? null,
    startTime: s.startTime,
    endTime: s.endTime,
    durationSeconds: Math.round((Date.parse(s.endTime) - Date.parse(s.startTime)) / 1000),
  }));

export const preferenceSchema = z.object({
  theme: z.enum(THEMES, { errorMap: () => ({ message: "Theme must be light or dark." }) }),
});
