/**
 * AI response validation (WBS 1.4.3.4, FR-3.4).
 *
 * The model's reply is untrusted input. Everything the `questions` table checks
 * (migration 0002) is checked here first, so a bad reply is retried instead of
 * failing the insert: exactly 4 distinct non-empty options and one correct
 * index for MCQ, a non-empty expected answer of at most 50 characters for
 * short answer, non-empty question text for both.
 *
 * Tolerant where it costs nothing: a malformed question is dropped and a
 * surplus of one type is trimmed, as long as enough valid questions remain to
 * fill the requested 70/30 mix. Only a shortfall rejects the reply.
 */
import { AppError } from "@backend/lib/errors";
import { LIMITS } from "@shared/constants";
import type { QuestionType } from "@shared/types";
import { countCharacters } from "@shared/utils/text";

/** One question in the shape create_quiz_with_questions takes (snake_case). */
export interface GeneratedQuestion {
  position: number;
  type: QuestionType;
  text: string;
  options: string[];
  correct_option: number | null;
  expected_answer: string | null;
}

/**
 * AI_BAD_OUTPUT with the reason attached. The reason is for the server log
 * ("[generator] attempt N rejected: …"); the student sees the standard message.
 */
export class QuizOutputRejected extends AppError {
  readonly reason: string;
  constructor(reason: string) {
    super("AI_BAD_OUTPUT", AppError.aiBadOutput().message);
    this.reason = reason;
  }
}

type Candidate = Omit<GeneratedQuestion, "position">;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Some models wrap JSON in a markdown fence even in JSON mode. */
function stripCodeFence(raw: string): string {
  const fenced = raw.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : raw.trim();
}

/** Returns the question in storable form, or a reason it can't be stored. */
function checkQuestion(q: unknown): Candidate | string {
  if (!isRecord(q)) return "not an object";
  const text = typeof q.text === "string" ? q.text.trim() : "";
  if (!text) return "empty question text";

  if (q.type === "mcq") {
    if (!Array.isArray(q.options) || q.options.length !== LIMITS.MCQ_OPTION_COUNT) {
      return `mcq needs exactly ${LIMITS.MCQ_OPTION_COUNT} options`;
    }
    if (!q.options.every((o) => typeof o === "string" && o.trim() !== "")) return "mcq option empty or not text";
    const options = (q.options as string[]).map((o) => o.trim());
    // Same comparison as valid_mcq_options(): btrim(lower(...)).
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return "mcq options not distinct";
    const correct = typeof q.correctOption === "string" && /^\d$/.test(q.correctOption) ? Number(q.correctOption) : q.correctOption;
    if (typeof correct !== "number" || !Number.isInteger(correct) || correct < 0 || correct >= options.length) {
      return "mcq correctOption is not an index 0-3";
    }
    return { type: "mcq", text, options, correct_option: correct, expected_answer: null };
  }

  if (q.type === "short_answer") {
    const expected = typeof q.expectedAnswer === "string" ? q.expectedAnswer.trim() : "";
    if (!expected) return "short_answer has no expectedAnswer";
    if (countCharacters(expected) > LIMITS.SHORT_ANSWER_KEY_MAX) {
      return `short_answer expectedAnswer over ${LIMITS.SHORT_ANSWER_KEY_MAX} characters`;
    }
    return { type: "short_answer", text, options: [], correct_option: null, expected_answer: expected };
  }

  return `unknown type ${JSON.stringify(q.type)}`;
}

export function parseGeneratedQuiz(raw: string, mix: { mcq: number; shortAnswer: number }): GeneratedQuestion[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch {
    throw new QuizOutputRejected("reply is not valid JSON");
  }

  // Accept a bare array too: it's an unambiguous answer, just unwrapped.
  const list = Array.isArray(parsed) ? parsed : isRecord(parsed) ? parsed.questions : undefined;
  if (!Array.isArray(list)) throw new QuizOutputRejected("reply has no questions array");

  const dropped: string[] = [];
  const valid: Candidate[] = [];
  const seenText = new Set<string>();
  list.forEach((q, i) => {
    const result = checkQuestion(q);
    if (typeof result === "string") {
      dropped.push(`#${i + 1} ${result}`);
      return;
    }
    const key = result.text.toLowerCase();
    if (seenText.has(key)) {
      dropped.push(`#${i + 1} duplicate question`);
      return;
    }
    seenText.add(key);
    valid.push(result);
  });

  const mcq = valid.filter((q) => q.type === "mcq");
  const short = valid.filter((q) => q.type === "short_answer");
  if (mcq.length < mix.mcq || short.length < mix.shortAnswer) {
    const detail = dropped.length ? `; dropped ${dropped.join(", ")}` : "";
    throw new QuizOutputRejected(
      `needed ${mix.mcq} mcq + ${mix.shortAnswer} short_answer, got ${mcq.length} + ${short.length} valid${detail}`,
    );
  }

  // Keep the model's ordering among the questions that make the cut.
  const keep = new Set<Candidate>([...mcq.slice(0, mix.mcq), ...short.slice(0, mix.shortAnswer)]);
  return valid.filter((q) => keep.has(q)).map((q, i) => ({ position: i + 1, ...q }));
}
