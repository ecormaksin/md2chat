import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Grep-verifiable check for unit-02-web-app.md's "No fetch/XMLHttpRequest/
 * WebSocket call exists anywhere in apps/web's source" Success Criterion.
 * apps/web is a purely static, client-side app with no server and no
 * persisted storage (see unit spec → Data Sources) — this test fails the
 * build the moment any network primitive is introduced.
 */

const SRC_DIR = join(__dirname, "..", "src");
const ROOT_HTML = join(__dirname, "..", "index.html");

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
  it("apps/web/src contains no fetch/XMLHttpRequest/WebSocket usage", () => {
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

  it("apps/web/index.html contains no fetch/XMLHttpRequest/WebSocket usage", () => {
    const content = readFileSync(ROOT_HTML, "utf-8");
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(
        pattern.test(content),
        `index.html unexpectedly matched forbidden network pattern ${pattern}`
      ).toBe(false);
    }
  });
});
