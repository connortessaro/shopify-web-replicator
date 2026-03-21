import { join } from "node:path";

import type { AppRuntimeConfig } from "@shopify-web-replicator/shared";

export function getDefaultRuntimeConfig(cwd = process.cwd()): AppRuntimeConfig {
  return {
    themeWorkspacePath: process.env.THEME_WORKSPACE_PATH ?? join(cwd, "packages/theme-workspace"),
    previewCommand: "shopify theme dev"
  };
}
