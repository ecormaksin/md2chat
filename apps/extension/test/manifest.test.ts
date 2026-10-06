import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Mechanically pins unit-03-chrome-extension.md's minimal-permission
 * Success Criterion so a later edit can't silently widen the permission
 * set — see this unit's Risks: "Over-broad permissions creeping in 'just
 * in case.'"
 */
const MANIFEST_PATH = join(__dirname, "..", "manifest.json");

describe("manifest.json permissions", () => {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8")) as Record<string, unknown>;

  it("declares exactly the sidePanel + clipboardWrite permissions, nothing more", () => {
    expect(manifest.permissions).toEqual(
      expect.arrayContaining(["sidePanel", "clipboardWrite"])
    );
    expect((manifest.permissions as string[]).length).toBe(2);
  });

  it("declares no host_permissions", () => {
    expect(manifest.host_permissions).toBeUndefined();
  });

  it("declares no activeTab permission", () => {
    expect((manifest.permissions as string[]).includes("activeTab")).toBe(false);
  });

  it("declares no background service worker", () => {
    expect(manifest.background).toBeUndefined();
  });

  it("is a manifest_version 3 extension using chrome.sidePanel as its primary surface", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.side_panel).toEqual({ default_path: "sidepanel.html" });
  });

  it("declares an icon set at 16/48/128px", () => {
    expect(manifest.icons).toEqual({
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    });
  });
});
