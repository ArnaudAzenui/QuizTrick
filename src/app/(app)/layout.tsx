import Link from "next/link";
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
 * Signed-in area shell (skeleton). The middleware guards these routes once
 * Supabase is configured (FR-1.4).
 *
 * TODO(frontend, WBS 1.4/1.5/1.6): replace with the real AppShell —
 * active-link highlighting, ThemeProvider + ThemeToggle (FR-8.x, Hillary),
 * TimerProvider so the timer survives navigation (FR-7.5, Hillary),
 * display name + logout button.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-surface">
        <nav className="mx-auto flex max-w-5xl items-center gap-5 px-6 py-3 text-sm">
          <span className="mr-2 text-base font-semibold">QuizTrick</span>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-muted hover:text-fg">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
