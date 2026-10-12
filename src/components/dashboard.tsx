import Link from "next/link";
import { pageAuth } from "@/lib/page-auth";
import { checked } from "@/lib/db";
import { Shell } from "./shell";
import { SubmissionTable } from "./submission-table";
export async function Dashboard({ role }: { role: "admin" | "judge" }) {
  const { db, profile } = await pageAuth(role);
  const [sr, fr, dr, ar, settingsResult] = await Promise.all([
    db
      .from("submissions")
      .select("*")
      .order("submitted_at", { ascending: false }),
    db.from("feedback").select("*"),
    db
      .from("email_deliveries")
      .select("*")
      .order("created_at", { ascending: false }),
    db.from("judge_assignments").select("*").eq("status", "active"),
    db.from("settings").select("*").single(),
  ]);
  const submissions = checked(sr),
    feedback = checked(fr),
    deliveries = checked(dr),
    assignments = checked(ar),
    settings = checked(settingsResult);
  const published = new Set(
      feedback
        .filter((f) => f.status === "published")
        .map((f) => f.submission_id),
    ).size,
    drafts = feedback.filter((f) => f.status === "draft").length;
  const stats =
    role === "admin"
      ? [
          [
            "Total submissions",
            submissions.length,
            "Received through the portal",
          ],
          [
            "Awaiting assignment",
            submissions.filter(
              (s) => !assignments.some((a) => a.submission_id === s.id),
            ).length,
            "Ready for a fresh perspective",
          ],
          ["Published reviews", published, "Feedback shared with teams"],
          [
            "Email issues",
            deliveries.filter((d) => ["failed", "uncertain"].includes(d.status))
              .length,
            "Require your attention",
          ],
        ]
      : [
          ["Assigned teams", submissions.length, "Your review collection"],
          [
            "Awaiting review",
            submissions.filter(
              (s) => !feedback.some((f) => f.submission_id === s.id),
            ).length,
            "Ready when you are",
          ],
          ["Draft feedback", drafts, "Pick up where you left off"],
          ["Published reviews", published, "Ideas moved forward"],
        ];
  return (
    <Shell profile={profile}>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {role === "admin"
              ? "Behind every great event"
              : "A fresh perspective starts with you"}
          </div>
          <h1 style={{ marginTop: 12 }}>
            {role === "admin"
              ? "Event overview"
              : `Welcome back, ${profile.full_name.split(" ")[0]}.`}
          </h1>
          <p className="muted">
            {role === "admin"
              ? "Manage submissions, support your judges, and keep feedback moving."
              : "Explore ideas. Share your perspective. Help teams take their next step."}
          </p>
        </div>
        {role === "admin" && (
          <Link className="button secondary" href="/api/admin">
            Export submissions ↓
          </Link>
        )}
      </div>
      {settings.review_deadline && (
        <div className="notice">
          Review deadline:{" "}
          {new Date(settings.review_deadline).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          })}{" "}
          IST
          {new Date(settings.review_deadline) < new Date()
            ? " · Deadline has passed."
            : ""}
        </div>
      )}
      <div className="stats">
        {stats.map(([title, count, note]) => (
          <section className="card stat" key={String(title)}>
            <span>{title}</span>
            <strong>{count}</strong>
            <span>{note}</span>
          </section>
        ))}
      </div>
      <SubmissionTable
        submissions={submissions}
        feedback={feedback}
        deliveries={deliveries}
        role={role}
      />
    </Shell>
  );
}
