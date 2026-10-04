import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@backend/lib/errors";
import { createOpenAiProvider } from "@backend/services/ai/openai.provider";
import { getAiProvider } from "@backend/services/ai";

const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
afterAll(() => quiet.mockRestore());

const fetchMock = vi.fn();
const provider = createOpenAiProvider({ apiKey: "sk-test", model: "test-model", baseUrl: "https://ai.example/v1/" });
const request = { system: "sys", user: "usr", jsonMode: true, timeoutMs: 1000 };

const completion = (content: unknown, finish_reason = "stop") =>
  new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason }] }), { status: 200 });

async function caught(p: Promise<unknown>): Promise<AppError> {
  try {
    await p;
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    return err as AppError;
  }
  throw new Error("expected the call to throw");
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("openai provider", () => {
  it("posts a chat completion in JSON mode and returns the message text", async () => {
    fetchMock.mockResolvedValue(completion('{"questions":[]}'));
    expect(await provider.complete(request)).toBe('{"questions":[]}');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://ai.example/v1/chat/completions");
    expect(init.headers.authorization).toBe("Bearer sk-test");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("test-model");
    expect(body.messages).toEqual([{ role: "system", content: "sys" }, { role: "user", content: "usr" }]);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("maps a timeout or network failure to AI_UNAVAILABLE", async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error("timed out"), { name: "TimeoutError" }));
    expect((await caught(provider.complete(request))).code).toBe("AI_UNAVAILABLE");
  });

  it.each([401, 429, 500])("maps HTTP %i to AI_UNAVAILABLE without leaking the vendor's text", async (status) => {
    fetchMock.mockResolvedValue(new Response("Incorrect API key sk-test", { status }));
    const err = await caught(provider.complete(request));
    expect(err.code).toBe("AI_UNAVAILABLE");
    expect(err.message).not.toContain("sk-test");
  });

  it("maps an empty or truncated reply to AI_BAD_OUTPUT", async () => {
    fetchMock.mockResolvedValue(completion(""));
    expect((await caught(provider.complete(request))).code).toBe("AI_BAD_OUTPUT");
    fetchMock.mockResolvedValue(completion('{"questions":[', "length"));
    expect((await caught(provider.complete(request))).code).toBe("AI_BAD_OUTPUT");
  });
});

describe("getAiProvider", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("returns the openai provider by default", () => {
    process.env.AI_API_KEY = "sk-test";
    delete process.env.AI_PROVIDER;
    expect(getAiProvider().name).toBe("openai");
  });

  it("reports a missing key or unknown provider as AI_UNAVAILABLE", () => {
    delete process.env.AI_API_KEY;
    expect(() => getAiProvider()).toThrow(AppError);
    process.env.AI_API_KEY = "sk-test";
    process.env.AI_PROVIDER = "nope";
    expect(() => getAiProvider()).toThrow(expect.objectContaining({ code: "AI_UNAVAILABLE" }));
  });
});
