/**
 * OpenAI-compatible provider (WBS 1.4.3.3).
 *
 * Talks to {AI_BASE_URL}/chat/completions with plain fetch, so it works for
 * OpenAI and for any vendor exposing the same API — Gemini's OpenAI-compatible
 * endpoint included (docs/SETUP.md). No SDK: one request shape is all we use.
 *
 * Every failure becomes AI_UNAVAILABLE or AI_BAD_OUTPUT. The vendor's own
 * error text is logged and never forwarded: it can name the model, the
 * account or the key, none of which a student should see (SEC-3).
 */
import { AppError } from "@backend/lib/errors";
import type { AiCompletionRequest, AiProvider } from "./provider";

export interface OpenAiConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string | null };
    finish_reason?: string | null;
  }>;
}

export function createOpenAiProvider(config: OpenAiConfig): AiProvider {
  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  return {
    name: "openai",

    async complete(req: AiCompletionRequest): Promise<string> {
      let res: Response;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
          body: JSON.stringify({
            model: config.model,
            messages: [
              { role: "system", content: req.system },
              { role: "user", content: req.user },
            ],
            ...(req.jsonMode ? { response_format: { type: "json_object" } } : {}),
          }),
          signal: AbortSignal.timeout(Math.max(1, req.timeoutMs)),
        });
      } catch (err) {
        // TimeoutError from AbortSignal.timeout, or a network failure.
        const kind = err instanceof Error ? err.name : "unknown";
        console.error("[ai/openai] request failed before a response", kind);
        throw AppError.aiUnavailable();
      }

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        if (res.status === 401 || res.status === 403) {
          console.error("[ai/openai] provider rejected the credentials; check AI_API_KEY", res.status);
        } else {
          console.error("[ai/openai] provider returned an error", res.status, detail.slice(0, 500));
        }
        // 429 here is the vendor's quota, not the student's: SEC-6 is enforced
        // before we get this far, so it is reported as the service being busy.
        throw AppError.aiUnavailable();
      }

      let body: ChatCompletionResponse;
      try {
        body = (await res.json()) as ChatCompletionResponse;
      } catch {
        console.error("[ai/openai] response was not JSON");
        throw AppError.aiBadOutput();
      }

      const choice = body.choices?.[0];
      const content = choice?.message?.content;
      if (typeof content !== "string" || content.trim() === "") {
        console.error("[ai/openai] response had no message content", choice?.finish_reason);
        throw AppError.aiBadOutput();
      }
      // A reply cut off at the token limit is half a JSON document.
      if (choice?.finish_reason === "length") {
        console.error("[ai/openai] response was truncated at the token limit");
        throw AppError.aiBadOutput();
      }
      return content;
    },
  };
}
