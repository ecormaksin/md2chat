import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts"],
    // Running every test file in its own worker thread adds enough CPU
    // contention to push performance-budget.test.ts's wall-clock <100ms
    // assertion over budget, even though renderPreview() itself takes well
    // under that in isolation. Running files sequentially removes the
    // contention without weakening the assertion (same as apps/extension).
    fileParallelism: false
  }
});
