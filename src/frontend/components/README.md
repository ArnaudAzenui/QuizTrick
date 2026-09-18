# Frontend components — build plan

Only `Placeholder.tsx` exists so far; it is what every unbuilt page renders. This is the intended component tree — create the folders/files as you build, and delete `Placeholder.tsx` at the end. Shared plumbing already exists in `../lib` (`api-client.ts` — typed fetch wrapper for the API envelope, `supabase-browser.ts`, `cn.ts`) and theme tokens in `../styles/globals.css` + `tailwind.config.ts`.

| Area (folder) | Components | Spec | Owner |
|---|---|---|---|
| `ui/` | Button, Input, Card, Alert, Spinner, ConfirmDialog | reusable primitives, keyboard-operable (NFR-U3) | shared |
| `layout/` | AppShell, NavLinks | signed-in shell + active-link nav (replaces the stub in `src/app/(app)/layout.tsx`) | Hillary |
| `theme/` | ThemeProvider, ThemeToggle (+ pre-paint ThemeScript) | FR-8.1–8.4, WBS 1.6.2 | Hillary |
| `auth/` | LoginForm, RegisterForm, LogoutButton | FR-1.1–1.3, WBS 1.4.1.2 | frontend |
| `texts/` | StudyTextEditor (paste + .txt upload + live char count), TextList | FR-2.1–2.6, WBS 1.4.2 | frontend |
| `quiz/` | GeneratePanel (progress indicator, FR-3.6), QuizRunner (FR-4.1–4.2), ResultsReview (FR-4.6) | WBS 1.4.3–1.4.4 | frontend + Arnaud |
| `scores/` | ScoreHistory | FR-5.2, FR-5.4, WBS 1.6.1 | Fardin |
| `tasks/` | TaskManager, TaskForm, TaskList | FR-6.1–6.6, WBS 1.5.1 | Fardin |
| `timer/` | TimerProvider (survives navigation, FR-7.5), StudyTimer, TimerBadge | FR-7.1–7.5, WBS 1.5.2 | Hillary |
| `profile/` | ProfileForm | FR-1.6 | frontend |

Every screen must meet WCAG 2.1 AA contrast in both themes (the token pairs in `globals.css` are pre-checked) and show a loading state for every async action (NFR-U2).
