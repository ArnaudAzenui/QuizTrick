import { toProfile } from "@backend/db/rows";
import { AppError } from "@backend/lib/errors";
import { createUserClient } from "@backend/supabase/server";
import { profileUpdateSchema } from "@backend/validation/schemas";
import { getCurrentUser } from "./auth.service";

const columns = "id, email, display_name, created_at";

export async function getProfile() {
  const { userId } = await getCurrentUser();
  const client = await createUserClient();
  const { data, error } = await client.from("profiles").select(columns).eq("id", userId).maybeSingle();
  if (error) throw AppError.internal("We couldn't load your profile. Please try again.");
  if (!data) throw AppError.notFound("Your profile");
  return toProfile(data);
}

export async function updateDisplayName(input: { displayName: string }) {
  const { userId } = await getCurrentUser();
  const { displayName } = profileUpdateSchema.parse(input);
  const client = await createUserClient();
  // RLS applies; never accept an owner ID from the caller.
  const { data, error } = await client.from("profiles")
    .update({ display_name: displayName }).eq("id", userId).select(columns).maybeSingle();
  if (error) throw AppError.internal("We couldn't save your display name. Please try again.");
  if (!data) throw AppError.notFound("Your profile");
  return toProfile(data);
}
