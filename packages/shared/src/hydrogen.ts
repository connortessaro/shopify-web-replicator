import { z } from "zod";

import type { ReplicationJob } from "./job.js";

export const hydrogenReplicationIntakeSchema = z.object({
  referenceUrl: z.string().url(),
  targetId: z.string().trim().min(1),
  targetLabel: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).max(1000).optional(),
  seedRoutes: z.array(z.string().trim().min(1)).max(25).optional()
});

export type HydrogenReplicationIntake = z.infer<typeof hydrogenReplicationIntakeSchema>;

export const hydrogenStageNames = [
  "source_qualification",
  "playwright_discovery",
  "figma_import",
  "figma_design_context",
  "frontend_spec",
  "backend_inference",
  "hydrogen_generation",
  "workspace_validation",
  "review"
] as const;

export type HydrogenStageName = (typeof hydrogenStageNames)[number];
export type CapabilityConfidence = "high" | "medium" | "low" | "unsupported";
export type HydrogenValidationStatus = "passed" | "warning" | "failed";
export type FigmaStageStatus = "ready_for_import" | "imported" | "unavailable";

export interface HydrogenRouteCandidate {
  path: string;
  sourceUrl: string;
  kind: "homepage" | "product_page" | "collection_page" | "content_page" | "cart";
  confidence: CapabilityConfidence;
}

export interface HydrogenInteractionCandidate {
  label: string;
  href: string;
  kind: "navigation" | "cta";
}

export interface PlaywrightDiscovery {
  discoveredAt: string;
  summary: string;
  screenshots: {
    desktopPath: string;
    mobilePath: string;
  };
  routes: HydrogenRouteCandidate[];
  interactions: HydrogenInteractionCandidate[];
  observedFeatures: string[];
  networkEndpoints: string[];
}

export interface FigmaImportStage {
  stagedAt: string;
  status: FigmaStageStatus;
  summary: string;
  sourceUrl: string;
  handoffPrompt: string;
  recommendedTools: string[];
  availableTools: string[];
  fileKey?: string;
  nodeId?: string;
  figmaUrl?: string;
  designContextCode?: string;
  designContextFramework?: string;
}

export interface FrontendSpecRoute {
  path: string;
  kind: HydrogenRouteCandidate["kind"];
  component: string;
  sourceUrl: string;
}

export interface FrontendSpec {
  builtAt: string;
  summary: string;
  components: string[];
  routes: FrontendSpecRoute[];
  designTokens: {
    colors: string[];
    fonts: string[];
  };
}

export interface BackendCapability {
  name:
    | "catalog"
    | "content"
    | "cart"
    | "checkout"
    | "search"
    | "forms"
    | "customer_accounts"
    | "subscriptions"
    | "custom_integrations";
  confidence: CapabilityConfidence;
  rationale: string;
}

export interface BackendInferenceReport {
  inferredAt: string;
  summary: string;
  capabilities: BackendCapability[];
  unresolvedCapabilities: string[];
}

export interface HydrogenGenerationResult {
  generatedAt: string;
  workspacePath: string;
  summary: string;
  routesWritten: string[];
  generatedFiles: string[];
}

export interface HydrogenValidationResult {
  checkedAt: string;
  status: HydrogenValidationStatus;
  summary: string;
  output?: string;
}

export interface HydrogenReviewResult {
  reviewedAt: string;
  summary: string;
  nextActions: string[];
}

export interface HydrogenReplicationJobSummary {
  jobId: string;
  pipelineKind: "hydrogen";
  status: string;
  currentStage: string;
  createdAt: string;
  targetId: string;
  referenceUrl: string;
}

export interface HydrogenReplicationJob extends ReplicationJob {
  pipelineKind: "hydrogen";
  hydrogenIntake: HydrogenReplicationIntake;
  playwrightDiscovery?: PlaywrightDiscovery;
  figmaImport?: FigmaImportStage;
  frontendSpec?: FrontendSpec;
  backendInference?: BackendInferenceReport;
  hydrogenGeneration?: HydrogenGenerationResult;
  hydrogenValidation?: HydrogenValidationResult;
  hydrogenReview?: HydrogenReviewResult;
}

function toHydrogenStageList(now: string) {
  return hydrogenStageNames.map((name, index) => ({
    name,
    status: index === 0 ? "current" : "pending",
    startedAt: index === 0 ? now : undefined
  }));
}

function generateHydrogenJobId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createHydrogenReplicationJob(
  intake: HydrogenReplicationIntake
): HydrogenReplicationJob {
  const now = new Date().toISOString();
  const workspaceArtifactPath = `${sanitizeTargetId(intake.targetId)}/.replicator/hydrogen-generation.json`;

  return {
    id: `hydrogen-${generateHydrogenJobId()}`,
    pipelineKind: "hydrogen",
    hydrogenIntake: intake,
    intake: {
      referenceUrl: intake.referenceUrl,
      destinationStore: intake.targetId,
      pageType: "landing_page",
      ...(intake.notes ? { notes: intake.notes } : {})
    },
    status: "in_progress",
    currentStage: "source_qualification",
    stages: toHydrogenStageList(now),
    artifacts: [
      {
        kind: "config",
        path: workspaceArtifactPath,
        status: "pending",
        description: "Hydrogen workspace generation metadata and route inventory"
      }
    ],
    validation: {
      status: "pending",
      summary: "Hydrogen workspace validation has not started yet.",
      checkedAt: now
    },
    createdAt: now,
    updatedAt: now
  } as unknown as HydrogenReplicationJob;
}

export function createHydrogenReplicationJobSummary(
  job: HydrogenReplicationJob
): HydrogenReplicationJobSummary {
  return {
    jobId: job.id,
    pipelineKind: "hydrogen",
    status: job.status,
    currentStage: String(job.currentStage),
    createdAt: job.createdAt,
    targetId: job.hydrogenIntake.targetId,
    referenceUrl: job.hydrogenIntake.referenceUrl
  };
}

export function sanitizeTargetId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "") || "replicated-site";
}
