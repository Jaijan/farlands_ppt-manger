import { session } from "@/lib/db";
import { NextResponse } from "next/server";
export async function GET(req: Request) {
  const url = new URL(req.url);
  const db = await session();
  const code = url.searchParams.get("code");
  const token_hash = url.searchParams.get("token_hash"),
    type = url.searchParams.get("type");
  if (token_hash && (type === "invite" || type === "recovery")) {
    const { error } = await db.auth.verifyOtp({ token_hash, type });
    if (!error)
      return NextResponse.redirect(
        new URL("/judge/account", process.env.NEXT_PUBLIC_APP_URL),
      );
  }
  if (code) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL("/judge/account", process.env.NEXT_PUBLIC_APP_URL),
      );
  }
  return NextResponse.redirect(
    new URL("/judge/login?error=expired", process.env.NEXT_PUBLIC_APP_URL),
  );
}
