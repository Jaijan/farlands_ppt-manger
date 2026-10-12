import { beforeEach, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({
  rpc: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  service: () => ({
    rpc: mock.rpc,
    storage: { from: () => ({ upload: mock.upload, remove: mock.remove }) },
  }),
  checked: (r: { data: unknown; error: unknown }) => {
    if (r.error) throw Error("Database failure");
    return r.data;
  },
}));
import { createSubmissionToken } from "../src/lib/submission-guard";
import { POST } from "../src/app/api/submit/route";
beforeEach(() => {
  vi.resetAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "https://farlands.example";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-signing-key";
  mock.rpc.mockResolvedValue({ data: true, error: null });
  mock.upload.mockResolvedValue({ data: { path: "private" }, error: null });
  mock.remove.mockResolvedValue({ error: null });
});
function request(file: Blob, overrides: Record<string, string> = {}) {
  const form = new FormData();
  for (const [k, v] of Object.entries({
    team_name: "Test team",
    institution: "Test college",
    leader_name: "Team leader",
    leader_email: "leader@example.org",
    project_title: "Real project",
    abstract: "A detailed project abstract for presentation review.",
    confirmed: "on",
    submission_token: createSubmissionToken(Date.now() - 3000),
    website: "",
    ...overrides,
  }))
    form.set(k, v);
  form.set("presentation", file, "deck.pdf");
  return new Request("https://farlands.example/api/submit", {
    method: "POST",
    headers: { origin: "https://farlands.example" },
    body: form,
  });
}
it("accepts a public PDF, writes private storage, and atomically registers confirmation", async () => {
  const result = await POST(request(new Blob(["%PDF-1.7\n%%EOF"])));
  expect(result.status).toBe(201);
  expect(mock.upload).toHaveBeenCalledOnce();
  expect(mock.rpc).toHaveBeenCalledWith(
    "register_submission",
    expect.objectContaining({
      body: expect.objectContaining({
        leader_email: "leader@example.org",
        preview_status: "ready",
      }),
    }),
  );
  expect(await result.json()).toEqual({
    reference: expect.stringMatching(/^FL-[A-F0-9]{12}$/),
  });
});
it("rejects an executable renamed to PDF before writing storage", async () => {
  const result = await POST(request(new Blob(["MZ executable content"])));
  expect(result.status).toBe(400);
  expect(mock.upload).not.toHaveBeenCalled();
});
it("cleans up storage if the transactional registration fails", async () => {
  mock.rpc
    .mockResolvedValueOnce({ data: true, error: null })
    .mockResolvedValueOnce({ error: { message: "duplicate" } });
  const result = await POST(request(new Blob(["%PDF-1.7\n%%EOF"])));
  expect(result.status).toBe(409);
  expect(mock.remove).toHaveBeenCalledOnce();
});
it("rejects forged form tokens without uploading", async () => {
  const result = await POST(
    request(new Blob(["%PDF-1.7\n%%EOF"]), { submission_token: "forged" }),
  );
  expect(result.status).toBe(400);
  expect(mock.upload).not.toHaveBeenCalled();
});
it("rejects honeypot entries before writing storage", async () => {
  const result = await POST(
    request(new Blob(["%PDF-1.7\n%%EOF"]), { website: "https://spam.example" }),
  );
  expect(result.status).toBe(400);
  expect(mock.upload).not.toHaveBeenCalled();
});
it("retains the durable email rate limit", async () => {
  mock.rpc.mockResolvedValueOnce({ data: false, error: null });
  const result = await POST(request(new Blob(["%PDF-1.7\n%%EOF"])));
  expect(result.status).toBe(429);
  expect(mock.upload).not.toHaveBeenCalled();
});
