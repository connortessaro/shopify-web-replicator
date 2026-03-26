import type {
  AppRuntimeConfig,
  DestinationStoreProfile,
  HydrogenReplicationIntake,
  HydrogenReplicationJob,
  HydrogenReplicationJobSummary,
  ReferenceIntake,
  ReplicationJob,
  ReplicationJobSummary
} from "@shopify-web-replicator/shared";
import {
  createHydrogenReplicationJob,
  createHydrogenReplicationJobSummary,
  createReplicationJob
} from "@shopify-web-replicator/shared";
import { join } from "node:path";

import { logger } from "./logger.js";
import type { JobRepository } from "./repository/in-memory-job-repository.js";
import { SqliteJobRepository } from "./repository/sqlite-job-repository.js";
import { getDefaultRuntimeConfig } from "./runtime.js";
import { ThemeAssetSyncService } from "./services/asset-sync.js";
import { ShopifyCommerceWiringGenerator } from "./services/commerce-wiring-generator.js";
import { ShopifyIntegrationReportGenerator } from "./services/integration-report-generator.js";
import { DeterministicPageAnalyzer } from "./services/page-analyzer.js";
import { HtmlReferenceCaptureService } from "./services/reference-capture.js";
import { ReplicationPipeline } from "./services/replication-pipeline.js";
import { ShopifyRouteInventoryService } from "./services/route-inventory.js";
import { ShopifySourceQualificationService } from "./services/source-qualification.js";
import { StorefrontInspector } from "./services/storefront-inspector.js";
import { StorefrontModelBuilder } from "./services/storefront-model-builder.js";
import { ShopifyStoreSetupGenerator } from "./services/store-setup-generator.js";
import { DeterministicThemeMapper } from "./services/theme-mapper.js";
import { ShopifyThemeGenerator } from "./services/theme-generator.js";
import { ShopifyThemeValidator } from "./services/theme-validator.js";
import { BackendInferenceService } from "./services/backend-inference.js";
import { FigmaStagingService } from "./services/figma-staging.js";
import { FigmaMcpClient } from "./services/figma-mcp-client.js";
import { FrontendSpecBuilder } from "./services/frontend-spec.js";
import { HydrogenWorkspaceGenerator } from "./services/hydrogen-generator.js";
import { HydrogenReplicationPipeline } from "./services/hydrogen-replication-pipeline.js";
import { HydrogenWorkspaceValidator } from "./services/hydrogen-validator.js";
import { PlaywrightDiscoveryService } from "./services/playwright-discovery.js";
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
} from "./services/types.js";

export interface ReplicationHandoff {
  job: ReplicationJob;
  runtime: AppRuntimeConfig;
  nextActions: string[];
}

export type ReplicationOrchestratorOptions = {
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

export type DefaultReplicationOrchestratorOptions = {
  cwd?: string;
  databasePath?: string;
  themeWorkspacePath?: string;
};

function resolveDestinationStore(
  runtime: AppRuntimeConfig,
  destinationStoreId: string
): DestinationStoreProfile | undefined {
  return runtime.destinationStores.find((store) => store.id === destinationStoreId);
}

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
    "Open the unpublished destination theme preview and verify route parity, content wiring, and cart-to-checkout handoff.",
    "Resolve any failed validation or integration checks before publish."
  ];
}

export class ReplicationOrchestrator {
  readonly repository: JobRepository;
  readonly #pipeline: ReplicationPipeline;
  readonly #hydrogenPipeline: HydrogenReplicationPipeline;
  readonly #runtime: AppRuntimeConfig;
  readonly #logger = logger;

