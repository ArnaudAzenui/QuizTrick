import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@frontend": path.resolve(__dirname, "src/frontend"),
      "@backend": path.resolve(__dirname, "src/backend"),
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
});
