import type {
  HydrogenReplicationJob,
  HydrogenReviewResult,
  HydrogenStageName,
  PlaywrightDiscovery
} from "@shopify-web-replicator/shared";

import type { JobRepository } from "../repository/in-memory-job-repository.js";
import type {
  Analyzer,
  CaptureService,
  QualificationService,
  RouteInventoryService
} from "./types.js";
import { BackendInferenceService } from "./backend-inference.js";
import { FigmaStagingService } from "./figma-staging.js";
import { FrontendSpecBuilder } from "./frontend-spec.js";
import { HydrogenWorkspaceGenerator } from "./hydrogen-generator.js";
import { HydrogenWorkspaceValidator } from "./hydrogen-validator.js";
import { PlaywrightDiscoveryService } from "./playwright-discovery.js";

function stage(job: HydrogenReplicationJob, name: HydrogenStageName) {
  const current = (job.stages as Array<{
    name: string;
    status: string;
    summary?: string;
    errorMessage?: string;
    startedAt?: string;
    completedAt?: string;
  }>).find((entry) => entry.name === name);

  if (!current) {
    throw new Error(`Missing hydrogen stage ${name}`);
  }

  return current;
}

function startStage(job: HydrogenReplicationJob, name: HydrogenStageName, timestamp: string, summary: string) {
  const current = stage(job, name);
  current.status = "current";
  current.summary = summary;
  current.startedAt = current.startedAt ?? timestamp;
  delete current.errorMessage;
  job.currentStage = name as never;
}

function completeStage(job: HydrogenReplicationJob, name: HydrogenStageName, timestamp: string, summary: string) {
  const current = stage(job, name);
  current.status = "complete";
  current.summary = summary;
  current.completedAt = timestamp;
  delete current.errorMessage;
}

function failStage(job: HydrogenReplicationJob, name: HydrogenStageName, timestamp: string, message: string) {
  const current = stage(job, name);
  current.status = "failed";
  current.summary = `Failed during ${name.replaceAll("_", " ")}.`;
  current.errorMessage = message;
  current.completedAt = timestamp;
}

function toReview(job: HydrogenReplicationJob, discovery: PlaywrightDiscovery): HydrogenReviewResult {
  const unresolved = job.backendInference?.unresolvedCapabilities ?? [];
  const nextActions = [
    "Review the generated Hydrogen workspace routes, data contracts, and layout decisions.",
    "Connect Storefront API credentials and replace placeholder loaders/actions before deployment.",
    "Complete low-confidence or unsupported backend capabilities listed in the review metadata."
  ];

  if (unresolved.length > 0) {
    nextActions.push(`Resolve unresolved capability areas: ${unresolved.join(", ")}.`);
  }

  return {
    reviewedAt: new Date().toISOString(),
    summary: `Hydrogen replication reached review with ${discovery.routes.length} discovered routes and ${unresolved.length} unresolved backend capability areas.`,
    nextActions
  };
}

type HydrogenReplicationPipelineOptions = {
  repository: JobRepository;
  qualificationService: QualificationService;
  captureService: CaptureService;
  routeInventoryService: RouteInventoryService;
  analyzer?: Analyzer;
  discoveryService: PlaywrightDiscoveryService;
  figmaStagingService: FigmaStagingService;
  frontendSpecBuilder: FrontendSpecBuilder;
  backendInferenceService: BackendInferenceService;
  hydrogenGenerator: HydrogenWorkspaceGenerator;
  hydrogenValidator: HydrogenWorkspaceValidator;
};

export class HydrogenReplicationPipeline {
  readonly #repository: JobRepository;
  readonly #qualificationService: QualificationService;
  readonly #captureService: CaptureService;
  readonly #routeInventoryService: RouteInventoryService;
  readonly #discoveryService: PlaywrightDiscoveryService;
  readonly #figmaStagingService: FigmaStagingService;
  readonly #frontendSpecBuilder: FrontendSpecBuilder;
  readonly #backendInferenceService: BackendInferenceService;
  readonly #hydrogenGenerator: HydrogenWorkspaceGenerator;
  readonly #hydrogenValidator: HydrogenWorkspaceValidator;

  constructor(options: HydrogenReplicationPipelineOptions) {
    this.#repository = options.repository;
    this.#qualificationService = options.qualificationService;
    this.#captureService = options.captureService;
    this.#routeInventoryService = options.routeInventoryService;
    this.#discoveryService = options.discoveryService;
    this.#figmaStagingService = options.figmaStagingService;
    this.#frontendSpecBuilder = options.frontendSpecBuilder;
    this.#backendInferenceService = options.backendInferenceService;
    this.#hydrogenGenerator = options.hydrogenGenerator;
    this.#hydrogenValidator = options.hydrogenValidator;
  }

  async process(jobId: string): Promise<void> {
    const rawJob = await this.#repository.getById(jobId);
    const job = rawJob as HydrogenReplicationJob | undefined;

    if (!job || job.pipelineKind !== "hydrogen") {
      throw new Error(`Missing hydrogen replication job ${jobId}`);
    }

    try {
      const qualification = await this.#qualificationService.qualify({
        jobId: job.id,
        referenceUrl: job.hydrogenIntake.referenceUrl
      });
      job.sourceQualification = qualification;

