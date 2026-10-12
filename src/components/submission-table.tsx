"use client";
import { useState } from "react";
import Link from "next/link";
import type { Submission, Feedback, Delivery } from "@/lib/types";
export function SubmissionTable({
  submissions,
  feedback,
  deliveries,
  role,
}: {
  submissions: Submission[];
  feedback: Feedback[];
  deliveries: Delivery[];
  role: string;
}) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all");
  const state = (id: string) =>
    feedback.some((f) => f.submission_id === id && f.status === "draft")
      ? "draft"
      : feedback.some((f) => f.submission_id === id && f.status === "published")
        ? "published"
        : "awaiting";
  const rows = submissions.filter(
    (s) =>
      (s.team_name + " " + s.project_title + " " + s.reference_code)
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "all" || state(s.id) === filter),
  );
  return (
    <>
      <div className="toolbar">
        <input
          aria-label="Search submissions"
          placeholder="Search teams, projects, or references…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Filter review status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All review statuses</option>
          <option value="awaiting">Awaiting review</option>
          <option value="draft">Draft feedback</option>
          <option value="published">Published feedback</option>
        </select>
      </div>
      <section className="card table-card">
        <div className="table-heading">
          <h2 style={{ margin: 0 }}>
            {role === "admin" ? "All submissions" : "Assigned to you"}{" "}
            <span className="muted" style={{ fontSize: 13, marginLeft: 8 }}>
              {rows.length}
            </span>
          </h2>
          <span className="muted" style={{ fontSize: 11 }}>
            PRIVATE REVIEW
          </span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Team / project</th>
                <th>Submitted</th>
                <th>Review status</th>
                <th>Email status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const delivery = deliveries.find(
                  (d) =>
                    d.submission_id === s.id && d.message_type === "feedback",
                );
                return (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.team_name}</strong>
                      <small>{s.project_title}</small>
                    </td>
                    <td>
                      {new Date(s.submitted_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        timeZone: "Asia/Kolkata",
                      })}
                      <small>{s.reference_code}</small>
                    </td>
                    <td>
                      <span className={`badge ${state(s.id)}`}>
                        {s.status === "submitted" ? state(s.id) : s.status}
                      </span>
                    </td>
                    <td>
                      {delivery ? (
                        <span className={`badge ${delivery.status}`}>
                          {delivery.status.replaceAll("_", " ")}
                        </span>
                      ) : (
                        <span className="muted">Not published</span>
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/${role}/submissions/${s.id}`}
                        style={{ color: "var(--lime)" }}
                      >
                        Open review ↗
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <div className="empty">
            <h3>
              {submissions.length
                ? "No matching submissions"
                : "A fresh start."}
            </h3>
            <p>
              {role === "admin"
                ? "Participant submissions will appear here."
                : "Your assigned projects will appear here when the administrator assigns them."}
            </p>
          </div>
        )}
      </section>
    </>
  );
}
