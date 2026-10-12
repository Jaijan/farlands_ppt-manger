import { randomUUID, randomBytes, createHash } from "node:crypto";
import { submissionSchema, PDF } from "@/lib/validation";
import { detectPresentation } from "@/lib/files";
import { service, checked } from "@/lib/db";
import { originCheck, errorResponse, HttpError } from "@/lib/auth";
import { validSubmissionToken } from "@/lib/submission-guard";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    originCheck(req);
    const db = service();
    const max = Number(process.env.MAX_UPLOAD_SIZE_MB || 25) * 1024 * 1024;
    if (Number(req.headers.get("content-length") || 0) > max + 65536)
      throw new HttpError(413, "File is too large.");
    const form = await req.formData();
    const parsed = submissionSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success)
      throw new HttpError(
        400,
        "Check all required fields and confirm your details.",
      );
    if (
      !validSubmissionToken(
        String(form.get("submission_token") || ""),
        String(form.get("website") || ""),
      )
    )
      throw new HttpError(
        400,
        "This form could not be verified. Reload the page and try again.",
      );
    const key = createHash("sha256")
      .update(parsed.data.leader_email)
      .digest("hex");
    if (!checked(await db.rpc("consume_rate", { k: key })))
      throw new HttpError(429, "Too many submissions. Try again in an hour.");
    const file = form.get("presentation");
    if (!(file instanceof File))
      throw new HttpError(400, "Choose a presentation.");
    if (file.size > max) throw new HttpError(413, "File is too large.");
    let mime: string;
    const bytes = Buffer.from(await file.arrayBuffer());
    try {
      mime = await detectPresentation(bytes, max);
    } catch {
      throw new HttpError(
        400,
        "Upload a valid PDF or PPTX within the size limit.",
      );
    }
    if (
      !(
        process.env.ALLOWED_UPLOAD_MIME_TYPES ||
        "application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
      )
        .split(",")
        .includes(mime)
    )
      throw new HttpError(400, "This file type is disabled.");
    const id = randomUUID(),
      path = `${id}/${randomUUID()}.${mime === PDF ? "pdf" : "pptx"}`,
      reference = `FL-${randomBytes(6).toString("hex").toUpperCase()}`;
    checked(
      await db.storage
        .from("presentations")
        .upload(path, bytes, { contentType: mime, upsert: false }),
    );
    // Verification token is minted by the worker when it sends confirmation; only its hash is stored.
    const result = await db.rpc("register_submission", {
      body: {
        ...parsed.data,
        id,
        reference_code: reference,
        original_file_path: path,
        original_file_name: file.name.replace(/[^\w. -]/g, "_").slice(-150),
        file_mime_type: mime,
        file_size: file.size,
        preview_file_path: mime === PDF ? path : null,
        preview_status: mime === PDF ? "ready" : "queued",
      },
      token_hash: createHash("sha256").update(randomBytes(32)).digest("hex"),
    });
    if (result.error) {
      await db.storage.from("presentations").remove([path]);
      throw new HttpError(
        409,
        "Submission could not be accepted. Check the deadline or whether this project was already submitted.",
      );
    }
    return Response.json({ reference }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
