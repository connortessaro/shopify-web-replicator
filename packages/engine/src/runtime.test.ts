import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { getDefaultRuntimeConfig } from "./runtime";

describe("runtime config", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    delete process.env.REPLICATOR_DESTINATION_STORES_PATH;
    delete process.env.REPLICATOR_CAPTURE_ROOT;
    await Promise.all(tempDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
    tempDirectories.length = 0;
  });

  it("loads destination store profiles from config and includes a capture root path", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "shopify-web-replicator-runtime-"));
    const configRoot = join(cwd, "config");
    tempDirectories.push(cwd);

    await mkdir(configRoot, { recursive: true });
    await writeFile(
      join(configRoot, "destination-stores.json"),
      JSON.stringify([
        {
          id: "local-dev-store",
          label: "Local Dev Store",
          shopDomain: "local-dev-store.myshopify.com",
          adminTokenEnvVar: "SHOPIFY_LOCAL_DEV_TOKEN",
          apiVersion: "2025-10",
          themeNamePrefix: "Replicator"
        }
      ]),
      { encoding: "utf8" }
    );

    const runtime = getDefaultRuntimeConfig(cwd);

    expect(runtime.captureRootPath).toBe(join(cwd, ".data/captures"));
    expect(runtime.destinationStores).toEqual([
      {
        id: "local-dev-store",
        label: "Local Dev Store",
        shopDomain: "local-dev-store.myshopify.com",
        adminTokenEnvVar: "SHOPIFY_LOCAL_DEV_TOKEN",
        apiVersion: "2025-10",
        themeNamePrefix: "Replicator"
      }
    ]);
  });

  it("respects a custom capture root override", () => {
    process.env.REPLICATOR_CAPTURE_ROOT = "/tmp/custom-captures";

    const runtime = getDefaultRuntimeConfig("/tmp/replicator");

    expect(runtime.captureRootPath).toBe("/tmp/custom-captures");
  });
});
