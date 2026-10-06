import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The build emits dist/THIRD_PARTY_LICENSES.txt so the license notices of
 * bundled npm packages ship with the site (minification strips most in-source
 * notices). Skipped when dist/ is absent. packageDirOf() unit tests live in
 * apps/extension/test/third-party-licenses.test.ts.
 */
const LICENSES_FILE = join(__dirname, "..", "dist", "THIRD_PARTY_LICENSES.txt");

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
