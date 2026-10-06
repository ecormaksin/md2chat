import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json" with { type: "json" };
import { thirdPartyLicenses } from "../../scripts/vite-plugin-third-party-licenses.mjs";

// @crxjs/vite-plugin handles MV3 manifest-driven asset resolution
// (sidepanel.html, icons/) so plain relative paths in manifest.json and
// sidepanel.html "just work" without a separate static-copy step. See
// unit-03-chrome-extension.md → "Build tooling": this was evaluated against
// a manual multi-entry Vite config + vite-plugin-static-copy fallback and
// kept because it built cleanly against this repo's pinned Vite ^5.4.0 (see
// this unit's Notes for the recorded decision).
export default defineConfig({
  plugins: [crx({ manifest }), thirdPartyLicenses()],
  build: {
    outDir: "dist"
  }
});
