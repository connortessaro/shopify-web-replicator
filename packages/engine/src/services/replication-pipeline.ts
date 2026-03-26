import type {
  PipelineStage,
  ReplicationJob
} from "@shopify-web-replicator/shared";
import {
  stableCommerceArtifact,
  stableIntegrationArtifact,
  stableStoreSetupArtifact
} from "@shopify-web-replicator/shared";

import type { JobRepository } from "../repository/in-memory-job-repository.js";
import type {
  AdminReplicationService,
  Analyzer,
  AssetSyncService,
  CaptureService,
  CommerceGenerator,
  Generator,
  IntegrationGenerator,
  Mapper,
  ParityAuditorService,
  QualificationService,
  RouteInventoryService,
  StorefrontModelBuilderService,
  StoreSetupGenerator,
  ThemeValidator
} from "./types.js";
import type { AppRuntimeConfig, DestinationStoreProfile } from "@shopify-web-replicator/shared";

type ReplicationPipelineOptions = {
  repository: JobRepository;
  runtime: AppRuntimeConfig;
  qualificationService: QualificationService;
  captureService: CaptureService;
  routeInventoryService: RouteInventoryService;
  storefrontModelBuilder: StorefrontModelBuilderService;
  analyzer: Analyzer;
  mapper: Mapper;
  generator: Generator;
  assetSyncService: AssetSyncService;
  storeSetupGenerator: StoreSetupGenerator;
  commerceGenerator: CommerceGenerator;
  adminReplicationService?: AdminReplicationService;
  themeValidator: ThemeValidator;
  parityAuditor?: ParityAuditorService;
  integrationGenerator: IntegrationGenerator;
};

function findStage(job: ReplicationJob, stageName: PipelineStage) {
  const stage = job.stages.find((entry) => entry.name === stageName);
  if (!stage) throw new Error(`Missing stage ${stageName}`);
  return stage;
}

function completeStage(job: ReplicationJob, stageName: PipelineStage, timestamp: string, summary: string): void {
  const stage = findStage(job, stageName);
  stage.status = "complete";
  stage.summary = summary;
  delete stage.errorMessage;
  stage.completedAt = timestamp;
}

function startStage(job: ReplicationJob, stageName: PipelineStage, timestamp: string, summary: string): void {
  const stage = findStage(job, stageName);
  stage.status = "current";
  stage.summary = summary;
  delete stage.errorMessage;
  stage.startedAt = stage.startedAt ?? timestamp;
  job.currentStage = stageName;
}

function failStage(job: ReplicationJob, stageName: PipelineStage, timestamp: string, message: string): void {
  const stage = findStage(job, stageName);
  stage.status = "failed";
  stage.summary = `Failed during ${stageName.replaceAll("_", " ")}.`;
  stage.errorMessage = message;
  stage.completedAt = timestamp;
}

function resolveDestinationStore(
  runtime: AppRuntimeConfig,
  destinationStoreId: string
): DestinationStoreProfile | undefined {
  return runtime.destinationStores.find((store) => store.id === destinationStoreId);
}

export class ReplicationPipeline {
  readonly #repository: JobRepository;
  readonly #runtime: AppRuntimeConfig;
  readonly #qualificationService: QualificationService;
  readonly #captureService: CaptureService;
  readonly #routeInventoryService: RouteInventoryService;
  readonly #storefrontModelBuilder: StorefrontModelBuilderService;
  readonly #analyzer: Analyzer;
  readonly #mapper: Mapper;
  readonly #generator: Generator;
  readonly #assetSyncService: AssetSyncService;
  readonly #storeSetupGenerator: StoreSetupGenerator;
  readonly #commerceGenerator: CommerceGenerator;
  readonly #adminReplicationService: AdminReplicationService | undefined;
  readonly #themeValidator: ThemeValidator;
  readonly #parityAuditor: ParityAuditorService | undefined;
  readonly #integrationGenerator: IntegrationGenerator;

  constructor(options: ReplicationPipelineOptions) {
    this.#repository = options.repository;
    this.#runtime = options.runtime;
    this.#qualificationService = options.qualificationService;
    this.#captureService = options.captureService;
    this.#routeInventoryService = options.routeInventoryService;
    this.#storefrontModelBuilder = options.storefrontModelBuilder;
    this.#analyzer = options.analyzer;
    this.#mapper = options.mapper;
    this.#generator = options.generator;
    this.#assetSyncService = options.assetSyncService;
    this.#storeSetupGenerator = options.storeSetupGenerator;
    this.#commerceGenerator = options.commerceGenerator;
    this.#adminReplicationService = options.adminReplicationService;
    this.#themeValidator = options.themeValidator;
    this.#parityAuditor = options.parityAuditor;
    this.#integrationGenerator = options.integrationGenerator;
  }

