import { beforeEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ session: mocks.session }));
import { GET } from "../src/app/auth/callback/route";
beforeEach(() => {
  vi.resetAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-public-key";
  process.env.NEXT_PUBLIC_APP_URL = "invalid-url";
  mocks.session.mockResolvedValue({ auth: mocks });
});
it("exchanges an invite and redirects safely despite malformed APP_URL", async () => {
  mocks.verifyOtp.mockResolvedValue({ error: null });
  const r = await GET(
    new Request(
      "https://portal.example/auth/callback?token_hash=test&type=invite",
    ),
  );
  expect(r.headers.get("location")).toBe(
    "https://portal.example/judge/account",
  );
  expect(mocks.verifyOtp).toHaveBeenCalledWith({
    token_hash: "test",
    type: "invite",
  });
});
it("shows a configuration error before consuming a token when the public key is missing", async () => {
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const r = await GET(
    new Request(
      "https://portal.example/auth/callback?token_hash=test&type=invite",
    ),
  );
  expect(r.headers.get("location")).toContain("reason=configuration");
  expect(mocks.session).not.toHaveBeenCalled();
});
it("shows an actionable expired-link error", async () => {
  mocks.verifyOtp.mockResolvedValue({ error: { code: "otp_expired" } });
  const r = await GET(
    new Request(
      "https://portal.example/auth/callback?token_hash=test&type=invite",
    ),
  );
  expect(r.headers.get("location")).toBe(
    "https://portal.example/auth/error?reason=expired",
  );
});
it("handles service failures without leaking the invitation token", async () => {
  mocks.session.mockRejectedValue(new Error("unavailable"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const r = await GET(
    new Request(
      "https://portal.example/auth/callback?token_hash=private-token&type=invite",
    ),
  );
  expect(r.headers.get("location")).toBe(
    "https://portal.example/auth/error?reason=service",
  );
  expect(JSON.stringify(log.mock.calls)).not.toContain("private-token");
  log.mockRestore();
});
