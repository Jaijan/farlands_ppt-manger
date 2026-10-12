import { beforeEach, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}));
vi.mock("nodemailer", () => ({
  default: { createTransport: mock.createTransport },
}));
import { transport, sender, emailContent } from "../src/lib/email";
beforeEach(() => {
  vi.resetAllMocks();
  process.env.SMTP_HOST = "smtp.example.org";
  process.env.SMTP_PORT = "587";
  process.env.SMTP_FROM_EMAIL = "event@example.org";
  mock.createTransport.mockReturnValue({ sendMail: mock.sendMail });
});
it("uses SMTP with mandatory STARTTLS and sends a confirmation with text and HTML", async () => {
  mock.sendMail.mockResolvedValue({ accepted: ["team@example.org"] });
  const message = emailContent(
    {
      team_name: "Team",
      project_title: "Project",
      leader_name: "Leader",
      reference_code: "FL-TEST",
    },
    undefined,
    "https://example.org/verify#token",
  );
  await transport().sendMail({
    from: sender(),
    to: "team@example.org",
    ...message,
  });
  expect(mock.createTransport).toHaveBeenCalledWith(
    expect.objectContaining({
      host: "smtp.example.org",
      port: 587,
      secure: false,
      requireTLS: true,
    }),
  );
  expect(mock.sendMail).toHaveBeenCalledWith(
    expect.objectContaining({
      to: "team@example.org",
      text: expect.stringContaining("FL-TEST"),
      html: expect.stringContaining("FARLANDS"),
    }),
  );
});
it("uses implicit TLS for port 465", () => {
  process.env.SMTP_PORT = "465";
  transport();
  expect(mock.createTransport).toHaveBeenCalledWith(
    expect.objectContaining({ secure: true, port: 465 }),
  );
});
it("propagates SMTP rejection rather than claiming successful delivery", async () => {
  mock.sendMail.mockRejectedValue(new Error("Rejected"));
  await expect(
    transport().sendMail({ to: "team@example.org", text: "Test" }),
  ).rejects.toThrow("Rejected");
});
