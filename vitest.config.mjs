import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Database suites reset the same test branch before each case.
    fileParallelism: false,
  },
});
