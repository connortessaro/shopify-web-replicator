import { describe, expect, it, vi } from "vitest";

import type { AppRuntimeConfig, ReferenceIntake, ReplicationJob, ReplicationJobSummary } from "@shopify-web-replicator/shared";

import { createDefaultReplicatorMcpAdapter } from "./default-adapter";
import { RuntimePreflightError, type McpRuntimeConfig, type RuntimeCheckMode } from "./runtime-preflight";

function createJob(): ReplicationJob {
  return {
    id: "job_123",
    status: "needs_review",
    currentStage: "review",
    intake: {
      referenceUrl: "https://example.com",
      pageType: "landing_page"
    },
    stages: [],
    artifacts: [],
    validation: {
      status: "passed",
      summary: "Theme check passed."
    },
    createdAt: "2026-03-20T12:00:00.000Z",
    updatedAt: "2026-03-20T12:00:00.000Z"
  };
}

describe("createDefaultReplicatorMcpAdapter", () => {
  const runtime: McpRuntimeConfig = {
    themeWorkspacePath: "/tmp/theme-workspace",
    previewCommand: "shopify theme dev",
    databasePath: "/tmp/replicator.db"
  };

  it("runs preflight before replication and caches the orchestrator instance", async () => {
    const preflight = vi.fn(async (_runtime: McpRuntimeConfig, _mode: RuntimeCheckMode) => undefined);
    const replicateStorefront = vi.fn(async (_input: ReferenceIntake) => ({
      job: createJob(),
      runtime: {
        themeWorkspacePath: runtime.themeWorkspacePath,
        previewCommand: runtime.previewCommand
      } satisfies AppRuntimeConfig,
      nextActions: ["Review generated artifacts."]
    }));
    const getJob = vi.fn(async (_jobId: string) => createJob());
    const listRecentJobs = vi.fn(async (_limit: number) => [
      {
        jobId: "job_123",
        status: "needs_review",
        currentStage: "review",
        createdAt: "2026-03-20T12:00:00.000Z",
        pageType: "landing_page"
      } satisfies ReplicationJobSummary
    ]);
    const createOrchestrator = vi.fn(async () => ({
      replicateStorefront,
      getJob,
      listRecentJobs
    }));
    const adapter = createDefaultReplicatorMcpAdapter({
      runtime,
      runPreflight: preflight,
      createOrchestrator
    });

    await adapter.replicateStorefront({
      referenceUrl: "https://example.com",
      pageType: "landing_page"
    });
    await adapter.getJob("job_123");
    await adapter.listRecentJobs(5);

    expect(preflight).toHaveBeenNthCalledWith(1, runtime, "replicate");
    expect(preflight).toHaveBeenNthCalledWith(2, runtime, "read");
    expect(preflight).toHaveBeenNthCalledWith(3, runtime, "read");
    expect(createOrchestrator).toHaveBeenCalledTimes(1);
    expect(replicateStorefront).toHaveBeenCalledTimes(1);
    expect(getJob).toHaveBeenCalledWith("job_123");
    expect(listRecentJobs).toHaveBeenCalledWith(5);
  });

  it("fails fast when runtime preflight fails before engine loading", async () => {
    const preflightError = new RuntimePreflightError([
      {
        code: "sqlite_unavailable",
        message: "The current Node runtime does not support node:sqlite."
      }
    ]);
    const preflight = vi.fn(async () => {
      throw preflightError;
    });
    const createOrchestrator = vi.fn();
    const adapter = createDefaultReplicatorMcpAdapter({
      runtime,
      runPreflight: preflight,
      createOrchestrator
    });

    await expect(
      adapter.replicateStorefront({
        referenceUrl: "https://example.com",
        pageType: "landing_page"
      })
    ).rejects.toBe(preflightError);
    expect(createOrchestrator).not.toHaveBeenCalled();
  });
});
