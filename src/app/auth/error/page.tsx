import Link from "next/link";
import { PublicHeader } from "@/components/brand";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message =
    reason === "configuration"
      ? "Account access is not configured on this deployment. Ask the administrator to check the Supabase URL and public API key, then redeploy."
      : reason === "service"
        ? "We could not connect to the account service. Please try again later or contact the event administrator."
        : "This invitation or password-reset link has expired, was already used, or is invalid. Request a new password-reset link from the sign-in page.";
  return (
    <>
      <PublicHeader />
      <main className="public-content card">
        <h1>We couldn’t open your account link.</h1>
        <p>{message}</p>
        <Link className="button" href="/admin/login">
          Go to sign in
        </Link>
      </main>
    </>
  );
}
