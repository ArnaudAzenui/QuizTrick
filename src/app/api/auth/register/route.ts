import { handle, ok, parseBody } from "@backend/lib/api";
import { registerUser } from "@backend/services/auth.service";
import { registerSchema } from "@backend/validation/schemas";
export const POST = handle(async (req) => ok(await registerUser(await parseBody(req, registerSchema)), 201));
