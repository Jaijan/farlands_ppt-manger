import {
  submissionAccess,
  originCheck,
  errorResponse,
  HttpError,
} from "@/lib/auth";
import { service, checked } from "@/lib/db";
import { feedbackSchema } from "@/lib/validation";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    originCheck(req);
    const { id } = await params;
    const { profile, submission } = await submissionAccess(id);
    const db = service();
    const body = await req.json();
    if (body.action === "preview-retry") {
      if (submission.preview_status === "failed")
        checked(
          await db
            .from("submissions")
            .update({ preview_status: "queued" })
            .eq("id", id)
            .eq("preview_status", "failed"),
        );
      return Response.json({ ok: true });
    }
    if (body.action === "retry-email") {
      const delivery = checked(
        await db
          .from("email_deliveries")
          .select("*")
          .eq("id", body.delivery_id)
          .eq("submission_id", id)
          .single(),
      );
      if (!["failed", "uncertain"].includes(delivery.status))
        throw new HttpError(409, "This email cannot be retried.");
      checked(
        await db
          .from("email_deliveries")
          .update({ status: "queued", last_error: null })
          .eq("id", delivery.id)
          .in("status", ["failed", "uncertain"]),
      );
      checked(
        await db.from("audit_logs").insert({
          actor_id: profile.id,
          action: "email.retry",
          resource_type: "email_delivery",
          resource_id: delivery.id,
        }),
      );
      return Response.json({ ok: true });
    }
    if (profile.role !== "judge")
      throw new HttpError(403, "Only the assigned judge can author feedback.");
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, "Invalid feedback.");
    if (!["draft", "publish"].includes(body.action))
      throw new HttpError(400, "Invalid action.");
    if (body.action === "publish" && !submission.email_verified_at)
      throw new HttpError(
        409,
        "The participant must verify their email before publication.",
      );
    const result = await db.rpc("save_review", {
      sid: id,
      actor: profile.id,
      body: parsed.data,
      publish: body.action === "publish",
    });
    if (result.error)
      throw new HttpError(
        400,
        "Feedback could not be saved. Complete required fields and any scoring criteria, and check your assignment.",
      );
    return Response.json({ ok: true, id: result.data });
  } catch (e) {
    return errorResponse(e);
  }
}
