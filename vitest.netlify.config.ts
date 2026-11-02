import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/netlify.integration.ts"],
    environment: "node",
    fileParallelism: false,
  },
});
