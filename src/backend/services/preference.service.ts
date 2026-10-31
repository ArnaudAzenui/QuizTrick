/**
 * Theme preference (WBS 1.6.2).
 *
 *   - getPreference (FR-8.3)
 *   - setTheme (FR-8.3)
 *
 * setTheme upserts rather than updates: the signup trigger creates the row, but
 * accounts that predate the schema (or a row deleted before migration 0002
 * closed that off) may not have one, and "theme could not be found" is a
 * nonsense error to show.
 *
 * Errors: throw AppError (src/backend/lib/errors.ts); routes wrap handlers with handle() from lib/api.ts.
 * Data access: the user client only. RLS limits every query here to the
 * caller's own row, so nothing in this file needs the service-role client.
 */
import type { z } from "zod";
import { AppError } from "@backend/lib/errors";
import { createUserClient } from "@backend/supabase/server";
import { toPreference, type PreferenceRow } from "@backend/db/rows";
import type { preferenceSchema } from "@backend/validation/schemas";
import { DEFAULT_THEME } from "@shared/constants";
import type { Preference } from "@shared/types";
import { getCurrentUser } from "./auth.service";

const PREFERENCE_COLUMNS = "owner_id, theme, updated_at";

/**
 * FR-8.3. A user with no preferences row simply hasn't chosen yet, so they get
 * the default theme instead of an error. Reading never writes: the row is only
 * created by setTheme. `updatedAt` is the epoch because nothing was ever saved.
 */
export async function getPreference(): Promise<Preference> {
  const user = await getCurrentUser();
  const client = await createUserClient();
  const { data, error } = await client
    .from("preferences")
    .select(PREFERENCE_COLUMNS)
    .eq("owner_id", user.userId)
    .maybeSingle<PreferenceRow>();
  if (error) {
    console.error("[preferences] select failed", error.code, error.message);
    throw AppError.internal("We couldn't load your theme. Please try again.");
  }
  if (!data) return { ownerId: user.userId, theme: DEFAULT_THEME, updatedAt: new Date(0).toISOString() };
  return toPreference(data);
}

/** FR-8.3. Saves the theme, creating the row if the account has none. */
export async function setTheme(input: z.output<typeof preferenceSchema>): Promise<Preference> {
  const user = await getCurrentUser();
  const client = await createUserClient();
  const { data, error } = await client
    .from("preferences")
    .upsert({ owner_id: user.userId, theme: input.theme }, { onConflict: "owner_id" })
    .select(PREFERENCE_COLUMNS)
    .single<PreferenceRow>();
  if (error || !data) {
    console.error("[preferences] upsert failed", error?.code, error?.message);
    throw AppError.internal("We couldn't save your theme. Please try again.");
  }
  return toPreference(data);
}
