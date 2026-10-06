import { existsSync, readFileSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * CI-visible mirror of scripts/check-bundle-size.mjs's gate (per
 * unit-03-chrome-extension.md's Bundle-size budget: <150 KB gzipped for
 * the side panel's entry JS chunk). The actual hard gate that fails the
 * BUILD lives in scripts/check-bundle-size.mjs, run as part of `npm run
 * build` (see package.json). THIS test requires `dist/` to already exist
 * from a prior build in the same CI step — `npm run build` runs before
 * `npm test` at the root workspace level (see root package.json's script
 * ordering in the quality-gate harness) — so it is skipped, not failed,
 * when `dist/` is absent (e.g. running `vitest` standalone without a
 * preceding build), to avoid a false failure unrelated to the code under
 * test.
 */
const DIST_ASSETS_DIR = join(__dirname, "..", "dist", "assets");
const BUDGET_BYTES = 150 * 1024;

function findEntryChunk(): string | undefined {
  if (!existsSync(DIST_ASSETS_DIR)) {
    return undefined;
  }
  const candidates = readdirSync(DIST_ASSETS_DIR).filter(
    (f) => f.startsWith("sidepanel") && f.endsWith(".js")
  );
  return candidates[0] ? join(DIST_ASSETS_DIR, candidates[0]) : undefined;
}

describe("side panel bundle-size budget", () => {
  const entryPath = findEntryChunk();

  it.skipIf(entryPath === undefined)(
    "entry JS chunk is under 150 KB gzipped",
    () => {
      const raw = readFileSync(entryPath as string);
      const gzipped = gzipSync(raw, { level: 9 });
      expect(gzipped.length).toBeLessThan(BUDGET_BYTES);
    }
  );

  if (entryPath === undefined) {
    console.warn(
      "bundle-size.test.ts: dist/ not found — run `npm run build --workspace " +
        "apps/extension` first for this test to actually check the built bundle. " +
        "The build's own scripts/check-bundle-size.mjs gate always runs regardless."
    );
  }
});