  async process(jobId: string): Promise<void> {
    const job = await this.#repository.getById(jobId);
    if (!job) throw new Error(`Missing job ${jobId}`);

    try {
      // --- source_qualification ---
      const sourceQualification = await this.#qualificationService.qualify({
        jobId: job.id,
        referenceUrl: job.intake.referenceUrl
      });
      job.sourceQualification = sourceQualification;
      if (sourceQualification.status !== "supported") throw new Error(sourceQualification.summary);
      completeStage(job, "source_qualification", sourceQualification.qualifiedAt, sourceQualification.summary);
      startStage(job, "capture", sourceQualification.qualifiedAt, "Capturing reference page structure and content.");
      job.updatedAt = sourceQualification.qualifiedAt;
      await this.#repository.save(job);

      // --- capture ---
      const capture = await this.#captureService.capture({ jobId: job.id, referenceUrl: job.intake.referenceUrl });
      job.capture = capture;
      completeStage(job, "capture", capture.capturedAt,
        `Captured ${capture.title} with ${capture.navigationLinks.length} nav links, ${capture.primaryCtas.length} CTAs, and ${capture.imageAssets.length} images.`);
      startStage(job, "route_inventory", capture.capturedAt, "Discovering storefront routes.");
      job.updatedAt = capture.capturedAt;
      await this.#repository.save(job);

