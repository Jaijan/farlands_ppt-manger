import { z } from "zod";
import { authorize, originCheck, errorResponse, HttpError } from "@/lib/auth";
import { service, checked } from "@/lib/db";
import { settingsSchema, csvCell } from "@/lib/validation";
import { transport, sender } from "@/lib/email";
export async function GET() {
  try {
    await authorize("admin");
    const rows = checked(
      await service()
        .from("submissions")
        .select(
          "reference_code,team_name,institution,project_title,status,submitted_at",
        ),
    );
    const keys = [
      "reference_code",
      "team_name",
      "institution",
      "project_title",
      "status",
      "submitted_at",
    ];
    return new Response(
      [
        keys.join(","),
        ...rows.map((r) =>
          keys.map((k) => csvCell(r[k as keyof typeof r])).join(","),
        ),
      ].join("\r\n"),
      {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition":
            'attachment; filename="farlands-submissions.csv"',
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(req: Request) {
  try {
    originCheck(req);
    const { profile } = await authorize("admin");
    const db = service(),
      body = await req.json();
    let resource: string | undefined;
    switch (body.action) {
      case "invite": {
        const email = z.email().parse(body.email),
          name = z.string().trim().min(2).max(200).parse(body.full_name);
        const { data, error } = await db.auth.admin.inviteUserByEmail(email, {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        });
        if (error || !data.user)
          throw new HttpError(
            400,
            "Invitation could not be created. Check the address or existing account.",
          );
        resource = data.user.id;
        const result = await db
          .from("profiles")
          .insert({ id: resource, email, full_name: name, role: "judge" });
        if (result.error) {
          await db.auth.admin.deleteUser(resource);
          throw new Error("Profile failed");
        }
        break;
      }
      case "deactivate": {
        resource = z.uuid().parse(body.id);
        if (resource === profile.id)
          throw new HttpError(400, "You cannot deactivate your own account.");
        checked(
          await db
            .from("profiles")
            .update({ is_active: false })
            .eq("id", resource)
            .eq("role", "judge"),
        );
        break;
      }
      case "reset": {
        resource = z.uuid().parse(body.id);
        const target = checked(
          await db.from("profiles").select("email").eq("id", resource).single(),
        );
        const { error } = await db.auth.resetPasswordForEmail(target.email, {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        });
        if (error) throw new Error("Reset failed");
        break;
      }
      case "assign": {
        resource = z.uuid().parse(body.submission_id);
        checked(
          await db.rpc("assign_submission", {
            sid: resource,
            jid: z.uuid().parse(body.judge_id),
            actor: profile.id,
          }),
        );
        break;
      }
      case "status": {
        resource = z.uuid().parse(body.id);
        checked(
          await db
            .from("submissions")
            .update({
              status: z
                .enum(["submitted", "withdrawn", "disqualified"])
                .parse(body.status),
              updated_at: new Date().toISOString(),
            })
            .eq("id", resource),
        );
        break;
      }
      case "settings": {
        checked(
          await db
            .from("settings")
            .update(settingsSchema.parse(body.settings))
            .eq("id", true),
        );
        break;
      }
      case "test-email": {
        await transport().sendMail({
          from: sender(),
          to: profile.email,
          subject: "FARLANDS SMTP configuration test",
          text: "Your SMTP server accepted this test message.",
        });
        break;
      }
      default:
        throw new HttpError(400, "Unknown operation.");
    }
    checked(
      await db.from("audit_logs").insert({
        actor_id: profile.id,
        action: `admin.${body.action}`,
        resource_type: body.action,
        resource_id: resource,
      }),
    );
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
