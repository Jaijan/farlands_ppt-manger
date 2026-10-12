"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Feedback, Submission, Rubric } from "@/lib/types";
import { emailContent } from "@/lib/email-preview";
const fields = [
  ["overall_feedback", "Overall feedback", true],
  ["strengths", "Project strengths", true],
  ["improvements", "Areas for improvement", true],
  ["technical_suggestions", "Technical suggestions", false],
  ["next_steps", "Practical next steps", false],
  ["recommendations", "Additional recommendations", false],
  ["internal_notes", "Internal notes · never emailed", false],
] as const;
export function ReviewForm({
  submission,
  draft,
  rubric,
}: {
  submission: Submission;
  draft?: Feedback;
  rubric: Rubric[];
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
      Object.fromEntries(fields.map(([key]) => [key, draft?.[key] || ""])),
    ),
    [scores, setScores] = useState<Record<string, number>>(draft?.scores || {}),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [modal, setModal] = useState<"preview" | "confirm" | null>(null),
    [dirty, setDirty] = useState(false);
  const key = useRef<string>("");
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  useEffect(() => {
    if (modal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);
  async function save(action: "draft" | "publish") {
    setBusy(true);
    setMessage("");
    if (!key.current) key.current = crypto.randomUUID();
    try {
      const r = await fetch(`/api/submissions/${submission.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...values,
            scores,
            request_id: key.current,
            action,
          }),
        }),
        body = await r.json();
      if (!r.ok) throw new Error(body.error);
      setDirty(false);
      setMessage(
        action === "draft"
          ? "Draft saved. No email has been sent."
          : "Feedback published. Email is queued for SMTP processing.",
      );
      if (action === "publish") {
        key.current = "";
        setModal(null);
      }
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please retry.");
    } finally {
      setBusy(false);
    }
  }
  const preview = emailContent(submission, { ...values, scores });
  return (
    <section className="card review-form">
      <div className="eyebrow">Your perspective matters</div>
      <h2 style={{ marginTop: 12 }}>Project feedback</h2>
      <p className="muted">Be specific, constructive, and actionable.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save("draft");
        }}
      >
        <fieldset disabled={busy}>
          {fields.map(([name, label, required]) => (
            <div key={name}>
              <label htmlFor={name}>
                {label}
                {required ? " *" : ""}
              </label>
              <textarea
                id={name}
                maxLength={10000}
                value={values[name]}
                onChange={(e) => {
                  setValues((v) => ({ ...v, [name]: e.target.value }));
                  setDirty(true);
                }}
              />
            </div>
          ))}
          {rubric.length > 0 && (
            <div>
              <h3 style={{ marginTop: 24 }}>Scoring rubric</h3>
              {rubric.map((c) => (
                <div key={c.name}>
                  <label htmlFor={`score-${c.name}`}>
                    {c.name} ({c.min}–{c.max})
                  </label>
                  <input
                    id={`score-${c.name}`}
                    type="number"
                    min={c.min}
                    max={c.max}
                    step="any"
                    value={scores[c.name] ?? ""}
                    onChange={(e) => {
                      setScores((v) => {
                        const n = { ...v };
                        if (e.target.value === "") delete n[c.name];
                        else n[c.name] = Number(e.target.value);
                        return n;
                      });
                      setDirty(true);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
          <div className="review-actions">
            <button className="secondary" type="submit">
              Save draft
            </button>
            <button
              className="secondary"
              type="button"
              onClick={() => setModal("preview")}
            >
              Preview email
            </button>
            <button
              type="button"
              disabled={!submission.email_verified_at}
              onClick={() => setModal("confirm")}
            >
              Publish feedback ↗
            </button>
          </div>
          {!submission.email_verified_at && (
            <p className="muted">
              Publication is available after the participant verifies their
              email.
            </p>
          )}
        </fieldset>
      </form>
      <p role="status" className="form-message">
        {busy ? "Saving…" : message}
      </p>
      <dialog
        ref={dialog}
        onCancel={() => setModal(null)}
        style={{
          background: "var(--panel)",
          color: "var(--text)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: 28,
          maxWidth: 660,
          width: "90%",
        }}
      >
        {modal === "preview" ? (
          <>
            <h2>Participant email preview</h2>
            <p className="muted">To: {submission.leader_email}</p>
            <pre style={{ whiteSpace: "pre-wrap", font: "14px/1.8 Arial" }}>
              {preview}
            </pre>
            <button onClick={() => setModal(null)}>Close preview</button>
          </>
        ) : (
          <>
            <h2>Publish this feedback?</h2>
            <p>
              An immutable feedback version will be saved and emailed to{" "}
              <strong>{submission.leader_email}</strong>. Internal notes are
              excluded.
            </p>
            <p className="muted">
              Required: overall feedback (20 characters), strengths and
              improvements (10 characters each), and all enabled scores.
            </p>
            <div className="review-actions">
              <button disabled={busy} onClick={() => void save("publish")}>
                Confirm & publish
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                Keep editing
              </button>
            </div>
            <p role="alert">{message}</p>
          </>
        )}
      </dialog>
    </section>
  );
}
