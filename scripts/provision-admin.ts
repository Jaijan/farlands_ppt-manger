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
  if (error || !data.user) throw new Error("Admin invitation failed");
  const result = await db
    .from("profiles")
    .insert({ id: data.user.id, email, full_name: name, role: "admin" });
  if (result.error) {
    await db.auth.admin.deleteUser(data.user.id);
    throw new Error("Admin profile creation failed");
  }
  console.log("Administrator invited. Use the emailed link to set a password.");
}
main().catch(() => {
  console.error(
    "Provisioning failed. Check configuration and whether the user already exists.",
  );
  process.exitCode = 1;
});
