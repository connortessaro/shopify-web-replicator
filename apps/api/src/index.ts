import { serve } from "@hono/node-server";
import { createDefaultReplicationOrchestrator } from "@shopify-web-replicator/engine";

import { createApp } from "./app.js";

const orchestrator = createDefaultReplicationOrchestrator();
const app = createApp({
  repository: orchestrator.repository,
  createJob: (intake) => orchestrator.createJob(intake),
  runtime: orchestrator.getRuntime(),
  enqueueJob: async (jobId) => {
    await orchestrator.runJob(jobId);
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
