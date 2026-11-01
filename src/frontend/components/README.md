# Frontend components

The signed-in UI, built by Hillary and Fardin (WBS 1.4–1.6). Pages under `src/app/` stay thin and render one of these. Shared plumbing lives in `../lib` (`api-client.ts` — typed fetch wrapper for the API envelope, `supabase-browser.ts`, `cn.ts`) and the theme tokens in `../styles/globals.css` + `tailwind.config.ts`.

| Folder / file | Components | Spec |
|---|---|---|
| `layout/` | `AppShell` (signed-in frame, mounts the timer), `NavLinks` (active-link nav) | NFR-U3 |
| `ThemeToggle.tsx` | light/dark toggle in the header; the pre-paint script is in `src/app/layout.tsx` | FR-8.1–8.4, WBS 1.6.2 |
| `AuthForm.tsx`, `FormField.tsx`, `LogoutButton.tsx` | login/register form, labelled input with error text, logout | FR-1.1–1.3, WBS 1.4.1.2 |
| `texts/` | `StudyTextEditor` (paste + `.txt` upload + live char count), `TextList`, `TextDetail` (read, generate, open quizzes, delete) | FR-2.1–2.6, WBS 1.4.2 |
| `quiz/` | `GeneratePanel` (generate/regenerate with progress, FR-3.6), `QuizRunner` (FR-4.1–4.2), `QuizResults` (FR-4.6) | WBS 1.4.3–1.4.4 |
| `history/` | `ScoreHistory` (attempts newest first, best flag, expandable incorrect answers) | FR-5.2, FR-5.4, WBS 1.6.1 |
| `tasks/` | `TaskManager`, `TaskForm`, `TaskList` | FR-6.1–6.6, WBS 1.5.1 |
| `timer/` | `TimerProvider` (survives navigation, FR-7.5), `StudyTimer`, `TimerIndicator` in the header | FR-7.1–7.5, WBS 1.5.2 |

Conventions:

- Every async action shows a loading state and a student-facing error with a retry (NFR-U2). Error text comes from `errorMessage()` in `../lib/api-client.ts`, never from the raw response.
- Every screen must meet WCAG 2.1 AA contrast in both themes. The token pairs in `globals.css` are pre-checked; new colour combinations are not.
- Controls are keyboard-operable (NFR-U3). Pure helpers next to a component (`quiz-runner.ts`, `tasks.ts`, `timer.ts`, `text-file.ts`) keep logic testable without rendering.
- Limits come from `@shared/constants`, never hardcoded.
