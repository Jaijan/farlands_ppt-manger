import { submissionAccess, errorResponse, HttpError } from "@/lib/auth";
import { service, checked } from "@/lib/db";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { submission } = await submissionAccess((await params).id);
    if (submission.preview_status !== "ready" || !submission.preview_file_path)
      throw new HttpError(409, "Preview is still processing or unavailable.");
    const file = checked(
      await service()
        .storage.from("presentations")
        .download(submission.preview_file_path),
    );
    return new Response(await file.arrayBuffer(), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, no-store",
        "Content-Disposition": 'inline; filename="presentation.pdf"',
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
