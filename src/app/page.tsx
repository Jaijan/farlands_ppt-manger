import Link from "next/link";
import { PublicHeader } from "@/components/brand";
export default function Home() {
  return (
    <>
      <PublicHeader />
      <main className="hero">
        <div className="eyebrow">Vishwakarma · Farlands</div>
        <h1>
          Big ideas deserve
          <br />
          <span>a closer look.</span>
        </h1>
        <p className="muted">
          Your next breakthrough starts with a fresh perspective. Submit your
          presentation and receive thoughtful, private feedback from the
          FARLANDS judging team.
        </p>
        <div className="hero-actions">
          <Link className="button" href="/submit">
            Submit your presentation ↗
          </Link>
          <Link className="button secondary" href="/judge/login">
            Enter judging workspace →
          </Link>
        </div>
        <div className="feature-grid">
          {[
            [
              "01 / SUBMIT",
              "One idea. One submission.",
              "Share your team, your project, and a PDF or PowerPoint presentation. No account needed.",
            ],
            [
              "02 / REVIEW",
              "A dedicated perspective.",
              "Your assigned judge explores your presentation in a focused, private review workspace.",
            ],
            [
              "03 / IMPROVE",
              "Feedback you can build on.",
              "Receive strengths, practical suggestions, and next steps directly in your verified inbox.",
            ],
          ].map(([n, t, d]) => (
            <section className="card" key={n}>
              <div className="feature-number">{n}</div>
              <h2>{t}</h2>
              <p className="muted">{d}</p>
            </section>
          ))}
        </div>
      </main>
      <footer className="footer">
        <span>VISHWAKARMA: FARLANDS</span>
        <span>Private submissions. Constructive conversations.</span>
        <Link href="/admin/login">Administrator access</Link>
      </footer>
    </>
  );
}
