"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function ActionForm({
  children,
  endpoint = "/api/admin",
  action,
  values = {},
  confirmation,
}: {
  children: React.ReactNode;
  endpoint?: string;
  action: string;
  values?: Record<string, unknown>;
  confirmation?: string;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (confirmation && !confirm(confirmation)) return;
        setBusy(true);
        setMessage("");
        try {
          const data = Object.fromEntries(new FormData(e.currentTarget));
          const r = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...values, ...data, action }),
          });
          const result = await r.json();
          if (!r.ok) throw new Error(result.error);
          setMessage(
            action === "reset"
              ? "If the account exists, a reset email has been requested."
              : "Saved successfully.",
          );
          if (result.url) router.push(result.url);
          else if (action === "logout") router.push("/");
          else router.refresh();
        } catch (e) {
          setMessage(e instanceof Error ? e.message : "Please retry.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>{children}</fieldset>
      <p className="form-message" role="status">
        {busy ? "Working…" : message}
      </p>
    </form>
  );
}
