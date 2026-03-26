import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type {
  DestinationStoreProfile,
  HydrogenReplicationIntake,
  HydrogenReplicationJobSummary,
  ReferenceIntake,
  ReplicationJob,
  ReplicationJobSummary
} from "@shopify-web-replicator/shared";
import {
  hydrogenReplicationIntakeSchema,
  pageTypes,
  referenceIntakeSchema
} from "@shopify-web-replicator/shared";

import type { ReplicationHandoff, ReplicationOrchestrator } from "@shopify-web-replicator/engine";

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

type ReplicationToolStructuredContent = {
  jobId: string;
  status: ReplicationJob["status"];
  currentStage: ReplicationJob["currentStage"];
  createdAt: string;
  updatedAt: string;
  sourceQualification: ReplicationJob["sourceQualification"];
  capture: ReplicationJob["capture"];
  analysis: ReplicationJob["analysis"];
  mapping: ReplicationJob["mapping"];
  generation: ReplicationJob["generation"];
  storeSetup: ReplicationJob["storeSetup"];
  commerce: ReplicationJob["commerce"];
  integration: ReplicationJob["integration"];
  validation: ReplicationJob["validation"];
  artifacts: ReplicationJob["artifacts"];
  themeWorkspacePath: string;
  captureRootPath: string;
  previewCommand: string;
  destinationStore?: DestinationStoreProfile;
  nextActions: string[];
  error?: ReplicationFailure;
};

type JobLookupStructuredContent = ReplicationJob | { error: NotFoundFailure };

export type ReplicatorMcpAdapter = Pick<
  ReplicationOrchestrator,
  | "replicateStorefront"
  | "enqueueHydrogenReplication"
  | "getJob"
  | "listRecentJobs"
  | "listDestinationStores"
>;

export type ReplicatorMcpHandlers = {
  replicateStorefront: (
    input: ReferenceIntake
  ) => Promise<ToolResult<ReplicationToolStructuredContent>>;
  enqueueHydrogenReplication: (
    input: HydrogenReplicationIntake
  ) => Promise<ToolResult<HydrogenReplicationJobSummary>>;
  getReplicationJob: (
    input: { jobId: string }
  ) => Promise<ToolResult<JobLookupStructuredContent>>;
  listReplicationJobs: (
    input: { limit?: number }
  ) => Promise<ToolResult<ReplicationJobSummary[]>>;
  listDestinationStores: () => Promise<ToolResult<DestinationStoreProfile[]>>;
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

function toStructuredContent(handoff: ReplicationHandoff): ReplicationToolStructuredContent {
  const { job, nextActions, runtime } = handoff;
  const destinationStore = runtime.destinationStores.find((store) => store.id === job.intake.destinationStore);

  return {
    jobId: job.id,
    status: job.status,
    currentStage: job.currentStage,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    sourceQualification: job.sourceQualification,
    capture: job.capture,
    analysis: job.analysis,
    mapping: job.mapping,
    generation: job.generation,
    storeSetup: job.storeSetup,
    commerce: job.commerce,
    integration: job.integration,
    validation: job.validation,
    artifacts: job.artifacts,
    themeWorkspacePath: runtime.themeWorkspacePath,
    captureRootPath: runtime.captureRootPath,
    previewCommand: runtime.previewCommand,
    nextActions,
    ...(destinationStore ? { destinationStore } : {}),
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

export function createReplicatorMcpHandlers(orchestrator: ReplicatorMcpAdapter): ReplicatorMcpHandlers {
  return {
    async replicateStorefront(input: ReferenceIntake) {
      const intake = referenceIntakeSchema.parse(input);
      const handoff = await orchestrator.replicateStorefront(intake);
      const structuredContent = toStructuredContent(handoff);
      const isError = handoff.job.status === "failed";

      return createTextResult(
        `Replication job ${handoff.job.id} finished with status ${handoff.job.status} at stage ${handoff.job.currentStage}.`,
        structuredContent,
        isError
      );
    },

    async enqueueHydrogenReplication(input: HydrogenReplicationIntake) {
      const intake = hydrogenReplicationIntakeSchema.parse(input);
      const created = await orchestrator.enqueueHydrogenReplication(intake);

      return createTextResult(
        `Started Hydrogen replication job ${created.jobId} for ${created.referenceUrl}.`,
        created
      );
    },

    async getReplicationJob({ jobId }: { jobId: string }) {
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
    },

    async listReplicationJobs({ limit }: { limit?: number }) {
      const recentJobs = await orchestrator.listRecentJobs(limit ?? 10);

      return createTextResult(`Loaded ${recentJobs.length} replication job summaries.`, recentJobs);
    },

    async listDestinationStores() {
      const destinationStores = orchestrator.listDestinationStores();

      return createTextResult(
        `Loaded ${destinationStores.length} destination store profiles.`,
        destinationStores
      );
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
    "replicate_site_to_theme",
    {
      title: "Replicate Storefront",
      description:
        "Run the deterministic Shopify replication pipeline for a reference storefront and return a full handoff payload.",
      inputSchema: {
        referenceUrl: z.string().url(),
        destinationStore: z.string().trim().min(1),
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
    "replicate_site_to_hydrogen",
    {
      title: "Replicate Site To Hydrogen",
      description:
        "Create an async Hydrogen replication job from a public ecommerce URL using Playwright discovery plus a Figma handoff stage.",
      inputSchema: {
        referenceUrl: z.string().url(),
        targetId: z.string().trim().min(1),
        targetLabel: z.string().trim().min(1).optional(),
        notes: z.string().trim().min(1).optional(),
        seedRoutes: z.array(z.string().trim().min(1)).max(25).optional()
      }
    },
    async (input) => {
      const result = await handlers.enqueueHydrogenReplication(input);

      return {
        content: result.content,
        structuredContent: toSerializableRecord(result.structuredContent)
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

      return {
        content: result.content,
        structuredContent: {
          jobs: JSON.parse(JSON.stringify(result.structuredContent)) as ReplicationJobSummary[]
        },
        ...(result.isError ? { isError: true as const } : {})
      };
    }
  );

  server.registerTool(
    "list_destination_stores",
    {
      title: "List Destination Stores",
      description: "List configured destination Shopify store profiles available for replication runs.",
      inputSchema: {}
    },
    async () => {
      const result = await handlers.listDestinationStores();

      return {
        content: result.content,
        structuredContent: {
          destinationStores: JSON.parse(JSON.stringify(result.structuredContent)) as DestinationStoreProfile[]
        },
        ...(result.isError ? { isError: true as const } : {})
      };
    }
  );

  return server;
}
