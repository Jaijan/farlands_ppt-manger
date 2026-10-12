# VISHWAKARMA: FARLANDS

A standalone Next.js application for account-free participant submissions, private presentation review, administrator-managed judging, and SMTP feedback publication. No demo accounts, sample participant records, or fabricated metrics are used in the application.

## Local development

Requires Node.js 22.13+ (Node 22 LTS recommended), npm, a Supabase project, and an SMTP provider. LibreOffice is required on the worker host for PPTX conversion.

```sh
npm ci
cp .env.example .env.local
# Fill in the values described below.
npm run dev
# In another terminal:
npm run worker
```

Open http://localhost:3000. The home and submission pages work without service credentials, but submissions and protected areas require configuration. No Cloudflare account or CAPTCHA keys are required. `npm ci` copies the matching PDF.js worker, fonts, CMaps, and WASM into ignored public assets.

## Supabase setup

1. Create a dedicated Supabase project. Run all files in `supabase/migrations/` in numeric order through the SQL editor or Supabase CLI. The migrations create the schema, indexes, RLS policies, private `presentations` bucket, transactional RPCs, audit log, delivery-attempt history, and work queues.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the server-only `SUPABASE_SERVICE_ROLE_KEY`. Never use a service-role key in a `NEXT_PUBLIC_*` variable.
3. In Auth settings, **disable public user signup**. Configure your site URL and allow `${NEXT_PUBLIC_APP_URL}/auth/callback` as a redirect. Require a strong password policy, and keep Auth rate limits enabled.
4. Configure **Supabase Auth custom SMTP** for invitations and password resets. The application worker's SMTP settings do not automatically configure Supabase Auth.
5. Set the invitation template link to `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite`, and the recovery template link to `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery`. These server-side exchanges work across browsers without exposing tokens in client JavaScript. The callback also supports PKCE authorization codes.
6. Provision the first administrator from a trusted terminal:

```sh
npm run provision-admin -- admin@example.org "Event Administrator"
```

Use the invitation email to set a password. Administrators invite judges at `/admin/judges`; judges cannot register or alter their own role. Deactivation is checked on every protected request and in RLS, so an existing session loses access immediately. Reassignment revokes the previous judge's access; their previous drafts and publications remain available to administrators.

