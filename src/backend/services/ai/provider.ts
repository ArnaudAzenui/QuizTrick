/**
 * AI provider abstraction (NFR-M3). The rest of the backend only ever sees
 * this interface; swapping OpenAI for another vendor means adding one file
 * in this folder and changing AI_PROVIDER in the environment.
 */
export interface AiCompletionRequest {
  system: string;
  user: string;
  /** Ask the provider for a JSON object response when it supports it. */
  jsonMode?: boolean;
  timeoutMs: number;
}

export interface AiProvider {
  readonly name: string;
  /** Returns the raw text of the model's reply. Throws AppError on failure. */
  complete(req: AiCompletionRequest): Promise<string>;
}
