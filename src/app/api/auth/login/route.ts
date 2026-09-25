import { handle, ok, parseBody } from "@backend/lib/api";
import { loginUser } from "@backend/services/auth.service";
import { loginSchema } from "@backend/validation/schemas";
export const POST = handle(async (req) => ok(await loginUser(await parseBody(req, loginSchema))));
