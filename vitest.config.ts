import path from "node:path";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(root, "src"),
    },
  },
  test: {
    // Playwright specs live in e2e/ and stale git worktrees in .worktrees/.
    exclude: [...configDefaults.exclude, "e2e/**", ".worktrees/**"],
  },
});
