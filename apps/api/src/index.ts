import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
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

const runtime = getDefaultRuntimeConfig();
const repository = new SqliteJobRepository(process.env.REPLICATOR_DB_PATH ?? `${process.cwd()}/.data/replicator.db`);
const pipeline = new ReplicationPipeline({
  repository,
  analyzer: new DeterministicPageAnalyzer(),
  mapper: new DeterministicThemeMapper(),
  generator: new ShopifyThemeGenerator(runtime.themeWorkspacePath),
  storeSetupGenerator: new ShopifyStoreSetupGenerator(runtime.themeWorkspacePath),
  commerceGenerator: new ShopifyCommerceWiringGenerator(runtime.themeWorkspacePath),
  integrationGenerator: new ShopifyIntegrationReportGenerator(runtime.themeWorkspacePath),
  themeValidator: new ShopifyThemeValidator(runtime.themeWorkspacePath)
});
const app = createApp({
  repository,
  runtime,
  enqueueJob: async (jobId) => {
    await pipeline.process(jobId);
  }
});
const port = Number(process.env.PORT ?? 8787);

serve(
  {
    fetch: app.fetch,
    port
  },
  (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
  }
);
