"use client";

import { useState } from "react";
import { api, errorMessage } from "@frontend/lib/api-client";
import { ROUTES } from "@shared/constants";

export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function logout() {
    if (busy) return;
    setBusy(true); setError(undefined);
    try {
      await api.post("/api/auth/logout");
      // Discard cached signed-in pages from the client router.
      window.location.replace(ROUTES.login);
    } catch (err) { setError(errorMessage(err)); setBusy(false); }
  }
  return <div className="ml-auto">
    <button type="button" onClick={logout} disabled={busy} className="rounded-lg border border-border px-3 py-2 disabled:opacity-60">{busy ? "Logging out..." : "Log out"}</button>
    {error && <p role="alert" className="mt-1 text-sm text-danger">{error}</p>}
  </div>;
}
