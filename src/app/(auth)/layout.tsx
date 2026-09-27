import Link from "next/link";
import { ROUTES } from "@shared/constants";

/** Centered card layout for login / register (WBS 1.4.1.2). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <Link href={ROUTES.home} className="text-[30px] font-semibold">
          QuizTrick
        </Link>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
