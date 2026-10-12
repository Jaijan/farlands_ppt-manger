import Link from "next/link";
import { notFound } from "next/navigation";
import { pageAuth } from "@/lib/page-auth";
import { checked } from "@/lib/db";
import { Shell } from "@/components/shell";
import { ActionForm } from "@/components/action-form";
import { SettingsForm } from "@/components/settings-form";
import { SubmissionTable } from "@/components/submission-table";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (
    !["submissions", "judges", "assignments", "feedback", "settings"].includes(
      section,
    )
  )
    notFound();
  const { db, profile } = await pageAuth("admin");
  const [sr, pr, ar, fr, dr, cfg, logs] = await Promise.all([
    db
      .from("submissions")
      .select("*")
      .order("submitted_at", { ascending: false }),
    db.from("profiles").select("*").eq("role", "judge"),
    db.from("judge_assignments").select("*").eq("status", "active"),
    db.from("feedback").select("*"),
    db
      .from("email_deliveries")
      .select("*")
      .order("created_at", { ascending: false }),
    db.from("settings").select("*").single(),
    db
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const submissions = checked(sr),
    judges = checked(pr),
    assignments = checked(ar),
    feedback = checked(fr),
    deliveries = checked(dr),
    settings = checked(cfg),
    audit = checked(logs);
  const title = {
    submissions: "Submissions",
    judges: "Your judging team",
    assignments: "Review assignments",
    feedback: "Feedback & email delivery",
    settings: "Event settings",
  }[section];
  return (
    <Shell profile={profile}>
      <div className="page-heading">
        <div>
          <div className="eyebrow">Event management</div>
          <h1 style={{ marginTop: 12 }}>{title}</h1>
        </div>
        {section === "submissions" && (
          <Link className="button secondary" href="/api/admin">
            Export CSV ↓
          </Link>
        )}
      </div>
      {section === "submissions" && (
        <SubmissionTable
          submissions={submissions}
          feedback={feedback}
          deliveries={deliveries}
          role="admin"
        />
      )}
      {section === "judges" && (
        <div className="split">
          <section className="card">
            <h2>Invite a judge</h2>
            <p className="muted">
              An email invitation lets your judge set their own password.
            </p>
            <ActionForm action="invite">
              <label htmlFor="full_name">Full name</label>
              <input id="full_name" name="full_name" required minLength={2} />
              <label htmlFor="judge-email">Designated email</label>
              <input id="judge-email" name="email" type="email" required />
              <button style={{ marginTop: 20 }}>Send invitation ↗</button>
            </ActionForm>
          </section>
          <div className="stack">
            {judges.map((j) => (
              <section className="card" key={j.id}>
                <h2>{j.full_name}</h2>
                <p className="muted">
                  {j.email} · {j.is_active ? "Active" : "Deactivated"}
                </p>
                <p>
                  {assignments.filter((a) => a.judge_id === j.id).length}{" "}
                  assigned ·{" "}
                  {
                    feedback.filter(
                      (f) => f.judge_id === j.id && f.status === "published",
                    ).length
                  }{" "}
                  published
                </p>
                <ActionForm action="reset" values={{ id: j.id }}>
                  <button className="secondary">Send password reset</button>
                </ActionForm>
                {j.is_active && (
                  <ActionForm
                    action="deactivate"
                    values={{ id: j.id }}
                    confirmation="Deactivate this judge? Access will be revoked immediately."
                  >
                    <button className="danger" style={{ marginTop: 12 }}>
                      Deactivate judge
                    </button>
                  </ActionForm>
                )}
              </section>
            ))}
            {!judges.length && (
              <div className="card empty">
                No judges yet. Invite your first reviewer.
              </div>
            )}
          </div>
        </div>
      )}
      {section === "assignments" && (
        <section className="card">
          <h2>Assign a dedicated reviewer</h2>
          <p className="muted">
            One active judge per submission. Reassigning immediately removes the
            previous judge’s access.
          </p>
          {submissions.length ? (
            <div className="stack">
              {submissions.map((s) => {
                const assignment = assignments.find(
                  (a) => a.submission_id === s.id,
                );
                return (
                  <div
                    key={s.id}
                    style={{
                      borderTop: "1px solid var(--line)",
                      paddingTop: 20,
                    }}
                  >
                    <h3>
                      {s.team_name} · {s.project_title}
                    </h3>
                    <ActionForm
                      action="assign"
                      values={{ submission_id: s.id }}
                      confirmation="Confirm this assignment? Any previous assignment will be revoked."
                    >
                      <label htmlFor={`judge-${s.id}`}>Assigned judge</label>
                      <select
                        id={`judge-${s.id}`}
                        name="judge_id"
                        defaultValue={assignment?.judge_id || ""}
                        required
                      >
                        <option value="" disabled>
                          Select a judge
                        </option>
                        {judges
                          .filter((j) => j.is_active)
                          .map((j) => (
                            <option value={j.id} key={j.id}>
                              {j.full_name}
                            </option>
                          ))}
                      </select>
                      <button
                        style={{ marginTop: 12 }}
                        disabled={!judges.some((j) => j.is_active)}
                      >
                        Save assignment
                      </button>
                    </ActionForm>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="empty">No submissions to assign yet.</p>
          )}
        </section>
      )}
      {section === "feedback" && (
        <div className="stack">
          <section className="card">
            <h2>Email delivery log</h2>
            <p className="muted">
              SMTP acceptance is recorded separately from confirmed delivery.
              Open a submission to inspect versions or retry an email.
            </p>
            {deliveries.map((d) => (
              <p key={d.id}>
                <Link href={`/admin/submissions/${d.submission_id}`}>
                  {submissions.find((s) => s.id === d.submission_id)?.team_name}{" "}
                  ↗
                </Link>{" "}
                · {d.message_type} ·{" "}
                <span className={`badge ${d.status}`}>
                  {d.status.replaceAll("_", " ")}
                </span>{" "}
                · {d.attempt_count} attempts
                {d.last_error && (
                  <span className="muted"> · {d.last_error}</span>
                )}
              </p>
            ))}
            {!deliveries.length && (
              <p className="empty">No email records yet.</p>
            )}
          </section>
          <section className="card">
            <h2>Recent administrative activity</h2>
            {audit.map((a) => (
              <p key={a.id} className="muted">
                {a.action} ·{" "}
                {new Date(a.created_at).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}{" "}
                IST
              </p>
            ))}
            {!audit.length && (
              <p className="muted">No administrative actions recorded.</p>
            )}
          </section>
        </div>
      )}
      {section === "settings" && (
        <div className="split">
          <SettingsForm settings={settings} />
          <section className="card">
            <h2>SMTP connection</h2>
            <p className="muted">
              SMTP credentials are managed through server environment variables.
              Send a test to your administrator email to check acceptance.
            </p>
            <ActionForm action="test-email">
              <button className="secondary">Send test email to me</button>
            </ActionForm>
            <h2 style={{ marginTop: 36 }}>Presentation uploads</h2>
            <p className="muted">
              Maximum: {process.env.MAX_UPLOAD_SIZE_MB || 25} MB. PDF and PPTX.
              Files and converted previews are stored in the private
              presentations bucket.
            </p>
          </section>
        </div>
      )}
    </Shell>
  );
}
