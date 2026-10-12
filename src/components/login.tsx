import { PublicHeader } from "./brand";
import { ActionForm } from "./action-form";
export function Login({ admin = false }: { admin?: boolean }) {
  return (
    <>
      <PublicHeader />
      <main className="login card">
        <div className="eyebrow">
          {admin ? "Administrator" : "Judge"} workspace
        </div>
        <h1 style={{ marginTop: 20 }}>Welcome back.</h1>
        <p className="muted">Sign in with your designated event account.</p>
        <ActionForm endpoint="/api/auth" action="login">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          <button>Sign in →</button>
        </ActionForm>
        <details style={{ marginTop: 24 }}>
          <summary>Forgot your password?</summary>
          <ActionForm endpoint="/api/auth" action="reset">
            <label htmlFor="reset-email">Account email</label>
            <input id="reset-email" name="email" type="email" required />
            <button className="secondary">Send password reset link</button>
          </ActionForm>
        </details>
        <p className="muted" style={{ marginTop: 28, fontSize: 12 }}>
          Access is by invitation only. Contact the event administrator if you
          need an account.
        </p>
      </main>
    </>
  );
}
