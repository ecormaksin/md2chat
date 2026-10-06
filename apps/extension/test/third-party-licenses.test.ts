import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { packageDirOf } from "../../../scripts/vite-plugin-third-party-licenses.mjs";

/**
 * The build emits dist/THIRD_PARTY_LICENSES.txt so the license notices of
 * bundled npm packages ship with the extension (minification strips most
 * in-source notices). The dist check is skipped when dist/ is absent, as in
 * bundle-size.test.ts.
 */
const LICENSES_FILE = join(__dirname, "..", "dist", "THIRD_PARTY_LICENSES.txt");

describe("packageDirOf", () => {
  it.each([
    ["/repo/node_modules/remark/index.js", "/repo/node_modules/remark"],
    ["/repo/node_modules/@scope/pkg/lib/a.js", "/repo/node_modules/@scope/pkg"],
    ["/repo/node_modules/a/node_modules/b/x.js", "/repo/node_modules/a/node_modules/b"],
    ["C:\\repo\\node_modules\\dompurify\\dist\\purify.es.mjs", "C:/repo/node_modules/dompurify"],
    ["/repo/node_modules/pkg/index.js?commonjs-proxy", "/repo/node_modules/pkg"]
  ])("maps %s to its package root", (moduleId, expected) => {
    expect(packageDirOf(moduleId)).toBe(expected);
  });

  it.each([
    "/repo/packages/core/dist/index.js",
    "\0vite/preload-helper.js"
  ])("ignores non-package module %s", (moduleId) => {
    expect(packageDirOf(moduleId)).toBeUndefined();
  });
});

describe("dist/THIRD_PARTY_LICENSES.txt", () => {
  it.skipIf(!existsSync(LICENSES_FILE))(
    "lists bundled packages with their license text",
    () => {
      const text = readFileSync(LICENSES_FILE, "utf8");
      expect(text).toMatch(/^remark@\d/m);
      expect(text).toMatch(/^dompurify@\d/m);
      expect(text).not.toContain("No license file");
    }
  );
});
