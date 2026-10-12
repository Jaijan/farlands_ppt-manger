export default function Loading() {
  return (
    <main className="public-content" aria-label="Loading">
      <div className="skeleton" />
      <p className="muted" style={{ marginTop: 20 }}>
        Loading your workspace…
      </p>
    </main>
  );
}
