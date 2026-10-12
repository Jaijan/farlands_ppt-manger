import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  query: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  session: async () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.query }) }),
    }),
  }),
  service: () => ({ rpc: mocks.rpc }),
  checked: (r: { data: unknown; error: unknown }) => {
    if (r.error) throw new Error("Database failed");
    return r.data;
  },
}));
import { authorize, submissionAccess } from "../src/lib/auth";
import { POST } from "../src/app/api/submissions/[id]/route";
const body = {
  action: "draft",
  overall_feedback: "A detailed constructive review",
  strengths: "Strong design choices",
  improvements: "Needs further validation",
  technical_suggestions: "",
  next_steps: "",
  recommendations: "",
  internal_notes: "Private",
  scores: {},
  request_id: "00000000-0000-4000-8000-000000000001",
};
beforeEach(() => {
  vi.resetAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "https://farlands.example";
  mocks.getUser.mockResolvedValue({ data: { user: { id: "judge" } } });
});
describe("Server authorization", () => {
  it("rejects anonymous access even without frontend guards", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    await expect(authorize()).rejects.toMatchObject({ status: 401 });
  });
  it("rejects deactivated judges immediately", async () => {
    mocks.query.mockResolvedValue({
      data: { role: "judge", is_active: false },
    });
    await expect(authorize()).rejects.toMatchObject({ status: 403 });
  });
  it("prevents a judge from using admin operations", async () => {
    mocks.query.mockResolvedValue({ data: { role: "judge", is_active: true } });
    await expect(authorize("admin")).rejects.toMatchObject({ status: 403 });
  });
  it("denies an unassigned submission hidden by RLS", async () => {
    mocks.query
      .mockResolvedValueOnce({ data: { role: "judge", is_active: true } })
      .mockResolvedValueOnce({ data: null });
    await expect(submissionAccess("other")).rejects.toMatchObject({
      status: 404,
    });
  });
  it("rejects cross-origin mutations", async () => {
    const r = await POST(
      new Request("https://farlands.example/api/submissions/id", {
        method: "POST",
        headers: { origin: "https://evil.example" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: "id" }) },
    );
    expect(r.status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("saves draft with publish=false; no email-side operation", async () => {
    mocks.query
      .mockResolvedValueOnce({
        data: { id: "judge", role: "judge", is_active: true },
      })
      .mockResolvedValueOnce({ data: { id: "id", email_verified_at: "now" } });
    mocks.rpc.mockResolvedValue({ data: "draft-id" });
    const r = await POST(
      new Request("https://farlands.example/api/submissions/id", {
        method: "POST",
        headers: { origin: "https://farlands.example" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: "id" }) },
    );
    expect(r.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "save_review",
      expect.objectContaining({ publish: false }),
    );
  });
  it("refuses publication to an unverified participant email", async () => {
    mocks.query
      .mockResolvedValueOnce({
        data: { id: "judge", role: "judge", is_active: true },
      })
      .mockResolvedValueOnce({ data: { id: "id", email_verified_at: null } });
    const r = await POST(
      new Request("https://farlands.example/api/submissions/id", {
        method: "POST",
        headers: { origin: "https://farlands.example" },
        body: JSON.stringify({ ...body, action: "publish" }),
      }),
      { params: Promise.resolve({ id: "id" }) },
    );
    expect(r.status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
