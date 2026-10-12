import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
let db: PGlite;
const admin = "00000000-0000-4000-8000-000000000001",
  judge = "00000000-0000-4000-8000-000000000002",
  other = "00000000-0000-4000-8000-000000000003",
  sid = "00000000-0000-4000-8000-000000000010";
const review = {
  overall_feedback: "This is a constructive overall project review.",
  strengths: "A strong implementation.",
  improvements: "Validate with more users.",
  technical_suggestions: "Add monitoring.",
  next_steps: "Run a pilot.",
  recommendations: "",
  internal_notes: "Never disclose this note",
  scores: {},
  request_id: "00000000-0000-4000-8000-000000000100",
};
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema storage; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); grant usage on schema public,auth to anon,authenticated,service_role; alter default privileges in schema public grant all on tables to anon,authenticated,service_role;`,
  );
  for (const file of [
    "001_portal.sql",
    "002_atomic_submission.sql",
    "003_delivery_attempts.sql",
  ])
    await db.exec(
      (
        await readFile(
          new URL(`../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        )
      ).replace("create extension if not exists pgcrypto;", ""),
    );
  await db.query(`insert into auth.users values($1),($2),($3)`, [
    admin,
    judge,
    other,
  ]);
  await db.query(
    `insert into profiles(id,full_name,email,role) values($1,'Admin','admin@example.org','admin'),($2,'Judge','judge@example.org','judge'),($3,'Other','other@example.org','judge')`,
    [admin, judge, other],
  );
  await db.query(`select register_submission($1::jsonb,$2)`, [
    JSON.stringify({
      id: sid,
      reference_code: "FL-TEST",
      team_name: "Test team",
      institution: "Test college",
      leader_name: "Participant",
      leader_email: "participant@example.org",
      project_title: "Test project",
      abstract: "A test project for database verification.",
      original_file_path: "private/test.pdf",
      original_file_name: "test.pdf",
      file_mime_type: "application/pdf",
      file_size: 100,
      preview_status: "ready",
      preview_file_path: "private/test.pdf",
    }),
    "token-hash",
  ]);
  await db.query(`select assign_submission($1,$2,$3)`, [sid, judge, admin]);
}, 30000);
afterAll(async () => {
  await db?.close();
});
async function asUser(user: string | null, sql: string) {
  await db.exec(`set role ${user ? "authenticated" : "anon"}`);
  try {
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [
      user || "",
    ]);
    return await db.query(sql);
  } finally {
    await db.exec("reset role");
  }
}
describe("PostgreSQL access policies and atomic workflows", () => {
  it("registers privately and queues one confirmation atomically", async () => {
    expect((await db.query("select * from submissions")).rows).toHaveLength(1);
    expect(
      (
        await db.query(
          "select * from email_deliveries where message_type='confirmation'",
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("anonymous users cannot read submissions", async () => {
    expect((await asUser(null, "select * from submissions")).rows).toHaveLength(
      0,
    );
  });
  it("assigned judges can read only assigned submissions", async () => {
    expect(
      (await asUser(judge, "select * from submissions")).rows,
    ).toHaveLength(1);
    expect(
      (await asUser(other, "select * from submissions")).rows,
    ).toHaveLength(0);
  });
  it("judges cannot change roles or call service-only publication RPCs", async () => {
    await expect(
      asUser(judge, "update profiles set role='admin'"),
    ).rejects.toThrow();
    await expect(
      asUser(judge, `select save_review('${sid}','${judge}','{}',false)`),
    ).rejects.toThrow();
  });
  it("draft save creates no feedback email", async () => {
    await db.query("select save_review($1,$2,$3::jsonb,false)", [
      sid,
      judge,
      JSON.stringify(review),
    ]);
    expect(
      (await db.query("select * from feedback where status='draft'")).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query(
          "select * from email_deliveries where message_type='feedback'",
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("unverified recipients cannot receive publication", async () => {
    await expect(
      db.query("select save_review($1,$2,$3::jsonb,true)", [
        sid,
        judge,
        JSON.stringify(review),
      ]),
    ).rejects.toThrow("not verified");
  });
  it("publishes atomically and deduplicates repeated publication requests", async () => {
    await db.query(
      "update submissions set email_verified_at=now() where id=$1",
      [sid],
    );
    const first = await db.query(
      "select save_review($1,$2,$3::jsonb,true) as id",
      [sid, judge, JSON.stringify(review)],
    );
    const second = await db.query(
      "select save_review($1,$2,$3::jsonb,true) as id",
      [sid, judge, JSON.stringify(review)],
    );
    expect(first.rows).toEqual(second.rows);
    expect(
      (
        await db.query(
          "select * from email_deliveries where message_type='feedback'",
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("published feedback cannot be edited or deleted even by service operations", async () => {
    await expect(
      db.exec(
        "update feedback set overall_feedback='changed' where status='published'",
      ),
    ).rejects.toThrow("immutable");
    await expect(
      db.exec("delete from feedback where status='published'"),
    ).rejects.toThrow("immutable");
  });
  it("new draft preserves publication history", async () => {
    await db.query("select save_review($1,$2,$3::jsonb,false)", [
      sid,
      judge,
      JSON.stringify({
        ...review,
        request_id: "00000000-0000-4000-8000-000000000101",
      }),
    ]);
    expect((await db.query("select * from feedback")).rows).toHaveLength(2);
  });
  it("claims each queued email once and preserves failed records", async () => {
    const first = await db.query<{ id: string }>(
      "select * from claim_delivery()",
    );
    const second = await db.query<{ id: string }>(
      "select * from claim_delivery()",
    );
    expect(first.rows[0].id).not.toBe(second.rows[0].id);
    expect(
      (await db.query("select * from claim_delivery()")).rows,
    ).toHaveLength(0);
    await db.query("update email_deliveries set status='failed' where id=$1", [
      first.rows[0].id,
    ]);
    expect(
      (await db.query("select * from email_deliveries where status='failed'"))
        .rows,
    ).toHaveLength(1);
  });
  it("reassignment removes old judge access immediately", async () => {
    await db.query("select assign_submission($1,$2,$3)", [sid, other, admin]);
    expect(
      (await asUser(judge, "select * from submissions")).rows,
    ).toHaveLength(0);
    await expect(
      db.query("select save_review($1,$2,$3::jsonb,false)", [
        sid,
        judge,
        JSON.stringify(review),
      ]),
    ).rejects.toThrow("Not authorized");
    expect((await asUser(other, "select * from feedback")).rows).toHaveLength(
      0,
    );
  });
  it("deactivation revokes RLS access immediately", async () => {
    await db.query("update profiles set is_active=false where id=$1", [other]);
    expect(
      (await asUser(other, "select * from submissions")).rows,
    ).toHaveLength(0);
  });
  it("rate limits are durable and enforce the configured window", async () => {
    for (let n = 0; n < 5; n++)
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select consume_rate('test') as allowed",
          )
        ).rows[0].allowed,
      ).toBe(true);
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select consume_rate('test') as allowed",
        )
      ).rows[0].allowed,
    ).toBe(false);
  });
});
