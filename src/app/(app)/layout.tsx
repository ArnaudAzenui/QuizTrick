import { AppShell } from "@frontend/components/layout/AppShell";
import { getProfile } from "@backend/services/profile.service";

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

/** Persistent layout for signed-in routes. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell signedInAs={<SignedInAs />}>{children}</AppShell>;
}
