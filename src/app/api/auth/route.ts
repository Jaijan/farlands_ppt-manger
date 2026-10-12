import { session } from "@/lib/db";
import { authorize, errorResponse, originCheck, HttpError } from "@/lib/auth";
import { z } from "zod";
export async function POST(req: Request) {
  try {
    originCheck(req);
    const body = await req.json();
    let db;
    try {
      db = await session();
    } catch {
      throw new HttpError(
        503,
        "Account service could not initialize. Check the deployed Supabase URL and public key.",
      );
    }
    if (body.action === "logout") {
      await db.auth.signOut();
      return Response.json({ ok: true });
    }
    if (body.action === "password") {
      await authorize();
      const password = z.string().min(12).max(128).parse(body.password);
      const { error } = await db.auth.updateUser({ password });
      if (error) throw new HttpError(400, "Password could not be changed.");
      return Response.json({ ok: true });
    }
    const email = z.email().parse(body.email);
    if (body.action === "reset") {
      const { error } = await db.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      });
      if (error) {
        console.error("Password reset request failed", {
          status: error.status,
          code: error.code,
        });
        throw new HttpError(
          error.status === 429 ? 429 : 502,
          error.status === 429
            ? "Too many reset requests. Please wait before trying again."
            : "The account service could not send the reset email. Ask the administrator to check Supabase Auth logs and email settings.",
        );
      }
      return Response.json({ ok: true });
    }
    const { error } = await db.auth.signInWithPassword({
      email,
      password: z.string().min(1).max(128).parse(body.password),
    });
    if (error) throw new HttpError(401, "Email or password is incorrect.");
    const { profile } = await authorize();
    return Response.json({ url: `/${profile.role}/dashboard` });
  } catch (e) {
    if (e instanceof z.ZodError)
      return Response.json(
        {
          error:
            "Enter a valid email address and the required account details.",
        },
        { status: 400 },
      );
    return errorResponse(e);
  }
}
