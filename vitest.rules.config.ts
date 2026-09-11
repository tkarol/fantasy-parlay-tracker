import { defineConfig } from "vitest/config";

/**
 * Security-rules tests run against the Firestore emulator, so they live in
 * their own config rather than slowing down `npm test`.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
