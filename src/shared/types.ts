/**
 * Domain types — one per class in SDD §4 (Analysis-Level Class Diagram).
 * These are the shapes that cross the API boundary as JSON. Database row
 * shapes (snake_case) live in src/backend/db/rows.ts and are mapped here.
 */
import type { Theme } from "./constants";

export type QuestionType = "mcq" | "short_answer";

/** UserProfile */
export interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  createdAt: string;
}

/** StudyText */
export interface StudyText {
  textId: string;
  ownerId: string;
  title: string | null;
  body: string;
  charCount: number;
  createdAt: string;
}

/** StudyText without the body — for list views. */
export type StudyTextSummary = Omit<StudyText, "body"> & { quizCount: number };

/** Quiz */
export interface Quiz {
  quizId: string;
  textId: string;
  ownerId: string;
  questionCount: number;
  createdAt: string;
  title: string | null; // derived from the source text's title
}

/** Question — full record, server-side only. Never sent to the browser before submission. */
export interface Question {
  questionId: string;
  quizId: string;
  position: number;
  type: QuestionType;
  text: string;
  options: string[]; // exactly 4 for mcq, [] for short_answer
  correctOption: number | null; // index 0-3 for mcq
  expectedAnswer: string | null; // for short_answer
}

/** Question.withoutAnswerKey() — what the quiz-taking screen receives (SDD decision 2). */
export type PublicQuestion = Omit<Question, "correctOption" | "expectedAnswer">;

/** Quiz payload for the taking screen. */
export interface QuizForTaking {
  quiz: Quiz;
  questions: PublicQuestion[];
}

/** One user answer, keyed by question. MCQ answers are the option index as a string. */
export interface AnswerInput {
  questionId: string;
  response: string;
}

/** AnswerRecord */
export interface AnswerRecord {
  recordId: string;
  attemptId: string;
  questionId: string;
  response: string;
  isCorrect: boolean;
}

/** Attempt */
export interface Attempt {
  attemptId: string;
  quizId: string;
  ownerId: string;
  startedAt: string;
  submittedAt: string;
  score: number; // 0..100
}

/** Attempt.getReview() — results screen (FR-4.6). Includes the answer key. */
export interface AttemptReview {
  attempt: Attempt;
  quiz: Quiz;
  items: Array<{
    question: Question;
    response: string;
    isCorrect: boolean;
  }>;
}

/** Score-history row (FR-5.2). */
export interface HistoryEntry {
  attemptId: string;
  quizId: string;
  quizTitle: string | null;
  score: number;
  submittedAt: string;
  isBest: boolean; // FR-5.4
}

/** StudyTask */
export interface StudyTask {
  taskId: string;
  ownerId: string;
  subject: string;
  description: string | null;
  estimatedMinutes: number;
  isComplete: boolean;
  createdAt: string;
}

/** StudySession */
export interface StudySession {
  sessionId: string;
  ownerId: string;
  taskId: string | null;
  startTime: string;
  endTime: string | null;
  durationSeconds: number;
}

/** Preference */
export interface Preference {
  ownerId: string;
  theme: Theme;
  updatedAt: string;
}

/** Standard API envelope (SRS §3.1 "Error messages": human-readable, never a stack trace). */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; fields?: Record<string, string> } };
