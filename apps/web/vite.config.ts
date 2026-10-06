import { defineConfig } from "vite";
import { thirdPartyLicenses } from "../../scripts/vite-plugin-third-party-licenses.mjs";

// Relative base path: keeps the build deployable from either a GitHub Pages
// user/org page (served at the domain root) or a project page (served from
// a /<repo>/ subpath) without hardcoding a repository name here.
export default defineConfig({
  base: "./",
  plugins: [thirdPartyLicenses()],
  build: {
    outDir: "dist"
  }
});
