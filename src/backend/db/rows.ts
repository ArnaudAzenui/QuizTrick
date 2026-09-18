/**
 * Database row shapes (snake_case, exactly as Supabase returns them) and
 * mappers to the camelCase domain types in src/shared/types.ts.
 * If you change a column in supabase/migrations, change it here too.
 */
import type {
  Attempt,
  AnswerRecord,
  Preference,
  Question,
  Quiz,
  StudySession,
  StudyTask,
  StudyText,
  UserProfile,
} from "@shared/types";

export interface ProfileRow {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}
export interface StudyTextRow {
  id: string;
  owner_id: string;
  title: string | null;
  body: string;
  char_count: number;
  created_at: string;
}
export interface QuizRow {
  id: string;
  owner_id: string;
  text_id: string;
  question_count: number;
  created_at: string;
}
export interface QuestionRow {
  id: string;
  quiz_id: string;
  position: number;
  type: "mcq" | "short_answer";
  text: string;
  options: string[];
  correct_option: number | null;
  expected_answer: string | null;
}
export interface AttemptRow {
  id: string;
  owner_id: string;
  quiz_id: string;
  started_at: string;
  submitted_at: string;
  score: number;
}
export interface AnswerRecordRow {
  id: string;
  attempt_id: string;
  question_id: string;
  response: string;
  is_correct: boolean;
}
export interface StudyTaskRow {
  id: string;
  owner_id: string;
  subject: string;
  description: string | null;
  estimated_minutes: number;
  is_complete: boolean;
  created_at: string;
}
export interface StudySessionRow {
  id: string;
  owner_id: string;
  task_id: string | null;
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
  created_at: string;
}
export interface PreferenceRow {
  owner_id: string;
  theme: "light" | "dark";
  updated_at: string;
}

export const toProfile = (r: ProfileRow): UserProfile => ({
  userId: r.id,
  email: r.email,
  displayName: r.display_name,
  createdAt: r.created_at,
});

export const toStudyText = (r: StudyTextRow): StudyText => ({
  textId: r.id,
  ownerId: r.owner_id,
  title: r.title,
  body: r.body,
  charCount: r.char_count,
  createdAt: r.created_at,
});

export const toQuiz = (r: QuizRow, title: string | null = null): Quiz => ({
  quizId: r.id,
  ownerId: r.owner_id,
  textId: r.text_id,
  questionCount: r.question_count,
  createdAt: r.created_at,
  title,
});

export const toQuestion = (r: QuestionRow): Question => ({
  questionId: r.id,
  quizId: r.quiz_id,
  position: r.position,
  type: r.type,
  text: r.text,
  options: Array.isArray(r.options) ? r.options : [],
  correctOption: r.correct_option,
  expectedAnswer: r.expected_answer,
});

export const toAttempt = (r: AttemptRow): Attempt => ({
  attemptId: r.id,
  ownerId: r.owner_id,
  quizId: r.quiz_id,
  startedAt: r.started_at,
  submittedAt: r.submitted_at,
  score: r.score,
});

export const toAnswerRecord = (r: AnswerRecordRow): AnswerRecord => ({
  recordId: r.id,
  attemptId: r.attempt_id,
  questionId: r.question_id,
  response: r.response,
  isCorrect: r.is_correct,
});

export const toStudyTask = (r: StudyTaskRow): StudyTask => ({
  taskId: r.id,
  ownerId: r.owner_id,
  subject: r.subject,
  description: r.description,
  estimatedMinutes: r.estimated_minutes,
  isComplete: r.is_complete,
  createdAt: r.created_at,
});

export const toStudySession = (r: StudySessionRow): StudySession => ({
  sessionId: r.id,
  ownerId: r.owner_id,
  taskId: r.task_id,
  startTime: r.start_time,
  endTime: r.end_time,
  durationSeconds: r.duration_seconds,
});

export const toPreference = (r: PreferenceRow): Preference => ({
  ownerId: r.owner_id,
  theme: r.theme,
  updatedAt: r.updated_at,
});
