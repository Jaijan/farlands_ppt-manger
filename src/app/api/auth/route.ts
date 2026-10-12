import { session } from "@/lib/db";
import { authorize, errorResponse, originCheck, HttpError } from "@/lib/auth";
import { z } from "zod";
export async function POST(req: Request) {
  try {
    originCheck(req);
    const body = await req.json();
    const db = await session();
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
      await db.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      });
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
    return errorResponse(e);
  }
}
