import { pageAuth } from "@/lib/page-auth";
import { Shell } from "@/components/shell";
import { ActionForm } from "@/components/action-form";
export default async function Page() {
  const { profile } = await pageAuth();
  return (
    <Shell profile={profile}>
      <h1>Account security</h1>
      <p className="muted">
        Set a strong, unique password for {profile.email}.
      </p>
      <div className="card" style={{ maxWidth: 500 }}>
        <ActionForm endpoint="/api/auth" action="password">
          <label htmlFor="new-password">
            New password · at least 12 characters
          </label>
          <input
            id="new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
          <button style={{ marginTop: 20 }}>Update password</button>
        </ActionForm>
      </div>
    </Shell>
  );
}
