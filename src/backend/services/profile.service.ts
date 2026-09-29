/**
 * User profile (WBS 1.4.1, owner: Isaiah).
 *
 *   - getProfile (FR-1.6)
 *   - updateDisplayName (FR-1.6)
 *
 * display_name is the ONLY column a user may write (migration 0002 revoked the
 * rest at the column level). Changing an email is an auth operation —
 * supabase.auth.updateUser() — not an update to public.profiles.
 *
 * Errors: throw AppError (src/backend/lib/errors.ts); routes wrap handlers with handle() from lib/api.ts.
 * Data access: the user client only. RLS limits every query here to the
 * caller's own row, so nothing in this file needs the service-role client.
 */
import type { z } from "zod";
import { AppError } from "@backend/lib/errors";
import { createUserClient } from "@backend/supabase/server";
import { toProfile, type ProfileRow } from "@backend/db/rows";
import type { profileUpdateSchema } from "@backend/validation/schemas";
import type { UserProfile } from "@shared/types";
import { getCurrentUser, type CurrentUser } from "./auth.service";

const PROFILE_COLUMNS = "id, email, display_name, created_at";

/**
 * profiles.email is copied once, by the signup trigger, and nothing updates it
 * afterwards. Supabase auth is the source of truth, so a confirmed email change
 * shows up here immediately instead of the profile quoting the old address.
 */
function withAuthEmail(row: ProfileRow, user: CurrentUser): UserProfile {
  return toProfile({ ...row, email: user.email || row.email });
}

/**
 * Every account gets its row from the signup trigger, and users cannot delete
 * it. A missing row means an account that predates the schema — there is no
 * insert policy on profiles, so the fix is a database repair, not a retry.
 */
const profileMissing = () => AppError.notFound("Your profile");

export async function getProfile(): Promise<UserProfile> {
  const user = await getCurrentUser();
  const client = await createUserClient();
  const { data, error } = await client
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.userId)
    .maybeSingle<ProfileRow>();

  if (error) {
    console.error("[profile] select failed", error.code, error.message);
    throw AppError.internal("We couldn't load your profile. Please try again.");
  }
  if (!data) throw profileMissing();
  return withAuthEmail(data, user);
}

export async function updateDisplayName(input: z.infer<typeof profileUpdateSchema>): Promise<UserProfile> {
  const user = await getCurrentUser();
  const client = await createUserClient();
  // Only display_name is sent: the column grant rejects any other column, and
  // .select() returns the updated row so the caller needs no second request.
  const { data, error } = await client
    .from("profiles")
    .update({ display_name: input.displayName })
    .eq("id", user.userId)
    .select(PROFILE_COLUMNS)
    .maybeSingle<ProfileRow>();

  if (error) {
    // 23514: the length check in migration 0002. The schema checks the same
    // limit first, so reaching this means the two have drifted apart.
    if (error.code === "23514") {
      console.error("[profile] display_name check rejected a value the schema allowed", error.message);
      const message = "That display name isn't allowed. Try a shorter one.";
      throw AppError.validation(message, { displayName: message });
    }
    console.error("[profile] update failed", error.code, error.message);
    throw AppError.internal("We couldn't save your display name. Please try again.");
  }
  // RLS turns "not your row" into "no row", so an empty result is not an error
  // from Postgres — it is a user without a profile.
  if (!data) throw profileMissing();
  return withAuthEmail(data, user);
}
