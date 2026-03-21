import type {
  PageType,
  PipelineStage,
  ReferenceAnalysis,
  ReplicationJob,
  ThemeCheckResult,
  ThemeMapping
} from "@shopify-web-replicator/shared";

import type { JobRepository } from "../repository/in-memory-job-repository.js";

type Analyzer = {
  analyze(input: { referenceUrl: string; pageType?: PageType; notes?: string }): Promise<ReferenceAnalysis>;
};

type Mapper = {
  map(input: { analysis: ReferenceAnalysis; referenceUrl: string; notes?: string }): Promise<ThemeMapping>;
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

type ReplicationPipelineOptions = {
  repository: JobRepository;
  analyzer: Analyzer;
  mapper: Mapper;
  generator: Generator;
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
  readonly #analyzer: Analyzer;
  readonly #mapper: Mapper;
  readonly #generator: Generator;
  readonly #themeValidator: ThemeValidator;

  constructor(options: ReplicationPipelineOptions) {
    this.#repository = options.repository;
    this.#analyzer = options.analyzer;
    this.#mapper = options.mapper;
    this.#generator = options.generator;
    this.#themeValidator = options.themeValidator;
  }

  async process(jobId: string): Promise<void> {
    const job = await this.#repository.getById(jobId);

    if (!job) {
      throw new Error(`Missing job ${jobId}`);
    }

    try {
      const analysis = await this.#analyzer.analyze({
        referenceUrl: job.intake.referenceUrl,
        pageType: job.intake.pageType,
        ...(job.intake.notes ? { notes: job.intake.notes } : {})
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
      job.artifacts = artifacts;
      job.generation = generation;

      const validation = await this.#themeValidator.validate();
      job.validation = validation;

      if (validation.status === "failed") {
        throw new Error(validation.summary);
      }

      const reviewTimestamp = validation.checkedAt ?? generation.generatedAt;
      completeStage(job, "theme_generation", reviewTimestamp, "Stable theme outputs generated successfully.");
      startStage(job, "review", reviewTimestamp, "Generated theme files are ready for operator QA.");
      job.status = "needs_review";
      job.updatedAt = reviewTimestamp;
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
          artifact.status === "generated" ? artifact : { ...artifact, status: "failed" }
        );
      }

      job.updatedAt = failureTimestamp;
      await this.#repository.save(job);
    }
  }
}
