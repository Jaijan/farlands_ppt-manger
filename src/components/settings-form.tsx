"use client";
import { useState } from "react";
import type { Rubric } from "@/lib/types";
export function SettingsForm({
  settings,
}: {
  settings: {
    submission_deadline: string | null;
    review_deadline: string | null;
    scoring_enabled: boolean;
    rubric: Rubric[];
  };
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [rubric, setRubric] = useState<Rubric[]>(settings.rubric);
  const localTime = (value: string | null) =>
    value
      ? new Date(
          new Date(value).getTime() -
            new Date(value).getTimezoneOffset() * 60000,
        )
          .toISOString()
          .slice(0, 16)
      : "";
  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const f = new FormData(e.currentTarget);
          const body = {
            submission_deadline: f.get("submission_deadline")
              ? new Date(String(f.get("submission_deadline"))).toISOString()
              : null,
            review_deadline: f.get("review_deadline")
              ? new Date(String(f.get("review_deadline"))).toISOString()
              : null,
            scoring_enabled: f.get("scoring_enabled") === "on",
            rubric,
          };
          const r = await fetch("/api/admin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "settings", settings: body }),
          });
          const data = await r.json();
          if (!r.ok) throw new Error(data.error);
          setMessage("Event settings saved.");
        } catch (e) {
          setMessage(e instanceof Error ? e.message : "Invalid settings.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>
        <h2>Deadlines & scoring</h2>
        <p className="muted">
          Deadlines use your device’s local timezone. Leave blank for no
          deadline.
        </p>
        <label htmlFor="submission_deadline">Submission deadline</label>
        <input
          id="submission_deadline"
          name="submission_deadline"
          type="datetime-local"
          defaultValue={localTime(settings.submission_deadline)}
        />
        <label htmlFor="review_deadline">Review deadline</label>
        <input
          id="review_deadline"
          name="review_deadline"
          type="datetime-local"
          defaultValue={localTime(settings.review_deadline)}
        />
        <label>
          <input
            name="scoring_enabled"
            type="checkbox"
            defaultChecked={settings.scoring_enabled}
          />
          Enable structured scoring
        </label>
        <h3 style={{ marginTop: 24 }}>Scoring criteria</h3>
        {rubric.map((criterion, index) => (
          <div className="card" style={{ marginBottom: 12 }} key={index}>
            <label htmlFor={`criterion-${index}`}>Criterion name</label>
            <input
              id={`criterion-${index}`}
              required
              value={criterion.name}
              onChange={(e) =>
                setRubric((rows) =>
                  rows.map((r, i) =>
                    i === index ? { ...r, name: e.target.value } : r,
                  ),
                )
              }
            />
            <div className="form-grid">
              {(["min", "max"] as const).map((k) => (
                <div key={k}>
                  <label htmlFor={`${k}-${index}`}>
                    {k === "min" ? "Minimum" : "Maximum"}
                  </label>
                  <input
                    id={`${k}-${index}`}
                    type="number"
                    required
                    value={criterion[k]}
                    onChange={(e) =>
                      setRubric((rows) =>
                        rows.map((r, i) =>
                          i === index
                            ? { ...r, [k]: Number(e.target.value) }
                            : r,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              className="secondary"
              style={{ marginTop: 12 }}
              onClick={() =>
                setRubric((rows) => rows.filter((_, i) => i !== index))
              }
            >
              Remove criterion
            </button>
          </div>
        ))}
        <button
          type="button"
          className="secondary"
          disabled={rubric.length >= 20}
          onClick={() =>
            setRubric((rows) => [...rows, { name: "", min: 0, max: 10 }])
          }
        >
          Add criterion
        </button>
        <p className="muted" style={{ marginTop: 12 }}>
          Each criterion needs a unique name and a valid score range.
        </p>
        <button>Save event settings</button>
      </fieldset>
      <p role="status" className="form-message">
        {message}
      </p>
    </form>
  );
}
