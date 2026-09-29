import Link from "next/link";
import { LogoutButton } from "@frontend/components/LogoutButton";
import { getProfile } from "@backend/services/profile.service";
import { ROUTES } from "@shared/constants";

const NAV = [
  { href: ROUTES.dashboard, label: "Dashboard" },
  { href: ROUTES.texts, label: "Texts" },
  { href: ROUTES.tasks, label: "Tasks" },
  { href: ROUTES.timer, label: "Timer" },
  { href: ROUTES.history, label: "History" },
  { href: ROUTES.profile, label: "Profile" },
] as const;

/**
 * Who is signed in (FR-1.6). Server-rendered from the session cookie, so the
 * name is in the first paint rather than appearing after a fetch.
 *
 * Never throws. The middleware guarantees a session on these routes, but a
 * cookie can expire between that check and this render, and an unauthenticated
 * layout must not turn the whole page into an error — the next navigation
 * redirects to /login on its own.
 */
async function SignedInAs() {
  try {
    const { displayName } = await getProfile();
    return (
      <span className="text-muted">
        Signed in as <span className="font-medium text-fg">{displayName}</span>
      </span>
    );
  } catch {
    return null;
  }
}

/**
 * Signed-in area shell (skeleton). The middleware guards these routes once
 * Supabase is configured (FR-1.4).
 *
 * TODO(frontend, WBS 1.4/1.5/1.6): replace with the real AppShell —
 * active-link highlighting, ThemeProvider + ThemeToggle (FR-8.x, Hillary),
 * TimerProvider so the timer survives navigation (FR-7.5, Hillary).
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-surface">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-5 px-6 py-3 text-sm">
          <span className="mr-2 text-xl font-semibold">QuizTrick</span>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-muted hover:text-fg">
              {item.label}
            </Link>
          ))}
          <div className="ml-auto flex items-center gap-4">
            <SignedInAs />
            <LogoutButton />
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
