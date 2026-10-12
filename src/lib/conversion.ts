import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFile, type ExecFileOptions } from "node:child_process";
import { promisify } from "node:util";
type Runner = (
  engine: string,
  args: string[],
  options: ExecFileOptions,
) => Promise<unknown>;
export async function convertPptx(
  bytes: Buffer,
  run: Runner = promisify(execFile),
) {
  const dir = await mkdtemp(join(tmpdir(), "farlands-"));
  try {
    await writeFile(join(dir, "presentation.pptx"), bytes);
    await run(
      process.env.LIBREOFFICE_PATH || "libreoffice",
      [
        `-env:UserInstallation=${pathToFileURL(join(dir, "profile")).href}`,
        "--headless",
        "--convert-to",
        "pdf",
        "--outdir",
        dir,
        join(dir, "presentation.pptx"),
      ],
      {
        timeout: 90000,
        maxBuffer: 1024 * 1024,
        env: {
          NODE_ENV: "production",
          PATH: process.env.PATH,
          HOME: dir,
          TMPDIR: dir,
          LANG: "C.UTF-8",
          SystemRoot: process.env.SystemRoot,
        },
      },
    );
    const pdf = await readFile(join(dir, "presentation.pdf"));
    if (
      pdf.subarray(0, 5).toString() !== "%PDF-" ||
      pdf.length > Number(process.env.MAX_UPLOAD_SIZE_MB || 25) * 1024 * 1024
    )
      throw new Error("Invalid preview");
    return pdf;
  } catch {
    throw new Error(
      "Presentation conversion failed. Retry or contact the event administrator.",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
