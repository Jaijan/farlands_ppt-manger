import { createHash } from "node:crypto";
import { service, checked } from "@/lib/db";
import { errorResponse, HttpError, originCheck } from "@/lib/auth";
export async function POST(req: Request) {
  try {
    originCheck(req);
    const { token } = await req.json();
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
      throw new HttpError(400, "Invalid verification link.");
    const db = service();
    const row = checked(
      await db
        .from("verification_tokens")
        .select("*")
        .eq("token_hash", createHash("sha256").update(token).digest("hex"))
        .gt("expires_at", new Date().toISOString())
        .maybeSingle(),
    );
    if (!row)
      throw new HttpError(
        400,
        "This link has expired. Contact an event administrator.",
      );
    checked(
      await db
        .from("submissions")
        .update({ email_verified_at: new Date().toISOString() })
        .eq("id", row.submission_id),
    );
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
