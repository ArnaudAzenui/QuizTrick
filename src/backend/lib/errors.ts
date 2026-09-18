/**
 * AppError — the only error type that is ever turned into a user-facing
 * message. Anything else becomes a generic "something went wrong" so that
 * internal details and stack traces never reach the browser (SRS §3.1, NFR-U2).
 */
export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "AI_UNAVAILABLE"
  | "AI_BAD_OUTPUT"
  | "CONFLICT"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  AI_UNAVAILABLE: 503,
  AI_BAD_OUTPUT: 502,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string>;

  constructor(code: ErrorCode, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.fields = fields;
  }

  static validation(message: string, fields?: Record<string, string>) {
    return new AppError("VALIDATION", message, fields);
  }
  static unauthenticated(message = "Please sign in to continue.") {
    return new AppError("UNAUTHENTICATED", message);
  }
  static notFound(what = "That item") {
    return new AppError("NOT_FOUND", `${what} could not be found. It may have been deleted.`);
  }
  static rateLimited(message: string) {
    return new AppError("RATE_LIMITED", message);
  }
  static aiUnavailable(message = "The quiz generator is not responding right now. Please try again in a moment.") {
    return new AppError("AI_UNAVAILABLE", message);
  }
  static aiBadOutput(message = "The quiz generator returned an unusable quiz. Please try generating again.") {
    return new AppError("AI_BAD_OUTPUT", message);
  }
  static internal(message = "Something went wrong on our side. Please try again.") {
    return new AppError("INTERNAL", message);
  }
}
