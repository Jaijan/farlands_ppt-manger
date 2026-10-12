import "server-only";
import { session, checked } from "./db";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function authorize(role?: "admin" | "judge") {
  const db = await session();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new HttpError(401, "Please sign in again.");
  const profile = checked(
    await db.from("profiles").select("*").eq("id", user.id).maybeSingle(),
  );
  if (!profile?.is_active || (role && profile.role !== role))
    throw new HttpError(403, "Access denied.");
  return { db, profile, user };
}
export async function submissionAccess(id: string) {
  const auth = await authorize();
  const submission = checked(
    await auth.db.from("submissions").select("*").eq("id", id).maybeSingle(),
  );
  if (!submission) throw new HttpError(404, "Submission not found.");
  return { ...auth, submission };
}
export function originCheck(req: Request) {
  let expectedOrigin: string;
  try {
    const configured = new URL(process.env.NEXT_PUBLIC_APP_URL || "");
    if (!["http:", "https:"].includes(configured.protocol))
      throw new Error("Invalid protocol");
    expectedOrigin = configured.origin;
  } catch {
    throw new HttpError(
      503,
      "Site URL configuration is missing or invalid. Set NEXT_PUBLIC_APP_URL to the full website URL and redeploy.",
    );
  }
  if (req.headers.get("origin") !== expectedOrigin)
    throw new HttpError(403, "Invalid request origin.");
}
export function errorResponse(e: unknown) {
  return Response.json(
    {
      error:
        e instanceof HttpError
          ? e.message
          : "The operation could not be completed. Please retry.",
    },
    { status: e instanceof HttpError ? e.status : 500 },
  );
}
