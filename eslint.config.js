// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    rules: {
      // RED-phase stubs intentionally have unimplemented, unused
      // parameters (prefixed with `_`) that document the public API
      // signature ahead of the implementation pass.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ]
    }
  },
  {
    // Node-executed build/dev scripts (e.g. apps/extension/scripts/*.mjs)
    // run outside a bundler, so they need Node's ambient globals
    // (console/process/Buffer/etc) recognized rather than flagged by
    // no-undef, unlike app source (**/*.ts) which runs in a browser/DOM
    // context with no Node globals.
    files: ["**/*.mjs"],
    languageOptions: {
      globals: globals.node
    }
  }
);
