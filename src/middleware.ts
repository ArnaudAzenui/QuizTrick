import type { NextRequest } from "next/server";
import { updateSession } from "@backend/supabase/middleware";

/** Session refresh + protected-route guard (FR-1.4, FR-1.5). */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on everything except static assets and Next internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)"],
};
