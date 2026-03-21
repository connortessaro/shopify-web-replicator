import { serve } from "@hono/node-server";
import { join } from "node:path";

import { createApp } from "./app.js";
import { SqliteJobRepository } from "./repository/sqlite-job-repository.js";
import { DeterministicPageAnalyzer } from "./services/page-analyzer.js";
import { ReplicationPipeline } from "./services/replication-pipeline.js";
import { DeterministicThemeMapper } from "./services/theme-mapper.js";
import { ShopifyThemeGenerator } from "./services/theme-generator.js";
import { ShopifyThemeValidator } from "./services/theme-validator.js";

const themeWorkspacePath =
  process.env.THEME_WORKSPACE_PATH ?? join(process.cwd(), "packages/theme-workspace");
const repository = new SqliteJobRepository(
  process.env.REPLICATOR_DB_PATH ?? join(process.cwd(), ".data/replicator.db")
);
const pipeline = new ReplicationPipeline({
  repository,
  analyzer: new DeterministicPageAnalyzer(),
  mapper: new DeterministicThemeMapper(),
  generator: new ShopifyThemeGenerator(themeWorkspacePath),
  themeValidator: new ShopifyThemeValidator(themeWorkspacePath)
});
const app = createApp({
  repository,
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