## SMTP and email verification

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`, and `SMTP_FROM_NAME`. Port 465 uses implicit TLS; other ports require STARTTLS. Configure the provider's SPF/DKIM records. Never disable certificate validation. `SMTP_SECURE` is documented for provider compatibility; transport security is intentionally derived from the port to prevent accidental plaintext configuration.

The separate worker sends confirmation and feedback emails. Submission creates a confirmation delivery record atomically. The confirmation contains an email-verification link, valid for seven days. Verification requires an explicit click on the verification page; opening a link does not mutate submission data. A judge cannot publish feedback until that address is verified. The recipient is read from the stored submission, never a judge-supplied input. An administrator can retry the confirmation email to issue a fresh verification link.

Draft saves never queue mail. Publication validates required fields and the current rubric, creates an immutable version, and queues one delivery in the same database transaction. A request-key ledger prevents duplicate publication on network retries. A second intentional publication creates a new version. Internal notes are excluded by an explicit field allowlist in both HTML and text emails.

Email states are `queued`, `sending`, `smtp_accepted`, `failed`, and `uncertain`. SMTP acceptance **does not confirm inbox delivery**. This implementation does not integrate provider delivery/bounce webhooks. Failed records remain visible; retries reuse the delivery record and never create another feedback publication. SMTP cannot guarantee exactly-once delivery: interrupted sends are marked uncertain after ten minutes and require checking provider logs before a manual retry. Message IDs remain stable across retries.

Use `/admin/settings` to send an SMTP test to the signed-in administrator. Service errors shown to users never include credentials or provider internals.

## Uploads, previews, and abuse prevention

`MAX_UPLOAD_SIZE_MB` defaults to 25. `ALLOWED_UPLOAD_MIME_TYPES` defaults to PDF and PPTX. Keep the application limit, Supabase bucket `file_size_limit`, and reverse-proxy body limit consistent if changing it. The supplied Nginx config permits a 25 MB file plus multipart overhead, limits submission/auth traffic by IP, and must sit in front of the app in production. The database also enforces a five-submissions-per-email-per-hour limit. The form uses a signed, expiring timestamp and a hidden honeypot to discourage basic automated submissions. Tokens are generated server-side using a domain-separated HMAC with the existing service-role secret; no extra key setup is needed. Forms must be at least two seconds old and expire after four hours. These checks are basic bot friction, not a CAPTCHA equivalent; sophisticated bots can still load and submit forms. Keep ingress IP limits enabled.

Files are signature checked; PPTX ZIP containers are checked for required members, encryption, path traversal, entry count, expansion size, and executable/macro members. Names are randomized in storage. PDF.js renders canvas pages from authenticated `no-store` endpoints; no public file URL is generated. Browser database and storage writes are denied. References are receipts, not access credentials.

PPTX conversion runs asynchronously through LibreOffice with a separate temporary profile, a timeout, and cleanup. Converted PDFs are cached privately. Conversion status and retries are available in the review workspace. PDF previews use page navigation, zoom, and fullscreen. Complex animations, embedded media, transitions, and unusual fonts may not survive conversion. If LibreOffice is missing, previews visibly fail and can be retried after the administrator fixes the worker.

The worker container runs unprivileged with memory, CPU, and PID limits. For an internet-facing event, apply host egress rules and isolate conversion from sensitive infrastructure; LibreOffice processes untrusted documents. Keep LibreOffice and PDF.js patched. Large files require a host that accepts the configured body size; hosting with smaller request limits needs a documented direct-upload redesign, not a silently lowered feature promise.

## Deployment

Use a Node-compatible container/VM with HTTPS termination, Supabase connectivity, and SMTP egress. The provided Docker image includes LibreOffice and fonts. Sites/Cloudflare Worker hosting is not used because this application's raw SMTP and LibreOffice subprocess requirements are incompatible with that runtime.

```sh
docker compose --env-file .env.local up --build -d
```

The reverse proxy listens on port 8080. Put your HTTPS ingress in front of it and set `NEXT_PUBLIC_APP_URL` to the exact public origin. Do not expose the web container's port directly: doing so bypasses ingress upload limits and IP throttling. Configure your trusted proxy's real-client-IP handling if adding another ingress. Public Supabase values are build arguments; rebuild when they change. Service-role and SMTP credentials are runtime environment values only.

Run both `web` and `worker`; a stopped worker leaves jobs visibly queued. Multiple workers safely claim jobs with `FOR UPDATE SKIP LOCKED`. Monitor failed/uncertain deliveries and preview jobs, and configure database/storage backups. Do not log request bodies, verification links, or authentication callback query strings at your ingress. The application does not log them.

Settings support submission and review deadlines and optional scoring criteria. Submission deadlines are enforced transactionally; review deadlines are advisory and displayed in the judge dashboard. Only one active judge per submission is supported. Admin CSV exports omit email addresses, phone numbers, file paths, and private URLs and escape spreadsheet formulas.

## Tests and verification

```sh
npm test
npm run lint
npm run typecheck
npm run build
npm audit --omit=dev
```

Unit and route tests cover input validation, file rejection, consent, email privacy/escaping, CSV injection, scoring validation, unauthorized access, deactivated users, unassigned submissions, CSRF, and draft/publication routing. Embedded PostgreSQL integration tests execute the actual migrations (with an Auth/Storage schema harness) and exercise RLS, role escalation prevention, atomic submission/confirmation, draft isolation, immutable history, publication idempotency, job claims, reassignment, deactivation, and rate limiting. They do not prove that a remote Supabase project, SMTP provider, or LibreOffice installation is configured.

Before opening the event, run this live acceptance check with your own test addresses:

1. Submit a real PDF without an account, receive its SMTP confirmation, and verify the address.
2. Invite two judges; assign the submission to one. Confirm the other cannot access its route or file endpoint.
3. Open the PDF, navigate pages, zoom, and save a draft; confirm no feedback email is queued.
4. Preview and publish feedback. Confirm one immutable publication, SMTP acceptance, and receipt of an email with no internal notes.
5. Simulate SMTP failure, inspect the visible failure, restore SMTP, and retry without adding a publication.
6. Submit a real PPTX and check conversion/preview. Disable LibreOffice, verify the failure UI, restore it, and retry.
7. Reassign and deactivate a judge and confirm their existing session loses access.

## Remaining external configuration

No service credentials are included. Apply migrations, configure Supabase Auth and SMTP, provision the first administrator, and deploy the web/worker services before live use. Live mail delivery, Supabase access, browser rendering, and LibreOffice conversion require an environment-backed acceptance run; compilation alone does not verify those services.

Implementation follows the official [Next.js cookie API](https://nextjs.org/docs/app/api-reference/functions/cookies) and [Supabase server-side authentication guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
