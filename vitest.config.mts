import { defineConfig } from "vitest/config";
import { resolve } from "path";

/**
 * Vitest configuration.
 *
 * Two test environments:
 *  - "unit"        (default) — fast, no real DB, mocks allowed
 *  - "integration" — real MongoDB replica set required (docker-compose up -d mongo)
 *
 * Run unit tests:
 *   npm test                    (or npx vitest)
 *
 * Run integration tests (requires running Mongo replica set):
 *   npm run test:integration
 */
export default defineConfig({
  test: {
    // Path alias so @/lib/... works in test files
    alias: {
      "@": resolve(import.meta.dirname, "."),
    },

    // Environment: node (not jsdom) for server-side code
    environment: "node",

    // Globals (describe, it, expect) without importing — matches Vitest defaults
    globals: true,

    // Run tests with isolated environment
    pool: "forks",

    // Coverage with v8 (fast, no instrumentation overhead)
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      exclude: [
        "node_modules/**",
        ".next/**",
        "**/*.d.ts",
        "**/index.ts",
        "scripts/**",
        "app/**/*.tsx",        // UI components tested via E2E
        "components/**/*.tsx", // UI components tested via E2E
      ],
    },

    // Include patterns
    include: [
      "lib/**/*.test.ts",
      "lib/**/*.spec.ts",
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
      "modules/**/*.test.ts",
      "modules/**/*.spec.ts",
    ],

    // Exclude integration tests from default run
    exclude: [
      "node_modules/**",
      ".next/**",
      "**/*.integration.test.ts",
      "**/*.e2e.test.ts",
    ],

    // Test timeout (unit tests should be fast)
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
});
