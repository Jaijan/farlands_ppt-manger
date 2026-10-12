import { it, expect } from "vitest";
import { writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { convertPptx } from "../src/lib/conversion";
it("runs bounded conversion with no service credentials in the subprocess and removes temporary files", async () => {
  let dir = "";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "do-not-pass";
  const pdf = await convertPptx(
    Buffer.from("test-pptx"),
    async (_engine, args, options) => {
      dir = args[args.indexOf("--outdir") + 1];
      expect(options.timeout).toBe(90000);
      expect(options.env).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
      await writeFile(join(dir, "presentation.pdf"), "%PDF-1.7\n%%EOF");
    },
  );
  expect(pdf.toString()).toContain("%PDF-");
  await expect(access(dir)).rejects.toThrow();
});
it("returns a safe actionable error and cleans up after engine failure", async () => {
  let dir = "";
  await expect(
    convertPptx(Buffer.from("pptx"), async (_engine, args) => {
      dir = args[args.indexOf("--outdir") + 1];
      throw new Error("Private server path /secrets/internal");
    }),
  ).rejects.toThrow(
    "Presentation conversion failed. Retry or contact the event administrator.",
  );
  await expect(access(dir)).rejects.toThrow();
});
