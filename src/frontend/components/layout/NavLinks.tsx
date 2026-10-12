"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@frontend/lib/cn";
import { ROUTES } from "@shared/constants";

const NAV = [
  { href: ROUTES.dashboard, label: "Dashboard" },
  { href: ROUTES.texts, label: "Texts" },
  { href: ROUTES.tasks, label: "Tasks" },
  { href: ROUTES.timer, label: "Timer" },
  { href: ROUTES.history, label: "History" },
  { href: ROUTES.profile, label: "Profile" },
] as const;

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="flex flex-wrap gap-1 pb-3">
      {NAV.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-fg"
                : "text-muted hover:bg-bg hover:text-fg",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