      // --- route_inventory ---
      const routeInventory = await this.#routeInventoryService.build({
        jobId: job.id,
        referenceUrl: job.intake.referenceUrl
      });
      job.routeInventory = routeInventory;
      completeStage(job, "route_inventory", routeInventory.discoveredAt, routeInventory.summary);
      startStage(job, "storefront_model", routeInventory.discoveredAt, "Building storefront model.");
      job.updatedAt = routeInventory.discoveredAt;
      await this.#repository.save(job);

      // --- storefront_model ---
      const storefrontModel = await this.#storefrontModelBuilder.build({
        referenceUrl: job.intake.referenceUrl,
        routeInventory,
        capture
      });
      job.storefrontModel = storefrontModel;
      completeStage(job, "storefront_model", storefrontModel.modeledAt, storefrontModel.summary);
      startStage(job, "analysis", storefrontModel.modeledAt, "Analyzing captured reference structure and content.");
      job.updatedAt = storefrontModel.modeledAt;
      await this.#repository.save(job);

      // --- analysis ---
      const analysis = await this.#analyzer.analyze({
        referenceUrl: job.intake.referenceUrl,
        pageType: job.intake.pageType,
        ...(job.intake.notes ? { notes: job.intake.notes } : {}),
        capture
      });
      job.analysis = analysis;
      completeStage(job, "analysis", analysis.analyzedAt, analysis.summary);
      startStage(job, "mapping", analysis.analyzedAt, "Building Shopify section and template mapping.");
      job.updatedAt = analysis.analyzedAt;
      await this.#repository.save(job);

      // --- mapping ---
      const mapping = await this.#mapper.map({
        analysis,
        referenceUrl: job.intake.referenceUrl,
        ...(job.intake.notes ? { notes: job.intake.notes } : {})
      });
      job.mapping = mapping;
      completeStage(job, "mapping", mapping.mappedAt, mapping.summary);
      startStage(job, "theme_generation", mapping.mappedAt, "Writing stable generated theme files.");
      job.updatedAt = mapping.mappedAt;
      await this.#repository.save(job);

      // --- theme_generation ---
      const { artifacts, generation } = await this.#generator.generate({ analysis, mapping, capture, storefrontModel });
      job.artifacts = job.artifacts.map((existing) => {
        const generated = artifacts.find((a) => a.path === existing.path);
        return generated ?? existing;
      });
      job.generation = generation;
      completeStage(job, "theme_generation", generation.generatedAt, "Stable theme outputs generated successfully.");
      startStage(job, "asset_sync", generation.generatedAt, "Syncing reference assets to theme workspace.");
      job.updatedAt = generation.generatedAt;
      await this.#repository.save(job);

      // --- asset_sync ---
      const assetSync = await this.#assetSyncService.sync({
        capture,
        themeWorkspacePath: this.#runtime.themeWorkspacePath
      });
      job.assetSync = assetSync;
      completeStage(job, "asset_sync", assetSync.syncedAt, assetSync.summary);
      startStage(job, "store_setup", assetSync.syncedAt, "Preparing import-ready store setup bundle.");
      job.updatedAt = assetSync.syncedAt;
      await this.#repository.save(job);

      // --- store_setup ---
      const { artifact, storeSetup } = await this.#storeSetupGenerator.generate({ analysis, mapping });
      job.storeSetup = storeSetup;
      job.artifacts = job.artifacts.map((existing) =>
        existing.path === artifact.path ? artifact : existing
      );
      completeStage(job, "store_setup", storeSetup.plannedAt, "Import-ready store setup bundle is ready for operator review.");
      startStage(job, "commerce_wiring", storeSetup.plannedAt, "Preparing deterministic commerce wiring.");
      job.updatedAt = storeSetup.plannedAt;
      await this.#repository.save(job);

      // --- commerce_wiring ---
      const { artifact: commerceArtifact, commerce } = await this.#commerceGenerator.generate({
        analysis, mapping, storeSetup
      });
      job.commerce = commerce;
      job.artifacts = job.artifacts.map((existing) =>
        existing.path === commerceArtifact.path ? commerceArtifact : existing
      );
      completeStage(job, "commerce_wiring", commerce.plannedAt, "Deterministic commerce wiring is ready for operator review.");

      // --- admin_replication (optional) ---
      const destinationStore = resolveDestinationStore(this.#runtime, job.intake.destinationStore);
      if (this.#adminReplicationService && destinationStore?.adminTokenEnvVar) {
        startStage(job, "admin_replication", commerce.plannedAt, "Replicating theme and resources to destination store.");
        job.updatedAt = commerce.plannedAt;
        await this.#repository.save(job);

        const adminReplication = await this.#adminReplicationService.replicate({
          jobId: job.id,
          destinationStore,
          storefrontModel,
          themeWorkspacePath: this.#runtime.themeWorkspacePath
        });
        job.adminReplication = adminReplication;
        completeStage(job, "admin_replication", adminReplication.replicatedAt, adminReplication.summary);
        job.updatedAt = adminReplication.replicatedAt;
        await this.#repository.save(job);
      } else {
        completeStage(job, "admin_replication", commerce.plannedAt, "Admin replication skipped (no admin token configured).");
      }

      // --- validation ---
      startStage(job, "validation", job.updatedAt, "Running final theme validation.");
      await this.#repository.save(job);

      const validation = await this.#themeValidator.validate();
      job.validation = validation;
      const validationTimestamp = validation.checkedAt ?? job.updatedAt;
      if (validation.status === "failed") {
        failStage(job, "validation", validationTimestamp, validation.summary);
      } else {
        completeStage(job, "validation", validationTimestamp, validation.summary);
      }

      // --- parity_audit (optional) ---
      if (this.#parityAuditor && job.adminReplication && job.capture) {
        startStage(job, "parity_audit", validationTimestamp, "Running visual parity audit.");
        job.updatedAt = validationTimestamp;
        await this.#repository.save(job);

        const parityAudit = await this.#parityAuditor.audit({
          jobId: job.id,
          sourceCapture: job.capture,
          adminReplication: job.adminReplication
        });
        job.parityAudit = parityAudit;
        completeStage(job, "parity_audit", parityAudit.checkedAt, parityAudit.summary);
        job.updatedAt = parityAudit.checkedAt;
        await this.#repository.save(job);
      } else {
        completeStage(job, "parity_audit", validationTimestamp, "Parity audit skipped.");
      }

      // --- integration_check ---
      startStage(job, "integration_check", job.updatedAt, "Preparing deterministic integration report.");
      await this.#repository.save(job);

      const { artifact: integrationArtifact, integration } = await this.#integrationGenerator.generate({
        analysis, mapping, generation, storeSetup, commerce,
        artifacts: job.artifacts, validation
      });
      job.integration = integration;
      job.artifacts = job.artifacts.map((existing) =>
        existing.path === integrationArtifact.path ? integrationArtifact : existing
      );
      job.updatedAt = integration.checkedAt;

      if (validation.status === "failed") throw new Error(validation.summary);
      if (integration.status === "failed") throw new Error(integration.summary);

      completeStage(job, "integration_check", integration.checkedAt,
        "Deterministic integration report is ready for operator review.");
      startStage(job, "review", integration.checkedAt,
        "Generated theme files, store setup bundle, commerce wiring, and integration report are ready for operator QA.");
      job.status = "needs_review";
      job.updatedAt = integration.checkedAt;
      await this.#repository.save(job);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected replication pipeline failure.";
      const failureTimestamp = new Date().toISOString();

      job.status = "failed";
      job.error = { stage: job.currentStage, message };
      failStage(job, job.currentStage, failureTimestamp, message);

      if (job.currentStage === "theme_generation") {
        job.artifacts = job.artifacts.map((artifact) =>
          (artifact.kind === "section" || artifact.kind === "template") && artifact.status !== "generated"
            ? { ...artifact, status: "failed" }
            : artifact
        );
      }

      if (job.currentStage === "store_setup") {
        job.artifacts = job.artifacts.map((artifact) =>
          artifact.path === stableStoreSetupArtifact.path && artifact.status !== "generated"
            ? { ...artifact, status: "failed" }
            : artifact
        );
      }

      if (job.currentStage === "commerce_wiring") {
        job.artifacts = job.artifacts.map((artifact) =>
          artifact.path === stableCommerceArtifact.path && artifact.status !== "generated"
            ? { ...artifact, status: "failed" }
            : artifact
        );
      }

      if (job.currentStage === "validation") {
        job.validation = { ...job.validation, status: "failed", summary: message, checkedAt: failureTimestamp };
      }

      if (job.currentStage === "integration_check") {
        job.artifacts = job.artifacts.map((artifact) =>
          artifact.path === stableIntegrationArtifact.path && artifact.status !== "generated"
            ? { ...artifact, status: "failed" }
            : artifact
        );
      }

      job.updatedAt = failureTimestamp;
      await this.#repository.save(job);
    }
  }
}