  constructor(options: ReplicationOrchestratorOptions) {
    this.repository = options.repository;
    this.#runtime = options.runtime;
    const hydrogenWorkspaceRoot =
      process.env.REPLICATOR_HYDROGEN_ROOT ?? join(process.cwd(), "generated-sites");
    const figmaClientOptions = {
      endpoint: process.env.FIGMA_MCP_URL ?? "http://127.0.0.1:3845/mcp",
      ...(process.env.FIGMA_MCP_AUTH_HEADER_NAME
        ? { authHeaderName: process.env.FIGMA_MCP_AUTH_HEADER_NAME }
        : {}),
      ...(process.env.FIGMA_MCP_AUTH_HEADER_VALUE
        ? { authHeaderValue: process.env.FIGMA_MCP_AUTH_HEADER_VALUE }
        : {})
    };
    const figmaClient = new FigmaMcpClient(figmaClientOptions);
    this.#pipeline = new ReplicationPipeline({
      repository: options.repository,
      runtime: options.runtime,
      qualificationService: options.qualificationService,
      captureService: options.captureService,
      routeInventoryService: options.routeInventoryService,
      storefrontModelBuilder: options.storefrontModelBuilder,
      analyzer: options.analyzer,
      mapper: options.mapper,
      generator: options.generator,
      assetSyncService: options.assetSyncService,
      storeSetupGenerator: options.storeSetupGenerator,
      commerceGenerator: options.commerceGenerator,
      themeValidator: options.themeValidator,
      integrationGenerator: options.integrationGenerator,
      ...(options.adminReplicationService ? { adminReplicationService: options.adminReplicationService } : {}),
      ...(options.parityAuditor ? { parityAuditor: options.parityAuditor } : {})
    });
    this.#hydrogenPipeline = new HydrogenReplicationPipeline({
      repository: options.repository,
      qualificationService: options.qualificationService,
      captureService: options.captureService,
      routeInventoryService: options.routeInventoryService,
      analyzer: options.analyzer,
      discoveryService: new PlaywrightDiscoveryService(),
      figmaStagingService: new FigmaStagingService({
        client: figmaClient,
        ...(process.env.FIGMA_MCP_PLAN_KEY ? { planKey: process.env.FIGMA_MCP_PLAN_KEY } : {}),
        outputMode: process.env.FIGMA_MCP_OUTPUT_MODE === "clipboard" ? "clipboard" : "newFile",
        clientFrameworks: "React",
        clientLanguages: "typescript"
      }),
      frontendSpecBuilder: new FrontendSpecBuilder(),
      backendInferenceService: new BackendInferenceService(),
      hydrogenGenerator: new HydrogenWorkspaceGenerator(hydrogenWorkspaceRoot),
      hydrogenValidator: new HydrogenWorkspaceValidator()
    });
  }

  getRuntime(): AppRuntimeConfig {
    return this.#runtime;
  }

  listDestinationStores(): DestinationStoreProfile[] {
    return [...this.#runtime.destinationStores];
  }

  async createJob(intake: ReferenceIntake): Promise<ReplicationJobSummary> {
    if (!resolveDestinationStore(this.#runtime, intake.destinationStore)) {
      throw new Error(`Unknown destination store ${intake.destinationStore}.`);
    }

    const job = await this.repository.save(createReplicationJob(intake));

    return {
      jobId: job.id,
      status: job.status,
      currentStage: job.currentStage,
      createdAt: job.createdAt,
      pageType: job.intake.pageType,
      destinationStore: job.intake.destinationStore
    };
  }

  async runJob(jobId: string): Promise<ReplicationJob> {
    await this.#pipeline.process(jobId);
    const job = await this.repository.getById(jobId);
    if (!job) throw new Error(`Missing job ${jobId}`);
    return job;
  }

  async retryJob(jobId: string): Promise<ReplicationHandoff> {
    const job = await this.repository.getById(jobId);

    if (!job) {
      throw new Error(`Missing job ${jobId}`);
    }

    if (job.status !== "failed") {
      throw new Error(`Job ${jobId} is not in a failed state`);
    }

    for (const stage of job.stages) {
      if (stage.status === "failed") {
        stage.status = "pending";
        delete stage.errorMessage;
        delete stage.summary;
      }
    }

    const firstPendingStage = job.stages.find((stage) => stage.status === "pending");
    if (firstPendingStage) {
      firstPendingStage.status = "current";
      job.currentStage = firstPendingStage.name;
    }

    job.status = "in_progress";
    delete job.error;

    job.artifacts = job.artifacts.map((artifact) =>
      artifact.status === "failed" ? { ...artifact, status: "pending" } : artifact
    );

    job.updatedAt = new Date().toISOString();
    await this.repository.save(job);

    const updatedJob = await this.runJob(jobId);

    return {
      job: updatedJob,
      runtime: this.#runtime,
      nextActions: buildNextActions(updatedJob)
    };
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

  async createHydrogenJob(
    intake: HydrogenReplicationIntake
  ): Promise<HydrogenReplicationJobSummary> {
    const job = await this.repository.save(
      createHydrogenReplicationJob(intake) as unknown as ReplicationJob
    );

    return createHydrogenReplicationJobSummary(job as unknown as HydrogenReplicationJob);
  }

  async enqueueHydrogenReplication(
    intake: HydrogenReplicationIntake
  ): Promise<HydrogenReplicationJobSummary> {
    const created = await this.createHydrogenJob(intake);

    queueMicrotask(() => {
      void this.runHydrogenJob(created.jobId).catch((error) => {
        this.#logger.error("Hydrogen replication failed", {
          jobId: created.jobId,
          error
        });
      });
    });

    return created;
  }

  async runHydrogenJob(jobId: string): Promise<HydrogenReplicationJob> {
    await this.#hydrogenPipeline.process(jobId);
    const job = await this.repository.getById(jobId);
    if (!job) {
      throw new Error(`Missing job ${jobId}`);
    }
    return job as unknown as HydrogenReplicationJob;
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
  const inspector = new StorefrontInspector(runtime.captureRootPath);

  return createReplicationOrchestrator({
    repository,
    runtime,
    qualificationService: new ShopifySourceQualificationService(inspector),
    captureService: new HtmlReferenceCaptureService(inspector),
    routeInventoryService: new ShopifyRouteInventoryService(inspector),
    storefrontModelBuilder: new StorefrontModelBuilder(),
    analyzer: new DeterministicPageAnalyzer(),
    mapper: new DeterministicThemeMapper(),
    generator: new ShopifyThemeGenerator(runtime.themeWorkspacePath),
    assetSyncService: new ThemeAssetSyncService(),
    storeSetupGenerator: new ShopifyStoreSetupGenerator(runtime.themeWorkspacePath),
    commerceGenerator: new ShopifyCommerceWiringGenerator(runtime.themeWorkspacePath),
    themeValidator: new ShopifyThemeValidator(runtime.themeWorkspacePath),
    integrationGenerator: new ShopifyIntegrationReportGenerator(runtime.themeWorkspacePath)
  });
}
