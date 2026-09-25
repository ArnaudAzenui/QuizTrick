import type { z } from "zod";
import { AppError } from "@backend/lib/errors";
import { createUserClient } from "@backend/supabase/server";
import { loginSchema, registerSchema } from "@backend/validation/schemas";

export async function loginUser(input: z.infer<typeof loginSchema>) {
  const client = await createUserClient();
  const { data, error } = await client.auth.signInWithPassword(input);
  if (error?.status === 429) throw AppError.rateLimited("Too many attempts. Please try again later.");
  if (error || !data.user || !data.session) throw AppError.unauthenticated("Check your email and password and confirm your email if required.");
  return { userId: data.user.id, email: data.user.email };
}

export async function registerUser(input: z.infer<typeof registerSchema>) {
  const client = await createUserClient();
  const { data, error } = await client.auth.signUp({
    email: input.email, password: input.password,
    options: { data: { display_name: input.displayName ?? "" } },
  });
  if (error?.status === 429) throw AppError.rateLimited("Too many attempts. Please try again later.");
  if (error || !data.user) throw AppError.validation("Unable to create your account. Try logging in if you already registered.");
  return { userId: data.user.id, needsEmailConfirmation: !data.session };
}
