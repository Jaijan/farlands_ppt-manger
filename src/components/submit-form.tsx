"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function SubmitForm({
  max,
  token,
}: {
  max: number;
  token: string | null;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const r = await fetch("/api/submit", {
              method: "POST",
              body: new FormData(e.currentTarget),
            }),
            body = await r.json();
          if (!r.ok) throw new Error(body.error);
          router.push(
            `/submission-success?reference=${encodeURIComponent(body.reference)}`,
          );
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Submission failed. Please retry.",
          );
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>
        <input type="hidden" name="submission_token" value={token || ""} />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "-10000px",
            width: 1,
            height: 1,
            overflow: "hidden",
          }}
        >
          <label htmlFor="website">Leave this field empty</label>
          <input
            id="website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>
        <div className="eyebrow">01 / Your team</div>
        <div className="form-grid">
          {[
            ["team_name", "Team name", true],
            ["team_id", "Registration / team ID", false],
            ["institution", "College or institution", true],
            ["leader_name", "Team leader’s name", true],
            ["leader_email", "Team leader’s email", true],
            ["contact_number", "Contact number (optional)", false],
          ].map(([name, label, required]) => (
            <div key={String(name)}>
              <label htmlFor={String(name)}>{label}</label>
              <input
                id={String(name)}
                name={String(name)}
                type={
                  name === "leader_email"
                    ? "email"
                    : name === "contact_number"
                      ? "tel"
                      : "text"
                }
                required={Boolean(required)}
                maxLength={200}
              />
            </div>
          ))}
        </div>
        <div className="eyebrow" style={{ marginTop: 36 }}>
          02 / Your project
        </div>
        <label htmlFor="project_title">Project title</label>
        <input
          id="project_title"
          name="project_title"
          required
          maxLength={200}
        />
        <label htmlFor="abstract">Project abstract</label>
        <textarea
          id="abstract"
          name="abstract"
          required
          minLength={30}
          maxLength={5000}
          placeholder="What are you building, who is it for, and what makes it different?"
        />
        <label htmlFor="presentation">
          Presentation · PDF or PPTX · up to {max} MB
        </label>
        <input
          id="presentation"
          type="file"
          name="presentation"
          accept=".pdf,.pptx"
          required
        />
        <p className="muted">
          Your file stays private. PowerPoint animations, media, and unusual
          fonts may not be preserved in the review preview.
        </p>
        <label>
          <input type="checkbox" name="confirmed" required />I confirm these
          details are correct and agree to receive submission and review emails.
        </label>
        {!token && (
          <p className="notice">
            Submissions will open once the event administrator completes service
            configuration.
          </p>
        )}
        <button style={{ marginTop: 24 }} disabled={!token}>
          {busy ? "Uploading presentation…" : "Submit presentation ↗"}
        </button>
      </fieldset>
      <p role="alert" className="form-message">
        {error}
      </p>
    </form>
  );
}
