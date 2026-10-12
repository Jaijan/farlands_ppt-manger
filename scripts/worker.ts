import { createClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "node:crypto";
import { convertPptx } from "../src/lib/conversion";

import { emailContent, transport, sender } from "../src/lib/email";
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
function check<T>(r: { data: T; error: unknown }) {
  if (r.error) throw new Error("Worker database operation failed");
  return r.data as NonNullable<T>;
}
async function email() {
  const [job] = check(await db.rpc("claim_delivery"));
  if (!job) return;
  let sending = false;
  try {
    const s = check(
      await db
        .from("submissions")
        .select("*")
        .eq("id", job.submission_id)
        .single(),
    );
    let verifyUrl: string | undefined;
    let f;
    if (job.feedback_id) {
      f = check(
        await db
          .from("feedback")
          .select(
            "overall_feedback,strengths,improvements,technical_suggestions,next_steps,recommendations,scores",
          )
          .eq("id", job.feedback_id)
          .eq("status", "published")
          .single(),
      );
      if (!s.email_verified_at || job.recipient_email !== s.leader_email)
        throw new Error("Recipient not verified");
    } else {
      const token = randomBytes(32).toString("hex");
      check(
        await db.from("verification_tokens").upsert({
          submission_id: s.id,
          token_hash: createHash("sha256").update(token).digest("hex"),
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        }),
      );
      verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify#${token}`;
    }
    const smtp = transport();
    sending = true;
    const result = await smtp.sendMail({
      from: sender(),
      to: job.recipient_email,
      messageId: `<${job.id}@${new URL(process.env.NEXT_PUBLIC_APP_URL!).hostname}>`,
      ...emailContent(s, f, verifyUrl),
    });
    if (!result.accepted.length) throw new Error("SMTP rejected recipient");
    check(
      await db
        .from("email_deliveries")
        .update({
          status: "smtp_accepted",
          smtp_accepted_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", job.id),
    );
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    const uncertain =
      sending && !["EAUTH", "ECONNECTION", "EENVELOPE"].includes(code);
    check(
      await db
        .from("email_deliveries")
        .update({
          status: uncertain ? "uncertain" : "failed",
          last_error: uncertain
            ? "Send outcome is uncertain. Check SMTP provider logs before retrying to avoid duplicate mail."
            : "SMTP processing failed. Check server configuration and provider logs before retrying.",
        })
        .eq("id", job.id),
    );
  }
}
async function preview() {
  const [job] = check(await db.rpc("claim_preview"));
  if (!job) return;

  try {
    const blob = check(
      await db.storage.from("presentations").download(job.original_file_path),
    );
    const pdf = await convertPptx(Buffer.from(await blob.arrayBuffer()));
    const path = `${job.id}/preview.pdf`;
    check(
      await db.storage
        .from("presentations")
        .upload(path, pdf, { contentType: "application/pdf", upsert: true }),
    );
    check(
      await db
        .from("submissions")
        .update({ preview_status: "ready", preview_file_path: path })
        .eq("id", job.id),
    );
  } catch {
    check(
      await db
        .from("submissions")
        .update({ preview_status: "failed" })
        .eq("id", job.id),
    );
  }
}
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
async function main() {
  while (!stopping) {
    try {
      const cutoff = new Date(Date.now() - 10 * 60000).toISOString();
      check(
        await db
          .from("email_deliveries")
          .update({
            status: "uncertain",
            last_error:
              "Worker stopped during send. Check SMTP logs before retrying; the message may have been accepted.",
          })
          .eq("status", "sending")
          .lt("started_at", cutoff),
      );
      check(
        await db
          .from("submissions")
          .update({ preview_status: "failed" })
          .eq("preview_status", "processing")
          .lt("preview_started_at", cutoff),
      );
      await email();
      await preview();
    } catch {
      console.error("Worker operation failed; check service configuration.");
    }
    await new Promise((r) =>
      setTimeout(r, Number(process.env.WORKER_POLL_MS || 5000)),
    );
  }
}
main().catch(() => {
  process.exitCode = 1;
});
