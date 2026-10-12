import { PublicHeader } from "@/components/brand";
import { SubmitForm } from "@/components/submit-form";
import { service, checked } from "@/lib/db";
import { createSubmissionToken } from "@/lib/submission-guard";
export const dynamic = "force-dynamic";
export default async function Page() {
  const settings = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? checked(
        await service().from("settings").select("submission_deadline").single(),
      )
    : null;
  const deadline = settings?.submission_deadline;
  const closed = deadline && new Date(deadline) < new Date();
  return (
    <>
      <PublicHeader />
      <main className="public-content">
        <div className="eyebrow">The next step starts here</div>
        <h1 style={{ marginTop: 16 }}>Show us what you’re building.</h1>
        <p className="muted">
          One presentation. A fresh perspective. No account required.
        </p>
        {deadline && (
          <p className="notice">
            Submission deadline:{" "}
            {new Date(deadline).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
            })}{" "}
            IST
          </p>
        )}
        {closed ? (
          <section className="card">
            <h2>Submissions are closed.</h2>
            <p className="muted">
              The submission deadline has passed. Contact the event
              administrator for assistance.
            </p>
          </section>
        ) : (
          <SubmitForm
            max={Number(process.env.MAX_UPLOAD_SIZE_MB || 25)}
            token={
              process.env.SUPABASE_SERVICE_ROLE_KEY
                ? createSubmissionToken()
                : null
            }
          />
        )}
      </main>
    </>
  );
}
