import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    // TODO: component tests in task H-10
    include: ["lib/**/*.test.ts"],
    passWithNoTests: true,
  },
});
