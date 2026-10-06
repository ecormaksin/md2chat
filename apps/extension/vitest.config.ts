import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts"],
    // This app's test suite is larger than apps/web's (extension-specific
    // manifest/bundle-size/cross-surface-parity tests in addition to the
    // mirrored suite — see test/*.test.ts header comments), and running
    // every file in its own worker thread introduces enough JIT-warmup/CPU
    // contention jitter to make performance-budget.test.ts's wall-clock
    // <100ms assertion flaky under parallel execution, even though the
    // underlying renderPreview() call is measured at ~60ms in isolation
    // (identical to apps/web's, since both call the same @md2chat/core
    // convert()). Running test files sequentially removes that contention
    // without weakening the assertion itself.
    fileParallelism: false
  }
});
