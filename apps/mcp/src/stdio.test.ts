import { execFile } from "node:child_process";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const packageRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(packageRoot, "..", "..", "..");
const themeWorkspaceFixturePath = join(repoRoot, "packages", "theme-workspace");
const builtServerPath = join(repoRoot, "apps", "mcp", "dist", "index.js");

async function runBuild(command: string[]): Promise<void> {
  await execFileAsync(command[0]!, command.slice(1), {
    cwd: repoRoot,
    env: process.env
  });
}

function buildEnv(overrides: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries({
      ...process.env,
      ...overrides
    }).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

describe("MCP stdio smoke test", () => {
  const pathsToRemove: string[] = [];

  afterEach(async () => {
    await Promise.all(
      pathsToRemove.splice(0).map(async (path) => {
        await rm(path, { recursive: true, force: true });
      })
    );
  });

  it(
    "builds the MCP server and exercises the five exposed tools over stdio",
    async () => {
      await runBuild(["pnpm", "--filter", "@shopify-web-replicator/shared", "build"]);
      await runBuild(["pnpm", "--filter", "@shopify-web-replicator/engine", "build"]);
      await runBuild(["pnpm", "--filter", "@shopify-web-replicator/mcp", "build"]);

      const tempRoot = await mkdtemp(join(tmpdir(), "replicator-mcp-"));
      const themeWorkspacePath = join(tempRoot, "theme-workspace");
      const databasePath = join(tempRoot, ".data", "replicator.db");
      const destinationStoresPath = join(tempRoot, "destination-stores.json");

      pathsToRemove.push(tempRoot);

      await cp(themeWorkspaceFixturePath, themeWorkspacePath, { recursive: true });
      await writeFile(
        destinationStoresPath,
        JSON.stringify([
          {
            id: "local-dev-store",
            label: "Local Dev Store",
            shopDomain: "local-dev-store.myshopify.com",
            adminTokenEnvVar: "SHOPIFY_LOCAL_DEV_TOKEN"
          }
        ]),
        "utf8"
      );

      const transport = new StdioClientTransport({
        command: "node",
        args: [builtServerPath],
        cwd: repoRoot,
        env: buildEnv({
          THEME_WORKSPACE_PATH: themeWorkspacePath,
          REPLICATOR_DB_PATH: databasePath,
          REPLICATOR_DESTINATION_STORES_PATH: destinationStoresPath,
          SHOPIFY_LOCAL_DEV_TOKEN: "test-token"
        }),
        stderr: "pipe"
      });
      const client = new Client(
        {
          name: "shopify-web-replicator-test-client",
          version: "0.0.0"
        },
        {
          capabilities: {}
        }
      );

      try {
        await client.connect(transport);

        const listedTools = await client.listTools();
        const toolNames = listedTools.tools.map((tool) => tool.name);

        expect(toolNames).toEqual([
          "replicate_site_to_theme",
          "replicate_site_to_hydrogen",
          "get_replication_job",
          "list_replication_jobs",
          "list_destination_stores"
        ]);

        const replicateResult = await client.callTool({
          name: "replicate_site_to_theme",
          arguments: {
            destinationStore: "local-dev-store",
            referenceUrl: "https://example.com/products/spring-launch",
            pageType: "product_page",
            notes: "Focus on the generated purchase flow."
          }
        });
        const replicateStructuredContent = replicateResult.structuredContent as
          | Record<string, unknown>
          | undefined;
        const jobId = replicateStructuredContent?.jobId;

        if (replicateResult.isError) {
          expect(replicateStructuredContent).toHaveProperty("error");
        } else {
          expect(replicateStructuredContent?.status).toBe("needs_review");
          expect(replicateStructuredContent?.currentStage).toBe("review");
          expect(typeof jobId).toBe("string");

          const getJobResult = await client.callTool({
            name: "get_replication_job",
            arguments: {
              jobId
            }
          });
          const listJobsResult = await client.callTool({
            name: "list_replication_jobs",
            arguments: {
              limit: 1
            }
          });
          const getJobStructuredContent = getJobResult.structuredContent as
            | Record<string, unknown>
            | undefined;
          const listJobsStructuredContent = listJobsResult.structuredContent as
            | { jobs?: Array<Record<string, unknown>> }
            | undefined;

          expect(getJobResult.isError).not.toBe(true);
          expect(getJobStructuredContent?.id).toBe(jobId);
          expect(listJobsResult.isError).not.toBe(true);
          expect(listJobsStructuredContent?.jobs?.[0]?.jobId).toBe(jobId);
        }
      } finally {
        await transport.close();
      }
    },
    90_000
  );
});
