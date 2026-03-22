import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type {
  ReferenceIntake,
  ReplicationJob,
  ReplicationJobSummary
} from "@shopify-web-replicator/shared";
import { pageTypes, referenceIntakeSchema } from "@shopify-web-replicator/shared";

import type { ReplicationHandoff, ReplicationOrchestrator } from "@shopify-web-replicator/engine";
import {
  RuntimePreflightError,
  type RuntimePreflightIssue
} from "./runtime-preflight.js";

type ToolTextContent = {
  type: "text";
  text: string;
};

type ToolResult<TStructuredContent> = {
  content: ToolTextContent[];
  structuredContent: TStructuredContent;
  isError?: boolean;
};

type ReplicationFailure = {
  code: "replication_failed";
  message: string;
  stage: ReplicationJob["currentStage"];
};

type NotFoundFailure = {
  code: "job_not_found";
  message: string;
};

type RuntimePreflightFailure = {
  code: "runtime_preflight_failed";
  message: string;
  issues: RuntimePreflightIssue[];
};

type ReplicationToolSuccessStructuredContent = {
  jobId: string;
  status: ReplicationJob["status"];
  currentStage: ReplicationJob["currentStage"];
  createdAt: string;
  updatedAt: string;
  analysis: ReplicationJob["analysis"];
  mapping: ReplicationJob["mapping"];
  generation: ReplicationJob["generation"];
  storeSetup: ReplicationJob["storeSetup"];
  commerce: ReplicationJob["commerce"];
  integration: ReplicationJob["integration"];
  validation: ReplicationJob["validation"];
  artifacts: ReplicationJob["artifacts"];
  themeWorkspacePath: string;
  previewCommand: string;
  nextActions: string[];
  error?: ReplicationFailure;
};

type ReplicationToolStructuredContent =
  | ReplicationToolSuccessStructuredContent
  | { error: RuntimePreflightFailure };

type JobLookupStructuredContent =
  | ReplicationJob
  | { error: NotFoundFailure | RuntimePreflightFailure };
type JobListStructuredContent =
  | ReplicationJobSummary[]
  | { error: RuntimePreflightFailure };

export type ReplicatorMcpAdapter = Pick<
  ReplicationOrchestrator,
  "replicateStorefront" | "getJob" | "listRecentJobs"
>;

export type ReplicatorMcpHandlers = {
  replicateStorefront: (
    input: ReferenceIntake
  ) => Promise<ToolResult<ReplicationToolStructuredContent>>;
  getReplicationJob: (
    input: { jobId: string }
  ) => Promise<ToolResult<JobLookupStructuredContent>>;
  listReplicationJobs: (
    input: { limit?: number }
  ) => Promise<ToolResult<JobListStructuredContent>>;
};

function createTextResult<TStructuredContent>(
  text: string,
  structuredContent: TStructuredContent,
  isError = false
): ToolResult<TStructuredContent> {
  return {
    content: [{ type: "text", text }],
    structuredContent,
    ...(isError ? { isError: true as const } : {})
  };
}

