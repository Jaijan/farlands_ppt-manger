# Verification record

Verified locally on 12 October 2026:

- 52 tests pass across 9 suites: submission validation and route handling, signed form-token validation, SMTP transport configuration, email privacy, authorization, invitation callback and password-reset failure handling, conversion failure handling, and embedded PostgreSQL integration.
- Cloudflare Turnstile was removed. Tests verify signed form timestamps, expiration, tampering, honeypot rejection, and retained email rate limiting. No external CAPTCHA keys are required; these checks provide basic bot friction rather than equivalent CAPTCHA protection.
- The database suite executes all three migrations with minimal Supabase Auth/Storage schema adapters. It verifies RLS, role restrictions, atomic registration/publication, immutable history, idempotency, queue claims, assignment revocation, and deactivation.
- TypeScript type checking passes.
- ESLint passes.
- Next.js production build passes.
- Production-server HTTP smoke checks returned 200 for `/`, `/submit`, `/judge/login`, `/admin/login`, and the PDF.js worker asset. The temporary server was stopped after checking.
- Production dependency audit reports zero known vulnerabilities.

The full dependency audit currently reports five high-severity entries in the development-only Next.js ESLint dependency chain (`braces` → `micromatch` → `fast-glob` → Next ESLint packages). npm's proposed fix downgrades the Next lint configuration to a different framework major; it was not applied. These tools are not exposed by the running application. Recheck advisories and update when a compatible patch is available.

Not verified against live services: Supabase Auth, remote Storage, SMTP inbox receipt, real LibreOffice conversion, HTTPS deployment, or browser visual interaction. No service credentials were supplied. Conversion tests use a controlled runner and SMTP tests use a mocked transport; they do not claim external delivery or PowerPoint fidelity. Follow the live acceptance checklist in README.md before opening submissions.
