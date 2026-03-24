import type {
  AppRuntimeConfig,
  ReferenceIntake,
  ReplicationJob,
  ReplicationJobSummary
} from "@shopify-web-replicator/shared";
import { createReplicationJob } from "@shopify-web-replicator/shared";

import type { JobRepository } from "./repository/in-memory-job-repository.js";
import { SqliteJobRepository } from "./repository/sqlite-job-repository.js";
import { getDefaultRuntimeConfig } from "./runtime.js";
import { ShopifyCommerceWiringGenerator } from "./services/commerce-wiring-generator.js";
import { ShopifyIntegrationReportGenerator } from "./services/integration-report-generator.js";
import { DeterministicPageAnalyzer } from "./services/page-analyzer.js";
import { ReplicationPipeline } from "./services/replication-pipeline.js";
import { ShopifyStoreSetupGenerator } from "./services/store-setup-generator.js";
import { DeterministicThemeMapper } from "./services/theme-mapper.js";
import { ShopifyThemeGenerator } from "./services/theme-generator.js";
import { ShopifyThemeValidator } from "./services/theme-validator.js";
import type {
  Analyzer,
  CommerceGenerator,
  Generator,
  IntegrationGenerator,
  Mapper,
  StoreSetupGenerator,
  ThemeValidator
} from "./services/types.js";

export interface ReplicationHandoff {
  job: ReplicationJob;
  runtime: AppRuntimeConfig;
  nextActions: string[];
}

export type ReplicationOrchestratorOptions = {
  repository: JobRepository;
  runtime: AppRuntimeConfig;
  analyzer: Analyzer;
  mapper: Mapper;
  generator: Generator;
  storeSetupGenerator: StoreSetupGenerator;
  commerceGenerator: CommerceGenerator;
  integrationGenerator: IntegrationGenerator;
  themeValidator: ThemeValidator;
};

export type DefaultReplicationOrchestratorOptions = {
  cwd?: string;
  databasePath?: string;
  themeWorkspacePath?: string;
};

function buildNextActions(job: ReplicationJob): string[] {
  if (job.status === "failed") {
    return [
      "Inspect the recorded pipeline error and any generated artifacts.",
      "Review validation and integration output to identify the failing stage.",
      "Re-run the replication after fixing the underlying issue."
    ];
  }

  return [
    "Review the generated artifacts in the theme workspace.",
    "Run the preview command and verify layout, content wiring, and cart-to-checkout handoff.",
    "Resolve any failed validation or integration checks before publish."
  ];
}

export class ReplicationOrchestrator {
  readonly repository: JobRepository;
  readonly #pipeline: ReplicationPipeline;
  readonly #runtime: AppRuntimeConfig;

  constructor(options: ReplicationOrchestratorOptions) {
    this.repository = options.repository;
    this.#runtime = options.runtime;
    this.#pipeline = new ReplicationPipeline({
      repository: options.repository,
      analyzer: options.analyzer,
      mapper: options.mapper,
      generator: options.generator,
      storeSetupGenerator: options.storeSetupGenerator,
      commerceGenerator: options.commerceGenerator,
      integrationGenerator: options.integrationGenerator,
      themeValidator: options.themeValidator
    });
  }

  getRuntime(): AppRuntimeConfig {
    return this.#runtime;
  }

  async createJob(intake: ReferenceIntake): Promise<ReplicationJobSummary> {
    const job = await this.repository.save(createReplicationJob(intake));

    return {
      jobId: job.id,
      status: job.status,
      currentStage: job.currentStage,
      createdAt: job.createdAt,
      pageType: job.intake.pageType
    };
  }

  async runJob(jobId: string): Promise<ReplicationJob> {
    await this.#pipeline.process(jobId);

    const job = await this.repository.getById(jobId);

    if (!job) {
      throw new Error(`Missing job ${jobId}`);
    }

    return job;
  }

  async replicateStorefront(intake: ReferenceIntake): Promise<ReplicationHandoff> {
    const created = await this.createJob(intake);
    const job = await this.runJob(created.jobId);

    return {
      job,
      runtime: this.#runtime,
      nextActions: buildNextActions(job)
    };
  }

  async getJob(jobId: string): Promise<ReplicationJob | undefined> {
    return this.repository.getById(jobId);
  }

  async listRecentJobs(limit = 10): Promise<ReplicationJobSummary[]> {
    return this.repository.listRecent(limit);
  }

  async retryJob(jobId: string): Promise<ReplicationHandoff> {
    const job = await this.repository.getById(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found.`);
    }

    if (job.status !== "failed") {
      throw new Error(`Job ${jobId} is not in a failed state.`);
    }

    for (const stage of job.stages) {
      if (stage.status === "failed") {
        stage.status = "pending";
        delete stage.startedAt;
        delete stage.completedAt;
        delete stage.summary;
        delete stage.errorMessage;
      }
    }

    job.status = "in_progress";
    delete job.error;
    job.updatedAt = new Date().toISOString();
    await this.repository.save(job);

    const result = await this.runJob(jobId);

    return {
      job: result,
      runtime: this.#runtime,
      nextActions: buildNextActions(result)
    };
  }
}

export function createReplicationOrchestrator(
  options: ReplicationOrchestratorOptions
): ReplicationOrchestrator {
  return new ReplicationOrchestrator(options);
}

export function createDefaultReplicationOrchestrator(
  options: DefaultReplicationOrchestratorOptions = {}
): ReplicationOrchestrator {
  const runtime = {
    ...getDefaultRuntimeConfig(options.cwd),
    ...(options.themeWorkspacePath ? { themeWorkspacePath: options.themeWorkspacePath } : {})
  };
  const cwd = options.cwd ?? process.cwd();
  const repository = new SqliteJobRepository(
    options.databasePath ?? process.env.REPLICATOR_DB_PATH ?? `${cwd}/.data/replicator.db`
  );

  return createReplicationOrchestrator({
    repository,
    runtime,
    analyzer: new DeterministicPageAnalyzer(),
    mapper: new DeterministicThemeMapper(),
    generator: new ShopifyThemeGenerator(runtime.themeWorkspacePath),
    storeSetupGenerator: new ShopifyStoreSetupGenerator(runtime.themeWorkspacePath),
    commerceGenerator: new ShopifyCommerceWiringGenerator(runtime.themeWorkspacePath),
    themeValidator: new ShopifyThemeValidator(runtime.themeWorkspacePath),
    integrationGenerator: new ShopifyIntegrationReportGenerator(runtime.themeWorkspacePath)
  });
}