      if (qualification.status !== "supported") {
        throw new Error(qualification.summary);
      }

      completeStage(job, "source_qualification", qualification.qualifiedAt, qualification.summary);
      startStage(
        job,
        "playwright_discovery",
        qualification.qualifiedAt,
        "Capturing rendered storefront behavior and route signals with Playwright-backed inspection."
      );
      job.updatedAt = qualification.qualifiedAt;
      await this.#repository.save(job);

      const capture = await this.#captureService.capture({
        jobId: job.id,
        referenceUrl: job.hydrogenIntake.referenceUrl
      });
      job.capture = capture;
      const routeInventory = await this.#routeInventoryService.build({
        jobId: job.id,
        referenceUrl: job.hydrogenIntake.referenceUrl
      });
      job.routeInventory = routeInventory;
      const discovery = this.#discoveryService.build({ capture, routeInventory });
      job.playwrightDiscovery = discovery;
      completeStage(job, "playwright_discovery", capture.capturedAt, discovery.summary);
      startStage(
        job,
        "figma_import",
        capture.capturedAt,
        "Preparing Figma MCP import handoff from rendered storefront evidence."
      );
      job.updatedAt = capture.capturedAt;
      await this.#repository.save(job);

      const figmaImport = await this.#figmaStagingService.stage({
        referenceUrl: job.hydrogenIntake.referenceUrl,
        discovery
      });
      job.figmaImport = figmaImport;
      completeStage(job, "figma_import", figmaImport.stagedAt, figmaImport.summary);
      startStage(
        job,
        "figma_design_context",
        figmaImport.stagedAt,
        "Normalizing design context for Hydrogen reconstruction."
      );
      job.updatedAt = figmaImport.stagedAt;
      await this.#repository.save(job);

      completeStage(
        job,
        "figma_design_context",
        figmaImport.stagedAt,
        "Using prepared Figma handoff metadata to refine frontend and route reconstruction."
      );
      startStage(
        job,
        "frontend_spec",
        figmaImport.stagedAt,
        "Building a Hydrogen route and component spec from capture and design signals."
      );
      job.updatedAt = figmaImport.stagedAt;
      await this.#repository.save(job);

      const frontendSpec = this.#frontendSpecBuilder.build({
        capture,
        discovery,
        figmaImport
      });
      job.frontendSpec = frontendSpec;
      completeStage(job, "frontend_spec", frontendSpec.builtAt, frontendSpec.summary);
      startStage(
        job,
        "backend_inference",
        frontendSpec.builtAt,
        "Inferring public-site backend capabilities and handoff gaps."
      );
      job.updatedAt = frontendSpec.builtAt;
      await this.#repository.save(job);

      const backendInference = this.#backendInferenceService.infer({ capture, discovery });
      job.backendInference = backendInference;
      completeStage(job, "backend_inference", backendInference.inferredAt, backendInference.summary);
      startStage(
        job,
        "hydrogen_generation",
        backendInference.inferredAt,
        "Generating a dedicated Hydrogen workspace for the replication target."
      );
      job.updatedAt = backendInference.inferredAt;
      await this.#repository.save(job);

      const { artifacts, generation } = await this.#hydrogenGenerator.generate({
        job,
        discovery,
        frontendSpec,
        backendInference
      });
      job.hydrogenGeneration = generation;
      job.artifacts = artifacts;
      completeStage(job, "hydrogen_generation", generation.generatedAt, generation.summary);
      startStage(
        job,
        "workspace_validation",
        generation.generatedAt,
        "Running structural validation over the generated Hydrogen workspace."
      );
      job.updatedAt = generation.generatedAt;
      await this.#repository.save(job);

      const validation = await this.#hydrogenValidator.validate({
        workspacePath: generation.workspacePath,
        backendInference
      });
      job.hydrogenValidation = validation;
      job.validation = {
        status: validation.status === "failed" ? "failed" : "passed",
        summary: validation.summary,
        checkedAt: validation.checkedAt,
        ...(validation.output ? { output: validation.output } : {})
      };
      completeStage(job, "workspace_validation", validation.checkedAt, validation.summary);
      startStage(job, "review", validation.checkedAt, "Preparing review handoff and next actions.");
      job.updatedAt = validation.checkedAt;
      await this.#repository.save(job);

      const review = toReview(job, discovery);
      job.hydrogenReview = review;
      completeStage(job, "review", review.reviewedAt, review.summary);
      job.currentStage = "review" as never;
      job.status = validation.status === "failed" ? "failed" : "needs_review";
      job.updatedAt = review.reviewedAt;
      await this.#repository.save(job);
    } catch (error) {
      const timestamp = new Date().toISOString();
      const currentStage = String(job.currentStage) as HydrogenStageName;
      failStage(job, currentStage, timestamp, error instanceof Error ? error.message : "Hydrogen replication failed.");
      job.status = "failed";
      job.error = {
        stage: job.currentStage as never,
        message: error instanceof Error ? error.message : "Hydrogen replication failed."
      };
      job.updatedAt = timestamp;
      await this.#repository.save(job);
    }
  }
}