function toSerializableRecord(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function toStructuredContent(handoff: ReplicationHandoff): ReplicationToolSuccessStructuredContent {
  const { job, nextActions, runtime } = handoff;

  return {
    jobId: job.id,
    status: job.status,
    currentStage: job.currentStage,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    analysis: job.analysis,
    mapping: job.mapping,
    generation: job.generation,
    storeSetup: job.storeSetup,
    commerce: job.commerce,
    integration: job.integration,
    validation: job.validation,
    artifacts: job.artifacts,
    themeWorkspacePath: runtime.themeWorkspacePath,
    previewCommand: runtime.previewCommand,
    nextActions,
    ...(job.error
      ? {
          error: {
            code: "replication_failed" as const,
            message: job.error.message,
            stage: job.error.stage
          }
        }
      : {})
  };
}

function toRuntimePreflightFailure(error: RuntimePreflightError): RuntimePreflightFailure {
  return {
    code: "runtime_preflight_failed",
    message: error.message,
    issues: error.issues
  };
}

export function createReplicatorMcpHandlers(orchestrator: ReplicatorMcpAdapter): ReplicatorMcpHandlers {
  return {
    async replicateStorefront(input: ReferenceIntake) {
      try {
        const intake = referenceIntakeSchema.parse(input);
        const handoff = await orchestrator.replicateStorefront(intake);
        const structuredContent = toStructuredContent(handoff);
        const isError = handoff.job.status === "failed";

        return createTextResult(
          `Replication job ${handoff.job.id} finished with status ${handoff.job.status} at stage ${handoff.job.currentStage}.`,
          structuredContent,
          isError
        );
      } catch (error) {
        if (error instanceof RuntimePreflightError) {
          return createTextResult(
            `Runtime preflight failed. ${error.issues.map((issue) => issue.message).join(" ")}`,
            { error: toRuntimePreflightFailure(error) },
            true
          );
        }

        throw error;
      }
    },

    async getReplicationJob({ jobId }: { jobId: string }) {
      try {
        const job = await orchestrator.getJob(jobId);

        if (!job) {
          return createTextResult(
            `Replication job ${jobId} was not found.`,
            {
              error: {
                code: "job_not_found",
                message: `Replication job ${jobId} was not found.`
              }
            },
            true
          );
        }

        return createTextResult(
          `Loaded replication job ${job.id} with status ${job.status} at stage ${job.currentStage}.`,
          job
        );
      } catch (error) {
        if (error instanceof RuntimePreflightError) {
          return createTextResult(
            `Runtime preflight failed. ${error.issues.map((issue) => issue.message).join(" ")}`,
            { error: toRuntimePreflightFailure(error) },
            true
          );
        }

        throw error;
      }
    },

    async listReplicationJobs({ limit }: { limit?: number }) {
      try {
        const recentJobs = await orchestrator.listRecentJobs(limit ?? 10);

        return createTextResult(`Loaded ${recentJobs.length} replication job summaries.`, recentJobs);
      } catch (error) {
        if (error instanceof RuntimePreflightError) {
          return createTextResult(
            `Runtime preflight failed. ${error.issues.map((issue) => issue.message).join(" ")}`,
            { error: toRuntimePreflightFailure(error) },
            true
          );
        }

        throw error;
      }
    }
  };
}

export function createReplicatorMcpServer(orchestrator: ReplicatorMcpAdapter): McpServer {
  const server = new McpServer({
    name: "shopify-web-replicator",
    version: "0.0.0"
  });
  const handlers = createReplicatorMcpHandlers(orchestrator);

  server.registerTool(
    "replicate_storefront",
    {
      title: "Replicate Storefront",
      description:
        "Run the deterministic Shopify replication pipeline for a reference storefront and return a full handoff payload.",
      inputSchema: {
        referenceUrl: z.string().url(),
        pageType: z.enum(pageTypes).optional(),
        notes: z.string().trim().min(1).optional()
      }
    },
    async (input) => {
      const result = await handlers.replicateStorefront(input);

      return {
        content: result.content,
        structuredContent: toSerializableRecord(result.structuredContent),
        ...(result.isError ? { isError: true as const } : {})
      };
    }
  );

  server.registerTool(
    "get_replication_job",
    {
      title: "Get Replication Job",
      description: "Load a previously created replication job by id.",
      inputSchema: {
        jobId: z.string().min(1)
      }
    },
    async ({ jobId }) => {
      const result = await handlers.getReplicationJob({ jobId });

      return {
        content: result.content,
        structuredContent: toSerializableRecord(result.structuredContent),
        ...(result.isError ? { isError: true as const } : {})
      };
    }
  );

  server.registerTool(
    "list_replication_jobs",
    {
      title: "List Replication Jobs",
      description: "List recent replication jobs, newest first.",
      inputSchema: {
        limit: z.number().int().min(1).max(50).optional()
      }
    },
    async ({ limit }) => {
      const result = await handlers.listReplicationJobs(limit === undefined ? {} : { limit });
      const structuredContent = Array.isArray(result.structuredContent)
        ? {
            jobs: JSON.parse(JSON.stringify(result.structuredContent)) as ReplicationJobSummary[]
          }
        : toSerializableRecord(result.structuredContent);

      return {
        content: result.content,
        structuredContent,
        ...(result.isError ? { isError: true as const } : {})
      };
    }
  );

  return server;
}
