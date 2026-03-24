import type {
  CommerceWiringPlan,
  PageType,
  PipelineStage,
  ReferenceCapture,
  ReferenceAnalysis,
  ReplicationJob,
  SourceQualification,
  StoreSetupPlan,
  ThemeCheckResult,
  ThemeMapping
} from "@shopify-web-replicator/shared";
import {
  stableCommerceArtifact,
  stableIntegrationArtifact,
  stableStoreSetupArtifact
} from "@shopify-web-replicator/shared";

import type { JobRepository } from "../repository/in-memory-job-repository.js";

type Analyzer = {
  analyze(input: {
    referenceUrl: string;
    pageType?: PageType;
    notes?: string;
    capture?: ReferenceCapture;
  }): Promise<ReferenceAnalysis>;
};

type Mapper = {
  map(input: { analysis: ReferenceAnalysis; referenceUrl: string; notes?: string }): Promise<ThemeMapping>;
};

type CaptureService = {
  capture(input: { jobId: string; referenceUrl: string }): Promise<ReferenceCapture>;
};

type QualificationService = {
  qualify(input: { jobId: string; referenceUrl: string }): Promise<SourceQualification>;
};

type Generator = {
  generate(input: {
    analysis: ReferenceAnalysis;
    mapping: ThemeMapping;
  }): Promise<{
    artifacts: ReplicationJob["artifacts"];
    generation: NonNullable<ReplicationJob["generation"]>;
  }>;
};

type ThemeValidator = {
  validate(): Promise<ThemeCheckResult>;
};

type StoreSetupGenerator = {
  generate(input: {
    analysis: ReferenceAnalysis;
    mapping: ThemeMapping;
  }): Promise<{
    artifact: ReplicationJob["artifacts"][number];
    storeSetup: StoreSetupPlan;
  }>;
};

type CommerceGenerator = {
  generate(input: {
    analysis: ReferenceAnalysis;
    mapping: ThemeMapping;
    storeSetup: StoreSetupPlan;
  }): Promise<{
    artifact: ReplicationJob["artifacts"][number];
    commerce: CommerceWiringPlan;
  }>;
};

type IntegrationGenerator = {
  generate(input: {
    analysis: ReferenceAnalysis;
    mapping: ThemeMapping;
    generation: NonNullable<ReplicationJob["generation"]>;
    storeSetup: StoreSetupPlan;
    commerce: CommerceWiringPlan;
    artifacts: ReplicationJob["artifacts"];
    validation: ThemeCheckResult;
  }): Promise<{
    artifact: ReplicationJob["artifacts"][number];
    integration: NonNullable<ReplicationJob["integration"]>;
  }>;
};

type ReplicationPipelineOptions = {
  repository: JobRepository;
  qualificationService: QualificationService;
  captureService: CaptureService;
  analyzer: Analyzer;
  mapper: Mapper;
  generator: Generator;
  storeSetupGenerator: StoreSetupGenerator;
  commerceGenerator: CommerceGenerator;
  integrationGenerator: IntegrationGenerator;
  themeValidator: ThemeValidator;
};

function findStage(job: ReplicationJob, stageName: PipelineStage) {
  const stage = job.stages.find((entry) => entry.name === stageName);

  if (!stage) {
    throw new Error(`Missing stage ${stageName}`);
  }

  return stage;
}

function completeStage(
  job: ReplicationJob,
  stageName: PipelineStage,
  timestamp: string,
  summary: string
): void {
  const stage = findStage(job, stageName);
  stage.status = "complete";
  stage.summary = summary;
  delete stage.errorMessage;
  stage.completedAt = timestamp;
}

