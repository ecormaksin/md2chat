// Bundle-size gate for the side panel's entry JS chunk (per
// unit-03-chrome-extension.md → "Bundle-size budget": the built side-panel
// JS bundle, gzipped, must not exceed 150 KB). Run after `vite build` as
// part of `npm run build` (see package.json's "build" script) so an
// oversized bundle fails the build instead of shipping silently. The same
// check is also asserted in test/bundle-size.test.ts for CI visibility
// under `npm test`, but THAT test requires `dist/` to already exist from a
// prior build in the same CI step — this script is the actual gate that
// runs unconditionally as part of every build.
import { gzipSync } from "node:zlib";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distAssetsDir = join(__dirname, "..", "dist", "assets");

const BUDGET_BYTES = 150 * 1024;

function findEntryChunk() {
  const files = readdirSync(distAssetsDir);
  // The side panel's entry chunk is the JS file @crxjs/vite-plugin/Rollup
  // emits for the sidepanel.html script entry — named "sidepanel*.js" (or,
  // depending on the plugin's internal naming, "sidepanel.html-*.js").
  const candidates = files.filter((f) => f.startsWith("sidepanel") && f.endsWith(".js"));
  if (candidates.length === 0) {
    throw new Error(
      `No sidepanel entry JS chunk found in ${distAssetsDir}. Did \`vite build\` run first?`
    );
  }
  if (candidates.length > 1) {
    throw new Error(
      `Expected exactly one sidepanel entry JS chunk, found: ${candidates.join(", ")}`
    );
  }
  return join(distAssetsDir, candidates[0]);
}

const entryPath = findEntryChunk();
const raw = readFileSync(entryPath);
const gzipped = gzipSync(raw, { level: 9 });

const gzippedKb = (gzipped.length / 1024).toFixed(2);
const budgetKb = (BUDGET_BYTES / 1024).toFixed(0);

if (gzipped.length > BUDGET_BYTES) {
  console.error(
    `BUILD BLOCKED: side panel entry chunk is ${gzippedKb} KB gzipped, ` +
      `exceeding the ${budgetKb} KB budget (see unit-03-chrome-extension.md → ` +
      `Bundle-size budget). See this unit's Notes for the graduated-response ` +
      `record of what was tried.`
  );
  process.exit(1);
}

console.log(
  `Bundle-size gate: ${entryPath.split("/").pop()} is ${gzippedKb} KB gzipped ` +
    `(budget: ${budgetKb} KB) — within budget.`
);
