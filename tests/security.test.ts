import { describe, it, expect } from "vitest";
import { detectPresentation } from "../src/lib/files";
import {
  submissionSchema,
  settingsSchema,
  csvCell,
  PDF,
} from "../src/lib/validation";
import { emailContent } from "../src/lib/email";
describe("Public submission validation", () => {
  it("accepts valid participant details without an account", () => {
    expect(
      submissionSchema.parse({
        team_name: "Team A",
        institution: "Institute",
        leader_name: "Leader",
        leader_email: "LEADER@example.com",
        project_title: "New project",
        abstract: "A sufficiently detailed project description for review.",
        confirmed: "on",
      }).leader_email,
    ).toBe("leader@example.com");
  });
  it("requires consent and meaningful project details", () => {
    expect(
      submissionSchema.safeParse({ leader_email: "not email" }).success,
    ).toBe(false);
  });
  it("detects PDF bytes without trusting a filename", async () => {
    expect(
      await detectPresentation(Buffer.from("%PDF-1.7\n1 0 obj\n%%EOF"), 1024),
    ).toBe(PDF);
  });
  it("rejects disguised, truncated and oversized files", async () => {
    for (const b of [
      Buffer.from("<html>not a pdf</html>"),
      Buffer.from("P"),
      Buffer.from("PK-not-a-zip"),
      Buffer.alloc(1025),
    ])
      await expect(detectPresentation(b, 1024)).rejects.toThrow();
  });
  it("rejects a PDF without its end marker", async () => {
    await expect(
      detectPresentation(Buffer.from("%PDF-1.7 invalid"), 1024),
    ).rejects.toThrow();
  });
});
describe("Private email projection", () => {
  it("never includes internal notes and escapes participant HTML", () => {
    const result = emailContent(
      {
        team_name: "<script>alert(1)</script>",
        project_title: "Project",
        reference_code: "FL-123",
        leader_name: "Leader",
      },
      {
        overall_feedback: "Useful feedback",
        strengths: "Strong design",
        improvements: "More validation",
        technical_suggestions: "",
        next_steps: "",
        recommendations: "",
        scores: { Clarity: 8 },
        ...{ internal_notes: "SECRET-NOTE" },
      },
    );
    expect(result.text).not.toContain("SECRET-NOTE");
    expect(result.html).not.toContain("SECRET-NOTE");
    expect(result.html).not.toContain("<script>");
    expect(result.html).toContain("&lt;script&gt;");
    expect(result.text).toContain("Clarity");
  });
  it("includes receipt and verification in confirmation", () => {
    expect(
      emailContent(
        {
          team_name: "Team",
          project_title: "Project",
          reference_code: "FL-ABC",
          leader_name: "Leader",
        },
        undefined,
        "https://example.com/verify#token",
      ).text,
    ).toContain("https://example.com/verify#token");
  });
});
describe("Admin inputs", () => {
  it("neutralizes spreadsheet formulas", () => {
    expect(csvCell("=CMD()")).toBe('"\'=CMD()"');
    expect(csvCell('a"b')).toBe('"a""b"');
  });
  it("rejects inverted and duplicate scoring ranges", () => {
    const base = {
      submission_deadline: null,
      review_deadline: null,
      scoring_enabled: true,
    };
    expect(
      settingsSchema.safeParse({
        ...base,
        rubric: [{ name: "Quality", min: 10, max: 1 }],
      }).success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({
        ...base,
        rubric: [
          { name: "Quality", min: 0, max: 10 },
          { name: "Quality", min: 0, max: 10 },
        ],
      }).success,
    ).toBe(false);
  });
});
