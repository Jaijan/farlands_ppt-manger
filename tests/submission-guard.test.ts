import { beforeEach, expect, it } from "vitest";
import {
  createSubmissionToken,
  validSubmissionToken,
} from "../src/lib/submission-guard";
const now = 1800000000000;
beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-key";
});
it("accepts a signed form after a short filling interval", () => {
  expect(validSubmissionToken(createSubmissionToken(now - 3000), "", now)).toBe(
    true,
  );
});
it("rejects expired, future and immediately submitted forms", () => {
  for (const issued of [now, now + 10000, now - 4 * 60 * 60 * 1000 - 1]) {
    expect(validSubmissionToken(createSubmissionToken(issued), "", now)).toBe(
      false,
    );
  }
});
it("rejects tampered timestamps and signatures", () => {
  const token = createSubmissionToken(now - 3000);
  expect(
    validSubmissionToken(
      token.replace(String(now - 3000), String(now - 5000)),
      "",
      now,
    ),
  ).toBe(false);
  const parts = token.split(".");
  parts[2] = "0".repeat(64);
  expect(validSubmissionToken(parts.join("."), "", now)).toBe(false);
});
it("rejects honeypot entries and malformed tokens", () => {
  expect(
    validSubmissionToken(createSubmissionToken(now - 3000), "spam", now),
  ).toBe(false);
  for (const token of ["", "invalid", "1.2.3"])
    expect(validSubmissionToken(token, "", now)).toBe(false);
});
