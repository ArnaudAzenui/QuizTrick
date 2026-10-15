import type { ReactNode } from "react";
import Link from "next/link";
import { LogoutButton } from "@frontend/components/LogoutButton";
import { ThemeToggle } from "@frontend/components/ThemeToggle";
import { ROUTES } from "@shared/constants";
import { NavLinks } from "./NavLinks";

type AppShellProps = {
  children: ReactNode;
  signedInAs: ReactNode;
};

// Mounted by the shared app layout so a future TimerProvider can wrap the
// header and page content here and keep its state across navigation.
export function AppShell({ children, signedInAs }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4 py-4">
            <Link href={ROUTES.dashboard} className="text-xl font-semibold">
              QuizTrick
            </Link>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {signedInAs}
              <ThemeToggle />
              <LogoutButton />
            </div>
          </div>
          <NavLinks />
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