function startStage(
  job: ReplicationJob,
  stageName: PipelineStage,
  timestamp: string,
  summary: string
): void {
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

export class ReplicationPipeline {
  readonly #repository: JobRepository;
  readonly #qualificationService: QualificationService;
  readonly #captureService: CaptureService;
  readonly #analyzer: Analyzer;
  readonly #mapper: Mapper;
  readonly #generator: Generator;
  readonly #storeSetupGenerator: StoreSetupGenerator;
  readonly #commerceGenerator: CommerceGenerator;
  readonly #integrationGenerator: IntegrationGenerator;
  readonly #themeValidator: ThemeValidator;

  constructor(options: ReplicationPipelineOptions) {
    this.#repository = options.repository;
    this.#qualificationService = options.qualificationService;
    this.#captureService = options.captureService;
    this.#analyzer = options.analyzer;
    this.#mapper = options.mapper;
    this.#generator = options.generator;
    this.#storeSetupGenerator = options.storeSetupGenerator;
    this.#commerceGenerator = options.commerceGenerator;
    this.#integrationGenerator = options.integrationGenerator;
    this.#themeValidator = options.themeValidator;
  }

  async process(jobId: string): Promise<void> {
    const job = await this.#repository.getById(jobId);

    if (!job) {
      throw new Error(`Missing job ${jobId}`);
    }

    try {
      const sourceQualification = await this.#qualificationService.qualify({
        jobId: job.id,
        referenceUrl: job.intake.referenceUrl
      });
      job.sourceQualification = sourceQualification;

      if (sourceQualification.status !== "supported") {
        throw new Error(sourceQualification.summary);
      }

      completeStage(job, "source_qualification", sourceQualification.qualifiedAt, sourceQualification.summary);
      startStage(job, "capture", sourceQualification.qualifiedAt, "Capturing reference page structure and content.");
      job.updatedAt = sourceQualification.qualifiedAt;
      await this.#repository.save(job);

      const capture = await this.#captureService.capture({
        jobId: job.id,
        referenceUrl: job.intake.referenceUrl
      });
      job.capture = capture;
      completeStage(
        job,
        "capture",
        capture.capturedAt,
        `Captured ${capture.title} with ${capture.navigationLinks.length} navigation links, ${capture.primaryCtas.length} CTAs, and ${capture.imageAssets.length} images.`
      );
      startStage(job, "analysis", capture.capturedAt, "Analyzing captured reference structure and content.");
      job.updatedAt = capture.capturedAt;
      await this.#repository.save(job);

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

      const { artifacts, generation } = await this.#generator.generate({ analysis, mapping });
      job.artifacts = job.artifacts.map((existingArtifact) => {
        const generatedArtifact = artifacts.find((artifact) => artifact.path === existingArtifact.path);
        return generatedArtifact ?? existingArtifact;
      });
      job.generation = generation;
      completeStage(job, "theme_generation", generation.generatedAt, "Stable theme outputs generated successfully.");
      startStage(job, "store_setup", generation.generatedAt, "Preparing import-ready store setup bundle.");
      job.updatedAt = generation.generatedAt;
      await this.#repository.save(job);

      const { artifact, storeSetup } = await this.#storeSetupGenerator.generate({ analysis, mapping });
      job.storeSetup = storeSetup;
      job.artifacts = job.artifacts.map((existingArtifact) =>
        existingArtifact.path === artifact.path ? artifact : existingArtifact
      );
      completeStage(job, "store_setup", storeSetup.plannedAt, "Import-ready store setup bundle is ready for operator review.");
      startStage(job, "commerce_wiring", storeSetup.plannedAt, "Preparing deterministic commerce wiring.");
      job.updatedAt = storeSetup.plannedAt;
      await this.#repository.save(job);

      const { artifact: commerceArtifact, commerce } = await this.#commerceGenerator.generate({
        analysis,
        mapping,
        storeSetup
      });
      job.commerce = commerce;
      job.artifacts = job.artifacts.map((existingArtifact) =>
        existingArtifact.path === commerceArtifact.path ? commerceArtifact : existingArtifact
      );
      completeStage(job, "commerce_wiring", commerce.plannedAt, "Deterministic commerce wiring is ready for operator review.");
      startStage(job, "validation", commerce.plannedAt, "Running final theme validation.");
      job.updatedAt = commerce.plannedAt;
      await this.#repository.save(job);

      const validation = await this.#themeValidator.validate();
      job.validation = validation;

      if (validation.status === "failed") {
        throw new Error(validation.summary);
      }

      const validationTimestamp = validation.checkedAt ?? commerce.plannedAt;
      completeStage(job, "validation", validationTimestamp, validation.summary);
      startStage(job, "integration_check", validationTimestamp, "Preparing deterministic integration report.");
      job.updatedAt = validationTimestamp;
      await this.#repository.save(job);

      const { artifact: integrationArtifact, integration } = await this.#integrationGenerator.generate({
        analysis,
        mapping,
        generation,
        storeSetup,
        commerce,
        artifacts: job.artifacts,
        validation
      });
      job.integration = integration;
      job.artifacts = job.artifacts.map((existingArtifact) =>
        existingArtifact.path === integrationArtifact.path ? integrationArtifact : existingArtifact
      );
      job.updatedAt = integration.checkedAt;

      if (integration.status === "failed") {
        throw new Error(integration.summary);
      }

      completeStage(
        job,
        "integration_check",
        integration.checkedAt,
        "Deterministic integration report is ready for operator review."
      );
      startStage(
        job,
        "review",
        integration.checkedAt,
        "Generated theme files, store setup bundle, commerce wiring, and integration report are ready for operator QA."
      );
      job.status = "needs_review";
      job.updatedAt = integration.checkedAt;
      await this.#repository.save(job);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected replication pipeline failure.";
      const failureTimestamp = new Date().toISOString();

      job.status = "failed";
      job.error = {
        stage: job.currentStage,
        message
      };
      failStage(job, job.currentStage, failureTimestamp, message);

      if (job.currentStage === "theme_generation") {
        job.artifacts = job.artifacts.map((artifact) =>
          artifact.kind === "section" || artifact.kind === "template"
            ? artifact.status === "generated"
              ? artifact
              : { ...artifact, status: "failed" }
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
        job.validation = {
          ...job.validation,
          status: "failed",
          summary: message,
          checkedAt: failureTimestamp
        };
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
