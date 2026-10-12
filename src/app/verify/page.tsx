"use client";
import { useState } from "react";
import { PublicHeader } from "@/components/brand";
export default function Page() {
  const [message, setMessage] = useState(
      "Confirm this email address to receive your private project feedback.",
    ),
    [busy, setBusy] = useState(false);
  return (
    <>
      <PublicHeader />
      <main className="public-content card">
        <h1>Verify your email</h1>
        <p role="status">{message}</p>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await fetch("/api/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: window.location.hash.slice(1) }),
              });
              const data = await r.json();
              if (!r.ok) throw new Error(data.error);
              setMessage(
                "Email verified. Your judge can now publish feedback to your inbox.",
              );
              history.replaceState(null, "", "/verify");
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Please retry.");
              setBusy(false);
            }
          }}
        >
          Verify email address
        </button>
      </main>
    </>
  );
}
