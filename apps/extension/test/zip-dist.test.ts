import { crc32, inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { createZip } from "../scripts/zip-dist.mjs";

/**
 * scripts/zip-dist.mjs writes dist.zip with Node's zlib instead of a system
 * `zip` binary so the build also works on Windows. These tests read the
 * archive back through its central directory, as unzip tools do.
 */
interface ReadEntry {
  name: string;
  data: Buffer;
  storedCrc: number;
}

function readZip(zip: Buffer): ReadEntry[] {
  const end = zip.length - 22;
  expect(zip.readUInt32LE(end)).toBe(0x06054b50);
  const count = zip.readUInt16LE(end + 10);
  let cursor = zip.readUInt32LE(end + 16);
  const entries: ReadEntry[] = [];
  for (let i = 0; i < count; i += 1) {
    expect(zip.readUInt32LE(cursor)).toBe(0x02014b50);
    const compressedSize = zip.readUInt32LE(cursor + 20);
    const nameLength = zip.readUInt16LE(cursor + 28);
    const localOffset = zip.readUInt32LE(cursor + 42);
    const name = zip.toString("utf8", cursor + 46, cursor + 46 + nameLength);
    const dataStart = localOffset + 30 + zip.readUInt16LE(localOffset + 26);
    const data = inflateRawSync(zip.subarray(dataStart, dataStart + compressedSize));
    entries.push({ name, data, storedCrc: zip.readUInt32LE(cursor + 16) });
    cursor += 46 + nameLength;
  }
  return entries;
}

describe("createZip", () => {
  const modified = new Date(2026, 9, 4, 12, 30, 0);

  it("round-trips file names and contents, including nested and UTF-8 names", () => {
    const input = [
      { name: "manifest.json", data: Buffer.from('{"name":"x"}'), modified },
      { name: "assets/app.js", data: Buffer.from("console.log(1);\n".repeat(100)), modified },
      { name: "icons/日本語.png", data: Buffer.from([0, 1, 2, 255]), modified }
    ];
    const entries = readZip(createZip(input));
    expect(entries.map((e) => e.name)).toEqual(input.map((e) => e.name));
    entries.forEach((entry, i) => {
      expect(entry.data.equals(input[i]!.data)).toBe(true);
      expect(entry.storedCrc).toBe(crc32(input[i]!.data));
    });
  });

  it("produces a valid empty archive", () => {
    expect(readZip(createZip([]))).toEqual([]);
  });
});
