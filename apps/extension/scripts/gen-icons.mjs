// One-off icon generator for the MD2Chat extension's icon set
// (16/48/128px, per unit-03-chrome-extension.md's "Icon set exists at the
// required sizes" criterion). Produces an "M" plus down-arrow mark (a common
// Markdown symbol) on the Editorial palette's accent color, with no external image
// tooling dependency — this repo's sandboxed build environment has no
// ImageMagick/PIL available, so the PNGs are constructed by hand from raw
// pixels using only Node's built-in zlib deflate + crc32. This script is a
// one-off dev tool, not part of the build pipeline; its output
// (apps/extension/icons/*.png) is committed directly.
import { deflateSync, crc32 } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "icons");
mkdirSync(outDir, { recursive: true });

// Editorial palette (see .ai-dlc/md-for-slack/design-blueprint.md).
const BG = [0x7a, 0x5a, 0x1e]; // --color-accent
const FG = [0xf8, 0xf7, 0xf4]; // --color-background

// Transparent padding per side, by output size. The 128px icon doubles as the
// Chrome Web Store icon, whose guidelines ask for 96x96 artwork with 16px of
// transparent padding on each side
// (https://developer.chrome.com/docs/webstore/images). The small toolbar
// sizes stay full-bleed so the mark remains legible.
const PADDING = { 16: 0, 48: 0, 128: 16 };

// Logical 16x16 grid: "M" plus a down arrow, drawn as pixel art and scaled by
// nearest-neighbor to whatever output size is requested so all three icon
// sizes render the exact same mark, just scaled. "#" is foreground, "." is
// background, and " " (the four corner cells) is transparent, which softens
// the square's corners.
const ART = [
  " .............. ",
  "................",
  "................",
  "................",
  ".##...##...##...",
  ".###.###...##...",
  ".#######...##...",
  ".##.#.##...##...",
  ".##...##...##...",
  ".##...##.######.",
  ".##...##..####..",
  ".##...##...##...",
  "................",
  "................",
  "................",
  " .............. "
];
const GRID = ART.length;

function cellAt(gx, gy) {
  return ART[gy][gx];
}

function crc32Buf(buf) {
  return crc32(buf) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32Buf(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function renderPng(size, padding) {
  const art = size - padding * 2;
  const raw = Buffer.alloc((1 + size * 4) * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (1 + size * 4);
    raw[rowStart] = 0; // filter type: none
    for (let x = 0; x < size; x += 1) {
      const ax = x - padding;
      const ay = y - padding;
      const px = rowStart + 1 + x * 4;
      if (ax < 0 || ay < 0 || ax >= art || ay >= art) continue; // transparent
      const gx = Math.floor((ax * GRID) / art);
      const gy = Math.floor((ay * GRID) / art);
      const cell = cellAt(gx, gy);
      if (cell === " ") continue; // transparent corner
      const color = cell === "#" ? FG : BG;
      raw[px] = color[0];
      raw[px + 1] = color[1];
      raw[px + 2] = color[2];
      raw[px + 3] = 0xff;
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idatData = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idatData),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

for (const size of [16, 48, 128]) {
  const png = renderPng(size, PADDING[size]);
  const outPath = join(outDir, `icon${size}.png`);
  writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${png.length} bytes)`);
}
