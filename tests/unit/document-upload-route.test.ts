import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), extract: vi.fn() }));
vi.mock("@backend/services/auth.service", () => ({ getCurrentUser: mocks.user }));
vi.mock("@backend/services/document.service", () => ({ extractStudyDocument: mocks.extract }));
import { POST } from "@/app/api/texts/extract/route";
import { AppError } from "@backend/lib/errors";
import { LIMITS } from "@shared/constants";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ userId: "user1" });
  mocks.extract.mockResolvedValue({ text: "Extracted notes" });
});
it("authenticates before extracting an uploaded file", async () => {
  const form = new FormData();
  form.append("file", new File(["test"], "notes.pdf"));
  const response = await POST(new Request("http://localhost/api/texts/extract", { method: "POST", body: form }), undefined);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, data: { text: "Extracted notes" } });
  expect(mocks.user.mock.invocationCallOrder[0]).toBeLessThan(mocks.extract.mock.invocationCallOrder[0]);
});
it("rejects unauthenticated uploads before extraction", async () => {
  mocks.user.mockRejectedValue(AppError.notFound("Session"));
  const response = await POST(new Request("http://localhost/api/texts/extract", { method: "POST" }), undefined);
  expect(response.status).toBe(404);
  expect(mocks.extract).not.toHaveBeenCalled();
});
it("rejects a missing file", async () => {
  const response = await POST(new Request("http://localhost/api/texts/extract", { method: "POST", body: new FormData() }), undefined);
  expect(response.status).toBe(400);
  expect(mocks.extract).not.toHaveBeenCalled();
});
it("bounds uploads without relying on Content-Length", async () => {
  const response = await POST(new Request("http://localhost/api/texts/extract", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=test" }, body: new Uint8Array(LIMITS.DOCUMENT_FILE_MAX_BYTES + 65537) }), undefined);
  expect(response.status).toBe(400);
  expect(mocks.extract).not.toHaveBeenCalled();
});
