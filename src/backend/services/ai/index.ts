/**
 * AI provider selection (NFR-M3). The rest of the backend calls
 * getAiProvider() and only ever sees the AiProvider interface.
 *
 * Adding a vendor: write a provider file in this folder and add a case below.
 * Vendors with an OpenAI-compatible endpoint (Gemini included) need no new
 * code — keep AI_PROVIDER=openai and set AI_BASE_URL (docs/SETUP.md).
 */
import { AppError } from "@backend/lib/errors";
import { env } from "@backend/lib/env";
import { createOpenAiProvider } from "./openai.provider";
import type { AiProvider } from "./provider";

export type { AiProvider, AiCompletionRequest } from "./provider";

export function getAiProvider(): AiProvider {
  let config: ReturnType<typeof env.ai>;
  try {
    config = env.ai();
  } catch (err) {
    // A missing AI_API_KEY is a deployment problem; the student just sees the
    // generator as unavailable rather than a generic crash.
    console.error("[ai] provider is not configured", err instanceof Error ? err.message : err);
    throw AppError.aiUnavailable();
  }

  switch (config.provider) {
    case "openai":
      return createOpenAiProvider(config);
    default:
      console.error("[ai] unknown AI_PROVIDER", config.provider);
      throw AppError.aiUnavailable();
  }
}
