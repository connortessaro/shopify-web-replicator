import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { AppRuntimeConfig, DestinationStoreProfile } from "@shopify-web-replicator/shared";

function normalizeDestinationStoreProfiles(value: unknown): DestinationStoreProfile[] {
  if (!Array.isArray(value)) {
    throw new Error("Destination store config must be an array.");
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Destination store entry ${index} must be an object.`);
    }

    const { id, label, shopDomain, themeNamePrefix } = entry as Record<string, unknown>;

    if (typeof id !== "string" || id.trim().length === 0) {
      throw new Error(`Destination store entry ${index} is missing a valid id.`);
    }

    if (typeof label !== "string" || label.trim().length === 0) {
      throw new Error(`Destination store entry ${index} is missing a valid label.`);
    }

    if (typeof shopDomain !== "string" || shopDomain.trim().length === 0) {
      throw new Error(`Destination store entry ${index} is missing a valid shopDomain.`);
    }

    return {
      id: id.trim(),
      label: label.trim(),
      shopDomain: shopDomain.trim(),
      ...(typeof themeNamePrefix === "string" && themeNamePrefix.trim().length > 0
        ? { themeNamePrefix: themeNamePrefix.trim() }
        : {})
    };
  });
}

export function loadDestinationStoreProfiles(cwd = process.cwd()): DestinationStoreProfile[] {
  const configPath =
    process.env.REPLICATOR_DESTINATION_STORES_PATH ?? join(cwd, "config/destination-stores.json");

  if (!existsSync(configPath)) {
    return [];
  }

  return normalizeDestinationStoreProfiles(JSON.parse(readFileSync(configPath, "utf8")) as unknown);
}

export function getDefaultRuntimeConfig(cwd = process.cwd()): AppRuntimeConfig {
  return {
    themeWorkspacePath: process.env.THEME_WORKSPACE_PATH ?? join(cwd, "packages/theme-workspace"),
    captureRootPath: process.env.REPLICATOR_CAPTURE_ROOT ?? join(cwd, ".data/captures"),
    previewCommand: "shopify theme dev",
    destinationStores: loadDestinationStoreProfiles(cwd)
  };
}
