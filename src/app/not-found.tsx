import Link from "next/link";
import { ROUTES } from "@shared/constants";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="text-muted">It may have been deleted, or the link may be wrong.</p>
      <Link href={ROUTES.dashboard} className="text-primary underline-offset-2 hover:underline">
        Back to dashboard
      </Link>
    </div>
  );
}
