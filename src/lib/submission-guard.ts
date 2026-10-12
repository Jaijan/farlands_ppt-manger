import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const lifetime = 4 * 60 * 60 * 1000;
function signature(payload: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Submission service is not configured");
  return createHmac("sha256", secret)
    .update(`farlands-submission-form:v1:${payload}`)
    .digest("hex");
}

// Basic bot friction, not proof of humanity. Ingress and database limits remain necessary.
export function createSubmissionToken(now = Date.now()) {
  const payload = `${now}.${randomBytes(16).toString("hex")}`;
  return `${payload}.${signature(payload)}`;
}

export function validSubmissionToken(
  token: string,
  honeypot: string,
  now = Date.now(),
) {
  if (honeypot !== "" || !/^\d{13}\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(token))
    return false;
  const [issued, nonce, mac] = token.split(".");
  const age = now - Number(issued);
  if (age < 2000 || age > lifetime) return false;
  return timingSafeEqual(
    Buffer.from(mac, "hex"),
    Buffer.from(signature(`${issued}.${nonce}`), "hex"),
  );
}
