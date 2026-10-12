import { z } from "zod";
const text = z.string().trim().min(2).max(200);
export const submissionSchema = z.object({
  team_name: text,
  team_id: z.string().trim().max(100).optional(),
  institution: text,
  leader_name: text,
  leader_email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  contact_number: z.string().max(30).optional(),
  project_title: text,
  abstract: z.string().trim().min(30).max(5000),
  confirmed: z.literal("on"),
});
export const feedbackSchema = z.object({
  overall_feedback: z.string().max(10000),
  strengths: z.string().max(10000),
  improvements: z.string().max(10000),
  technical_suggestions: z.string().max(10000),
  next_steps: z.string().max(10000),
  recommendations: z.string().max(10000),
  internal_notes: z.string().max(10000),
  scores: z.record(z.string().max(100), z.number().finite()),
  request_id: z.uuid(),
});
export const settingsSchema = z
  .object({
    submission_deadline: z.iso.datetime().nullable(),
    review_deadline: z.iso.datetime().nullable(),
    scoring_enabled: z.boolean(),
    rubric: z
      .array(
        z
          .object({
            name: text,
            min: z.number().finite(),
            max: z.number().finite(),
          })
          .refine((x) => x.max > x.min),
      )
      .max(20),
  })
  .refine((x) => !x.scoring_enabled || x.rubric.length > 0)
  .refine((x) => new Set(x.rubric.map((c) => c.name)).size === x.rubric.length);
export const PDF = "application/pdf";
export const PPTX =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
export function csvCell(value: unknown) {
  const s = String(value ?? "");
  return (
    '"' + (/^[=+@\-\t\r]/.test(s) ? "'" : "") + s.replaceAll('"', '""') + '"'
  );
}
