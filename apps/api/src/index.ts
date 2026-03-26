import { serve } from "@hono/node-server";
import { createDefaultReplicationOrchestrator } from "@shopify-web-replicator/engine";

import { createApp } from "./app.js";
import { logger } from "./logger.js";

const orchestrator = createDefaultReplicationOrchestrator();
const port = Number(process.env.PORT ?? 8787);
const hostname = process.env.HOST ?? "127.0.0.1";
const allowedOrigins = (process.env.REPLICATOR_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const app = createApp({
  repository: orchestrator.repository,
  createJob: (intake) => orchestrator.createJob(intake),
  createHydrogenJob: (intake) => orchestrator.enqueueHydrogenReplication(intake),
  runtime: orchestrator.getRuntime(),
  allowedOrigins,
  enqueueJob: async (jobId) => {
    await orchestrator.runJob(jobId);
  }
});

serve(
  {
    fetch: app.fetch,
    port,
    hostname
  },
  (info) => {
    logger.info("API listening", {
      hostname,
      port: info.port,
      url: `http://${hostname}:${info.port}`
    });
  }
);
