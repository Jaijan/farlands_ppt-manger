import { beforeEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ session: mocks.session, checked: vi.fn() }));
import { POST } from "../src/app/api/auth/route";
function request(origin = "https://portal.example") {
  return new Request("https://portal.example/api/auth", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reset", email: "admin@example.org" }),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "https://portal.example";
  mocks.session.mockResolvedValue({
    auth: { resetPasswordForEmail: mocks.resetPasswordForEmail },
  });
});
it("explains missing app URL without making an Auth request", async () => {
  delete process.env.NEXT_PUBLIC_APP_URL;
  const r = await POST(request());
  expect(r.status).toBe(503);
  expect((await r.json()).error).toContain("NEXT_PUBLIC_APP_URL");
  expect(mocks.session).not.toHaveBeenCalled();
});
it("keeps cross-origin requests blocked", async () => {
  const r = await POST(request("https://attacker.example"));
  expect(r.status).toBe(403);
  expect(mocks.session).not.toHaveBeenCalled();
});
it("reports reset delivery errors instead of falsely reporting success", async () => {
  mocks.resetPasswordForEmail.mockResolvedValue({
    error: { status: 500, code: "unexpected_failure" },
  });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const r = await POST(request());
  expect(r.status).toBe(502);
  expect((await r.json()).error).toContain("Supabase Auth logs");
  log.mockRestore();
});
it("requests the correct callback and returns a non-enumerating success", async () => {
  mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  const r = await POST(request());
  expect(r.status).toBe(200);
  expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(
    "admin@example.org",
    { redirectTo: "https://portal.example/auth/callback" },
  );
});
