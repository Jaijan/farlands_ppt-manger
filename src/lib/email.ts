import nodemailer from "nodemailer";
export type EmailSubmission = {
  team_name: string;
  project_title: string;
  reference_code: string;
  leader_name: string;
};
export type PublicFeedback = {
  overall_feedback: string;
  strengths: string;
  improvements: string;
  technical_suggestions: string;
  next_steps: string;
  recommendations: string;
  scores: Record<string, number>;
};
export function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function emailContent(
  s: EmailSubmission,
  f?: PublicFeedback,
  verifyUrl?: string,
) {
  const sections = f
    ? {
        "Overall feedback": f.overall_feedback,
        Strengths: f.strengths,
        "Areas for improvement": f.improvements,
        "Technical suggestions": f.technical_suggestions,
        "Practical next steps": f.next_steps,
        "Additional recommendations": f.recommendations,
        ...Object.fromEntries(
          Object.entries(f.scores || {}).map(([k, v]) => [
            `Score: ${k}`,
            String(v),
          ]),
        ),
      }
    : {
        "Presentation received": `We have received your presentation. ${verifyUrl ? "Verify your email to receive private feedback: " + verifyUrl : "Email verification instructions will follow."}`,
      };
  const text = `VISHWAKARMA: FARLANDS\nHello ${s.leader_name},\n${s.team_name} · ${s.project_title}\nReference: ${s.reference_code}\n\n${Object.entries(
    sections,
  )
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}\n${v}`)
    .join("\n\n")}\n\nThe FARLANDS judging team`;
  return {
    subject: `FARLANDS · ${f ? "Your project feedback" : "Presentation received"} · ${s.reference_code}`,
    text,
    html: `<div style="background:#10151d;color:#ecf1f7;padding:32px;font:16px/1.7 Arial,sans-serif;max-width:640px;margin:auto"><h2 style="color:#c1ed93">FARLANDS / REVIEW</h2><p>Hello ${escapeHtml(s.leader_name)},</p><h3>${escapeHtml(s.project_title)}</h3><p>${escapeHtml(s.team_name)} · ${escapeHtml(s.reference_code)}</p>${Object.entries(
      sections,
    )
      .filter(([, v]) => v)
      .map(
        ([k, v]) =>
          `<h3>${escapeHtml(k)}</h3><p style="white-space:pre-wrap">${escapeHtml(v)}</p>`,
      )
      .join(
        "",
      )}${verifyUrl ? `<p><a href="${escapeHtml(verifyUrl)}" style="display:inline-block;background:#c1ed93;color:#172111;padding:12px 20px;border-radius:6px;text-decoration:none">Verify email address</a></p>` : ""}<p>The FARLANDS judging team</p></div>`,
  };
}
export function transport() {
  const port = Number(process.env.SMTP_PORT || 587);
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM_EMAIL)
    throw new Error("SMTP not configured");
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 15000,
    socketTimeout: 30000,
  });
}
export function sender() {
  return {
    name: process.env.SMTP_FROM_NAME || "VISHWAKARMA FARLANDS",
    address: process.env.SMTP_FROM_EMAIL!,
  };
}
