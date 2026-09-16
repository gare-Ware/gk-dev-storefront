import { defineConfig } from "vitest/config";

// Unit tests cover pure modules under lib/. Route components are async Server
// Components, which vitest cannot render; those are covered by Playwright in e2e/.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
