// Zips dist/ into dist.zip after a successful build, satisfying
// unit-03-chrome-extension.md's "produces a loadable unpacked extension
// directory / installable zip" Success Criterion. The archive is written with
// Node's built-in zlib (deflate + crc32) instead of shelling out to a system
// `zip` binary, so the build works the same on Windows, macOS, and Linux with
// no extra npm dependency. Only the subset of the ZIP format needed here is
// implemented: deflate-compressed regular files, UTF-8 names, no ZIP64.
import { crc32, deflateRawSync } from "node:zlib";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const UTF8_NAMES_FLAG = 0x0800;
const DEFLATE_METHOD = 8;
const VERSION_NEEDED = 20;

/**
 * Lists regular files under `dir` as forward-slash relative paths, sorted so
 * the archive layout is deterministic.
 * @param {string} dir
 * @param {string} [prefix]
 * @returns {string[]}
 */
export function listFiles(dir, prefix = "") {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const relative = prefix + entry.name;
      return entry.isDirectory()
        ? listFiles(join(dir, entry.name), `${relative}/`)
        : [relative];
    })
    .sort();
}

/**
 * Converts a Date to the MS-DOS time/date pair stored in ZIP headers.
 * @param {Date} date
 */
function toDosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day =
    (Math.max(date.getFullYear() - 1980, 0) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

/**
 * Builds a ZIP archive from in-memory entries.
 * @param {{ name: string, data: Buffer, modified: Date }[]} entries
 * @returns {Buffer}
 */
export function createZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const { name, data, modified } of entries) {
    const nameBytes = Buffer.from(name, "utf8");
    const compressed = deflateRawSync(data);
    const checksum = crc32(data);
    const { time, day } = toDosDateTime(modified);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(VERSION_NEEDED, 4);
    local.writeUInt16LE(UTF8_NAMES_FLAG, 6);
    local.writeUInt16LE(DEFLATE_METHOD, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(VERSION_NEEDED, 4);
    central.writeUInt16LE(VERSION_NEEDED, 6);
    central.writeUInt16LE(UTF8_NAMES_FLAG, 8);
    central.writeUInt16LE(DEFLATE_METHOD, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);

    localParts.push(local, nameBytes, compressed);
    centralParts.push(central, nameBytes);
    offset += local.length + nameBytes.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const distDir = join(root, "dist");
  const zipPath = join(root, "dist.zip");

  if (!existsSync(distDir)) {
    throw new Error(`${distDir} does not exist — run \`vite build\` first.`);
  }

  const entries = listFiles(distDir).map((name) => {
    const path = join(distDir, name);
    return { name, data: readFileSync(path), modified: statSync(path).mtime };
  });
  writeFileSync(zipPath, createZip(entries));
  console.log(`Wrote ${zipPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
