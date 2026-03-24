import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { AppRuntimeConfig, DestinationStoreProfile } from "@shopify-web-replicator/shared";

export interface McpRuntimeConfig extends AppRuntimeConfig {
  databasePath: string;
}

function loadDestinationStores(cwd: string): DestinationStoreProfile[] {
  const configPath =
    process.env.REPLICATOR_DESTINATION_STORES_PATH ?? join(cwd, "config/destination-stores.json");

  if (!existsSync(configPath)) {
    return [];
  }

  try {
    const entries = JSON.parse(readFileSync(configPath, "utf8")) as DestinationStoreProfile[];
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

export function getDefaultMcpRuntimeConfig(cwd = process.cwd()): McpRuntimeConfig {
  return {
    themeWorkspacePath: process.env.THEME_WORKSPACE_PATH ?? join(cwd, "packages/theme-workspace"),
    captureRootPath: process.env.REPLICATOR_CAPTURE_ROOT ?? join(cwd, ".data/captures"),
    previewCommand: "shopify theme dev",
    databasePath: process.env.REPLICATOR_DB_PATH ?? join(cwd, ".data", "replicator.db"),
    destinationStores: loadDestinationStores(cwd)
  };
}
