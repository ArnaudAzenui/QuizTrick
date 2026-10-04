import { handle, ok, parseBody } from "@backend/lib/api";
import { generateQuiz } from "@backend/services/quiz-generator";
import { generateQuizSchema } from "@backend/validation/schemas";

/**
 * POST /api/generate - { textId, questionCount?: 5|10|15 } -> Quiz (201). RATE_LIMITED after 20/hr; no partial quiz is ever stored.
 *
 * Full contract: docs/API.md - FR-3.1 - FR-3.9, SEC-6, SEC-7
 */

export const maxDuration = 60; // Vercel: allow the 30 s generation ceiling (PR-2)

export const POST = handle(async (req) => ok(await generateQuiz(await parseBody(req, generateQuizSchema)), 201));
