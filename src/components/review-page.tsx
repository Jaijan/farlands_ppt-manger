import Link from "next/link";
import { notFound } from "next/navigation";
import { pageAuth } from "@/lib/page-auth";
import { checked } from "@/lib/db";
import { Shell } from "./shell";
import { PdfViewer } from "./pdf-viewer";
import { ReviewForm } from "./review-form";
import { ActionForm } from "./action-form";
import type { Feedback, Delivery } from "@/lib/types";
export async function ReviewPage({
  id,
  role,
}: {
  id: string;
  role: "admin" | "judge";
}) {
  const { db, profile } = await pageAuth(role);
  const submission = checked(
    await db.from("submissions").select("*").eq("id", id).maybeSingle(),
  );
  if (!submission) notFound();
  const [fr, dr, sr] = await Promise.all([
    db
      .from("feedback")
      .select("*")
      .eq("submission_id", id)
      .order("version_number", { ascending: false }),
    db
      .from("email_deliveries")
      .select("*")
      .eq("submission_id", id)
      .order("created_at", { ascending: false }),
    db.from("settings").select("*").single(),
  ]);
  const feedback = checked(fr) as Feedback[],
    deliveries = checked(dr) as Delivery[],
    settings = checked(sr);
  return (
    <Shell profile={profile}>
      <Link className="muted" href={`/${role}/dashboard`}>
        ← Back to dashboard
      </Link>
      <div className="page-heading" style={{ marginTop: 24 }}>
        <div>
          <div className="eyebrow">
            {submission.reference_code} / {submission.team_name}
          </div>
          <h1 style={{ marginTop: 12 }}>{submission.project_title}</h1>
          <p className="muted">
            {submission.institution} · {submission.leader_name}
          </p>
        </div>
        <span className="badge">{submission.status}</span>
      </div>
      <div className="review-grid">
        <div className="stack">
          <PdfViewer id={id} status={submission.preview_status} />
          <section className="card">
            <h2>About the project</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>{submission.abstract}</p>
            <p className="muted">
              {submission.leader_email} ·{" "}
              {submission.email_verified_at
                ? "Email verified"
                : "Verification pending"}
            </p>
            {role === "admin" && (
              <>
                <p className="muted">
                  Contact: {submission.contact_number || "Not provided"}
                </p>
                <ActionForm
                  action="status"
                  values={{ id }}
                  confirmation="Change this submission’s status?"
                >
                  <label htmlFor="submission-status">Submission status</label>
                  <select
                    id="submission-status"
                    name="status"
                    defaultValue={submission.status}
                  >
                    <option value="submitted">Open / submitted</option>
                    <option value="withdrawn">Withdrawn</option>
                    <option value="disqualified">Disqualified</option>
                  </select>
                  <button className="secondary" style={{ marginTop: 12 }}>
                    Update status
                  </button>
                </ActionForm>
              </>
            )}
          </section>
          <section className="card">
            <h2>Email activity</h2>
            {!deliveries.length && (
              <p className="muted">No email activity yet.</p>
            )}
            {deliveries.map((d) => (
              <div
                key={d.id}
                style={{
                  borderTop: "1px solid var(--line)",
                  padding: "16px 0",
                }}
              >
                <p>
                  {d.message_type}{" "}
                  <span className={`badge ${d.status}`}>
                    {d.status.replaceAll("_", " ")}
                  </span>
                </p>
                <p className="muted">
                  Attempts: {d.attempt_count}
                  {d.status === "smtp_accepted"
                    ? " · Accepted by SMTP; delivery is not independently confirmed."
                    : ""}
                </p>
                {d.last_error && <p>{d.last_error}</p>}
                {["failed", "uncertain"].includes(d.status) && (
                  <ActionForm
                    endpoint={`/api/submissions/${id}`}
                    action="retry-email"
                    values={{ delivery_id: d.id }}
                    confirmation="Retry this email? For uncertain sends, check provider logs first to avoid a duplicate email."
                  >
                    <button className="secondary">Retry email</button>
                  </ActionForm>
                )}
              </div>
            ))}
          </section>
        </div>
        <div className="stack">
          {role === "judge" && submission.status === "submitted" && (
            <ReviewForm
              submission={submission}
              draft={feedback.find((f) => f.status === "draft")}
              rubric={settings.scoring_enabled ? settings.rubric : []}
            />
          )}
          <section className="card">
            <h2>
              {role === "admin" ? "Feedback oversight" : "Publication history"}
            </h2>
            {feedback
              .filter((f) => role === "admin" || f.status === "published")
              .map((f) => (
                <details
                  key={f.id}
                  style={{
                    padding: "15px 0",
                    borderTop: "1px solid var(--line)",
                  }}
                >
                  <summary>
                    Version {f.version_number} · {f.status}
                    {f.published_at
                      ? ` · ${new Date(f.published_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}`
                      : ""}
                  </summary>
                  {Object.entries({
                    Overall: f.overall_feedback,
                    Strengths: f.strengths,
                    Improvements: f.improvements,
                    "Technical suggestions": f.technical_suggestions,
                    "Next steps": f.next_steps,
                    Recommendations: f.recommendations,
                    "Internal notes (private)": f.internal_notes,
                  }).map(
                    ([k, v]) =>
                      v && (
                        <div key={k}>
                          <h3 style={{ marginTop: 20 }}>{k}</h3>
                          <p style={{ whiteSpace: "pre-wrap" }}>{v}</p>
                        </div>
                      ),
                  )}
                  {Object.entries(f.scores).map(([k, v]) => (
                    <p key={k}>
                      {k}: {v}
                    </p>
                  ))}
                </details>
              ))}
            {!feedback.length && (
              <p className="muted">
                Feedback versions will appear here. Published versions are
                preserved.
              </p>
            )}
          </section>
        </div>
      </div>
    </Shell>
  );
}
