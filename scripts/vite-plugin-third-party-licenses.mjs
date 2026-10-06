// @ts-check
// Vite plugin that emits a license notice file for every third-party npm
// package whose code ends up in the build output. MIT and similar licenses
// require their copyright and permission notice to accompany distributed
// copies, but minification strips most in-source license comments, so the
// notices are collected from each bundled package's own LICENSE file instead.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Matches LICENSE, LICENSE.md, LICENCE.txt, LICENSE-MIT.txt, COPYING, etc.
const LICENSE_FILE_PATTERN = /^(licen[cs]e|copying)([.-][\w.-]+)?$/i;

/**
 * Returns the package root directory for a module id inside node_modules,
 * or undefined for project sources and virtual modules.
 * @param {string} moduleId
 * @returns {string | undefined}
 */
export function packageDirOf(moduleId) {
  if (moduleId.startsWith("\0")) return undefined;
  const path = moduleId.split("?")[0].replace(/\\/g, "/");
  const marker = "/node_modules/";
  const index = path.lastIndexOf(marker);
  if (index === -1) return undefined;
  const segments = path.slice(index + marker.length).split("/");
  const nameLength = segments[0]?.startsWith("@") ? 2 : 1;
  if (segments.length <= nameLength) return undefined;
  return path.slice(0, index + marker.length) + segments.slice(0, nameLength).join("/");
}

/**
 * @param {string} packageDir
 * @returns {string}
 */
function renderNotice(packageDir) {
  const pkg = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
  const licenseFile = readdirSync(packageDir).find((f) => LICENSE_FILE_PATTERN.test(f));
  const text = licenseFile
    ? readFileSync(join(packageDir, licenseFile), "utf8").trim()
    : "(No license file is included in this package.)";
  return [`${pkg.name}@${pkg.version}`, `License: ${pkg.license ?? "UNKNOWN"}`, "", text].join("\n");
}

/**
 * @param {{ fileName?: string }} [options]
 * @returns {import("vite").Plugin}
 */
export function thirdPartyLicenses({ fileName = "THIRD_PARTY_LICENSES.txt" } = {}) {
  return {
    name: "third-party-licenses",
    apply: "build",
    generateBundle(_options, bundle) {
      const packageDirs = new Set();
      for (const output of Object.values(bundle)) {
        if (output.type !== "chunk") continue;
        for (const moduleId of Object.keys(output.modules)) {
          const dir = packageDirOf(moduleId);
          if (dir) packageDirs.add(dir);
        }
      }
      // A Set also drops duplicates of the same name@version installed twice.
      const notices = [...new Set([...packageDirs].map(renderNotice))].sort();
      const header =
        "Third-party software included in this distribution, with the license\n" +
        "notice of each package.";
      this.emitFile({
        type: "asset",
        fileName,
        source: [header, ...notices].join(`\n\n${"=".repeat(72)}\n\n`) + "\n"
      });
    }
  };
}
