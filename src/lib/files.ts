import yauzl from "yauzl";
import { PDF, PPTX } from "./validation";
export async function detectPresentation(buffer: Buffer, maxBytes: number) {
  if (!buffer.length || buffer.length > maxBytes)
    throw new Error("File exceeds the upload limit.");
  if (
    buffer.subarray(0, 5).toString() === "%PDF-" &&
    buffer.subarray(-2048).includes(Buffer.from("%%EOF"))
  )
    return PDF;
  if (buffer.length < 4 || buffer.readUInt16LE(0) !== 0x4b50)
    throw new Error("Upload a valid PDF or PPTX.");
  await new Promise<void>((resolve, reject) =>
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(new Error("Invalid PPTX."));
      let count = 0,
        size = 0;
      const names = new Set<string>();
      let stopped = false;
      const fail = () => {
        if (!stopped) {
          stopped = true;
          zip.close();
          reject(new Error("Unsafe or invalid PPTX."));
        }
      };
      zip.on("error", fail);
      zip.on("entry", (entry) => {
        count++;
        size += entry.uncompressedSize;
        if (
          count > 10000 ||
          size > 200 * 1024 * 1024 ||
          entry.fileName.includes("..") ||
          entry.fileName.startsWith("/") ||
          /vbaProject|\.exe$/i.test(entry.fileName) ||
          entry.generalPurposeBitFlag & 1
        )
          return fail();
        names.add(entry.fileName);
        zip.readEntry();
      });
      zip.on("end", () => {
        if (stopped) return;
        if (
          !names.has("[Content_Types].xml") ||
          !names.has("ppt/presentation.xml") ||
          !names.has("_rels/.rels")
        )
          return fail();
        resolve();
      });
      zip.readEntry();
    }),
  );
  return PPTX;
}
