import { redirect } from "next/navigation";
import { authorize, HttpError } from "./auth";
export async function pageAuth(role?: "judge" | "admin") {
  try {
    return await authorize(role);
  } catch (e) {
    if (e instanceof HttpError) redirect(`/${role || "judge"}/login`);
    throw e;
  }
}
