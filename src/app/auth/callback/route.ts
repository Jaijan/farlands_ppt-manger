import { session } from "@/lib/db";
import { NextResponse } from "next/server";
export async function GET(req: Request) {
  const url = new URL(req.url);
  // Redirect to this deployment's origin, even when APP_URL is unset or malformed.
  // Never carry the invitation token into the destination URL or logs.
  const destination = (path: string) =>
    NextResponse.redirect(new URL(path, url.origin));
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
    return destination("/auth/error?reason=configuration");
  try {
    const db = await session();
    const code = url.searchParams.get("code");
    const token_hash = url.searchParams.get("token_hash"),
      type = url.searchParams.get("type");
    if (token_hash && (type === "invite" || type === "recovery")) {
      const { error } = await db.auth.verifyOtp({ token_hash, type });
      if (!error) return destination("/judge/account");
    }
    if (code) {
      const { error } = await db.auth.exchangeCodeForSession(code);
      if (!error) return destination("/judge/account");
    }
    return destination("/auth/error?reason=expired");
  } catch {
    console.error(
      "Authentication callback failed. Check Supabase URL/key configuration and service availability.",
    );
    return destination("/auth/error?reason=service");
  }
}
