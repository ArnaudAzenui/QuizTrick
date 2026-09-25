/**
 * Limits and defaults taken directly from SRS §3.1 (External Interfaces),
 * §3.2 (Functions) and §4.1 (Security). Both the browser and the server
 * import from here so validation rules never drift apart.
 */

export const LIMITS = {
  /** FR-1.2 / SRS §3.1 */
  EMAIL_MAX: 254,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 72,
  /** FR-1.6. Mirrors the `profiles_display_name_len` check in migration 0002. */
  DISPLAY_NAME_MAX: 60,

  /** FR-2.4 */
  TEXT_MIN_CHARS: 200,
  TEXT_MAX_CHARS: 20_000,
  /** FR-2.2 (100 KB) */
  TEXT_FILE_MAX_BYTES: 100 * 1024,
  TEXT_TITLE_MAX: 120,

  /** FR-3.2 / FR-3.3 */
  QUESTION_COUNTS: [5, 10, 15] as const,
  DEFAULT_QUESTION_COUNT: 10,
  MCQ_RATIO: 0.7,
  MCQ_OPTION_COUNT: 4,
  SHORT_ANSWER_KEY_MAX: 50,
  /** SRS §3.1 quiz answers */
  SHORT_ANSWER_RESPONSE_MAX: 200,

  /**
   * FR-3.8 / PR-2. GENERATION_TIMEOUT_MS is the TOTAL wall-clock budget for one
   * /api/generate call, shared across the initial attempt and every retry —
   * not a per-attempt timeout. (Vercel Hobby caps the route at 60 s; 3 × 30 s
   * would blow through it.) A retry only starts if enough budget remains.
   */
  GENERATION_TIMEOUT_MS: 30_000,
  GENERATION_MAX_RETRIES: 2,
  /** SEC-6 */
  GENERATIONS_PER_HOUR: 20,

  /** FR-6.x / SRS §3.1 study task */
  TASK_SUBJECT_MIN: 1,
  TASK_SUBJECT_MAX: 100,
  TASK_DESCRIPTION_MAX: 500,
  TASK_MINUTES_MIN: 1,
  TASK_MINUTES_MAX: 600,

  /** FR-7.4 — one timer session can't exceed a day; anything longer is a stuck client. */
  SESSION_MAX_SECONDS: 24 * 60 * 60,

  /**
   * How far ahead of the server a browser clock may be before we stop believing
   * its timestamps. Student laptops are routinely a minute or two out, and
   * rejecting a finished study session over that would be its own bug — but a
   * timestamp hours in the future is fabricated, not skewed.
   */
  CLOCK_SKEW_MS: 5 * 60 * 1000,

  /** Mirrors the `question_count between 1 and 30` check in the DB schema. */
  QUIZ_MAX_QUESTIONS: 30,

  /** FR-1.5 / SEC-8 */
  SESSION_MAX_DAYS: 7,
} as const;

export type QuestionCount = (typeof LIMITS.QUESTION_COUNTS)[number];

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = "light";

export const QUESTION_TYPES = ["mcq", "short_answer"] as const;

/** Route names used by both the nav and the middleware (FR-1.4). */
export const ROUTES = {
  home: "/",
  login: "/login",
  register: "/register",
  dashboard: "/dashboard",
  texts: "/texts",
  newText: "/texts/new",
  text: (id: string) => `/texts/${id}`,
  quiz: (id: string) => `/quizzes/${id}`,
  results: (quizId: string, attemptId: string) => `/quizzes/${quizId}/results/${attemptId}`,
  history: "/history",
  tasks: "/tasks",
  timer: "/timer",
  profile: "/profile",
  /** Where Supabase's emailed links land; exchanges the code for a session (FR-1.7). */
  authCallback: "/auth/callback",
  /** Where a user types a new password after following a reset link (FR-1.7). */
  updatePassword: "/update-password",
} as const;

/** Paths that require a signed-in user (FR-1.4). Everything else is public. */
export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/texts",
  "/quizzes",
  "/history",
  "/tasks",
  "/timer",
  "/profile",
  // Reached only with the session /auth/callback just established from a reset
  // link. Guarded so the form can't be opened, or posted to, without one.
  "/update-password",
];
