import { z } from "zod";
import { handle, ok, parseBody, type RouteCtx } from "@backend/lib/api";
import { checkPracticeAnswer } from "@backend/services/attempt.service";
import { idSchema } from "@backend/validation/schemas";
import { LIMITS } from "@shared/constants";

const schema = z.object({ questionId: idSchema, response: z.string().trim().min(1).max(LIMITS.SHORT_ANSWER_RESPONSE_MAX) });

export const POST = handle<RouteCtx<{ id: string }>>(async (request, { params }) => {
  const input = await parseBody(request, schema);
  return ok(await checkPracticeAnswer((await params).id, input.questionId, input.response));
});
