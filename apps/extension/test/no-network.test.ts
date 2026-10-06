import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Grep-verifiable check for unit-03-chrome-extension.md's "No fetch/
 * XMLHttpRequest/WebSocket call exists anywhere in apps/extension's source"
 * Success Criterion, and the intent-level "no network calls" guarantee this
 * unit's privacy-policy document (store-assets/privacy-policy.md) depends
 * on. See apps/web/test/no-network.test.ts for the pattern this mirrors.
 */

const SRC_DIR = join(__dirname, "..", "src");
const ROOT_HTML = join(__dirname, "..", "sidepanel.html");
const MANIFEST_JSON = join(__dirname, "..", "manifest.json");

const FORBIDDEN_PATTERNS: RegExp[] = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bnew\s+WebSocket\s*\(/
];

function collectFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else if (/\.(ts|tsx|html)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("no network calls", () => {
  it("apps/extension/src contains no fetch/XMLHttpRequest/WebSocket usage", () => {
    const files = collectFiles(SRC_DIR);
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(
          pattern.test(content),
          `${file} unexpectedly matched forbidden network pattern ${pattern}`
        ).toBe(false);
      }
    }
  });

  it("apps/extension/sidepanel.html contains no fetch/XMLHttpRequest/WebSocket usage", () => {
    const content = readFileSync(ROOT_HTML, "utf-8");
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(
        pattern.test(content),
        `sidepanel.html unexpectedly matched forbidden network pattern ${pattern}`
      ).toBe(false);
    }
  });

  it("manifest.json declares no host_permissions", () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_JSON, "utf-8")) as Record<string, unknown>;
    expect(manifest.host_permissions).toBeUndefined();
  });
});
