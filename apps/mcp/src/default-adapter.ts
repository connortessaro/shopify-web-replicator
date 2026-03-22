import type { ReplicatorMcpAdapter } from "./server.js";
import { runRuntimePreflight, toRuntimePreflightError, type RuntimeCheckMode } from "./runtime-preflight.js";
import { getDefaultMcpRuntimeConfig, type McpRuntimeConfig } from "./runtime.js";

type CreateOrchestrator = (
  runtime: McpRuntimeConfig,
  cwd?: string
) => Promise<ReplicatorMcpAdapter>;

type CreateDefaultReplicatorMcpAdapterOptions = {
  cwd?: string;
  runtime?: McpRuntimeConfig;
  runPreflight?: (runtime: McpRuntimeConfig, mode: RuntimeCheckMode) => Promise<void>;
  createOrchestrator?: CreateOrchestrator;
};

async function createEngineOrchestrator(
  runtime: McpRuntimeConfig,
  cwd?: string
): Promise<ReplicatorMcpAdapter> {
  try {
    const { createDefaultReplicationOrchestrator } = await import("@shopify-web-replicator/engine");

    return createDefaultReplicationOrchestrator({
      ...(cwd ? { cwd } : {}),
      databasePath: runtime.databasePath,
      themeWorkspacePath: runtime.themeWorkspacePath
    });
  } catch (error) {
    throw toRuntimePreflightError(error);
  }
}

export function createDefaultReplicatorMcpAdapter(
  options: CreateDefaultReplicatorMcpAdapterOptions = {}
): ReplicatorMcpAdapter {
  const runtime = options.runtime ?? getDefaultMcpRuntimeConfig(options.cwd);
  const runPreflight = options.runPreflight ?? runRuntimePreflight;
  const createOrchestrator = options.createOrchestrator ?? createEngineOrchestrator;
  let orchestratorPromise: Promise<ReplicatorMcpAdapter> | undefined;

  async function loadOrchestrator(): Promise<ReplicatorMcpAdapter> {
    orchestratorPromise ??= createOrchestrator(runtime, options.cwd);
    return orchestratorPromise;
  }

  async function withPreflight<T>(mode: RuntimeCheckMode, action: (adapter: ReplicatorMcpAdapter) => Promise<T>) {
    await runPreflight(runtime, mode);
    const orchestrator = await loadOrchestrator();

    return action(orchestrator);
  }

  return {
    async replicateStorefront(input) {
      return withPreflight("replicate", (orchestrator) => orchestrator.replicateStorefront(input));
    },

    async getJob(jobId) {
      return withPreflight("read", (orchestrator) => orchestrator.getJob(jobId));
    },

    async listRecentJobs(limit) {
      return withPreflight("read", (orchestrator) => orchestrator.listRecentJobs(limit));
    }
  };
}
