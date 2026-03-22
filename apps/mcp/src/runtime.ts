import { join } from "node:path";

import type { AppRuntimeConfig } from "@shopify-web-replicator/shared";

export interface McpRuntimeConfig extends AppRuntimeConfig {
  databasePath: string;
}

export function getDefaultMcpRuntimeConfig(cwd = process.cwd()): McpRuntimeConfig {
  return {
    themeWorkspacePath: process.env.THEME_WORKSPACE_PATH ?? join(cwd, "packages/theme-workspace"),
    previewCommand: "shopify theme dev",
    databasePath: process.env.REPLICATOR_DB_PATH ?? join(cwd, ".data", "replicator.db")
  };
}
