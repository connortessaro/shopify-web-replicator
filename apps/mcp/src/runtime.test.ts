import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { getDefaultMcpRuntimeConfig } from "./runtime";

describe("getDefaultMcpRuntimeConfig", () => {
  const pathsToRemove: string[] = [];
  const destinationStoresEnvBackup = process.env.REPLICATOR_DESTINATION_STORES_PATH;

  afterEach(async () => {
    if (destinationStoresEnvBackup === undefined) {
      delete process.env.REPLICATOR_DESTINATION_STORES_PATH;
    } else {
      process.env.REPLICATOR_DESTINATION_STORES_PATH = destinationStoresEnvBackup;
    }

    await Promise.all(
      pathsToRemove.splice(0).map(async (path) => {
        await rm(path, { recursive: true, force: true });
      })
    );
  });

  it("loads destination stores from the configured override path", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "replicator-mcp-runtime-config-"));
    const destinationStoresPath = join(tempRoot, "destination-stores.json");
    const stores = [
      {
        id: "local-dev-store",
        label: "Local Dev Store",
        shopDomain: "local-dev-store.myshopify.com",
        adminTokenEnvVar: "SHOPIFY_LOCAL_DEV_TOKEN"
      }
    ];

    pathsToRemove.push(tempRoot);
    await writeFile(destinationStoresPath, JSON.stringify(stores), "utf8");
    process.env.REPLICATOR_DESTINATION_STORES_PATH = destinationStoresPath;

    const runtime = getDefaultMcpRuntimeConfig(tempRoot);

    expect(runtime.destinationStores).toEqual(stores);
    expect(runtime.themeWorkspacePath).toBe(join(tempRoot, "packages", "theme-workspace"));
    expect(runtime.databasePath).toBe(join(tempRoot, ".data", "replicator.db"));
    expect(runtime.captureRootPath).toBe(join(tempRoot, ".data", "captures"));
  });

  it("returns an empty destination-store list when override config is invalid JSON", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "replicator-mcp-runtime-config-"));
    const destinationStoresPath = join(tempRoot, "destination-stores.json");

    pathsToRemove.push(tempRoot);
    await writeFile(destinationStoresPath, "{bad json", "utf8");
    process.env.REPLICATOR_DESTINATION_STORES_PATH = destinationStoresPath;

    const runtime = getDefaultMcpRuntimeConfig(tempRoot);

    expect(runtime.destinationStores).toEqual([]);
  });

  it("returns an empty destination-store list when the override file is missing", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "replicator-mcp-runtime-config-"));
    pathsToRemove.push(tempRoot);
    process.env.REPLICATOR_DESTINATION_STORES_PATH = join(tempRoot, "missing.json");

    const runtime = getDefaultMcpRuntimeConfig(tempRoot);

    expect(runtime.destinationStores).toEqual([]);
  });
});

