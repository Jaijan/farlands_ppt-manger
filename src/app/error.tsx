"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="public-content card">
      <h1>We couldn’t load this page.</h1>
      <p className="muted">
        Please retry. If this continues, contact your event administrator to
        check the application’s service configuration.
      </p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
