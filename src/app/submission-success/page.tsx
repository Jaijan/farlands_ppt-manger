import { PublicHeader } from "@/components/brand";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  const { reference } = await searchParams;
  return (
    <>
      <PublicHeader />
      <main className="public-content card">
        <div className="eyebrow">Submission received</div>
        <h1 style={{ marginTop: 20 }}>Your idea is in good hands.</h1>
        <p>
          Keep your submission reference:{" "}
          <strong>
            {reference?.slice(0, 40) || "Check your confirmation email"}
          </strong>
        </p>
        <p className="muted">
          Your confirmation email is queued. Open its verification link so your
          judge can send feedback to your verified address. If it doesn’t
          arrive, contact the event administrator with your reference.
        </p>
      </main>
    </>
  );
}
