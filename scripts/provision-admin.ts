import { createClient } from "@supabase/supabase-js";
const email = process.argv[2],
  name = process.argv[3];
if (!email || !name)
  throw new Error(
    'Usage: npm run provision-admin -- admin@example.org "Full Name"',
  );
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
async function main() {
  const { data, error } = await db.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
  });
  if (error || !data.user) {
    const code = error?.code || "unknown";
    console.error(`Invitation failed (HTTP ${error?.status || "unknown"}, code: ${code}).`);
    if (code === "email_exists" || code === "user_already_exists")
      console.error("This account already exists. Inspect its profile before retrying.");
    else if (code === "email_address_not_authorized")
      console.error("Configure custom SMTP in Supabase Authentication before inviting this address.");
    else if (error?.status === 429)
      console.error("Supabase's email rate limit was reached. Wait before retrying.");
    else if (error?.status === 401 || error?.status === 403)
      console.error("Check the project's server secret or service-role key.");
    else
      console.error("Check Supabase Authentication logs for the invitation failure, including its SMTP configuration.");
    process.exitCode = 1;
    return;
  }
  const result = await db
    .from("profiles")
    .insert({ id: data.user.id, email, full_name: name, role: "admin" });
  if (result.error) {
    console.error(`Admin profile creation failed (database code: ${result.error.code}). Check that all migrations were applied.`);
    const cleanup = await db.auth.admin.deleteUser(data.user.id);
    if (cleanup.error) console.error("The invited Auth account could not be rolled back. Inspect it before retrying.");
    process.exitCode = 1;
    return;
  }
  console.log("Administrator invited. Use the emailed link to set a password.");
}
main().catch(() => {
  console.error(
    "Provisioning failed. Check configuration and whether the user already exists.",
  );
  process.exitCode = 1;
});
