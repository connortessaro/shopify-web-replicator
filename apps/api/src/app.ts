import { Hono } from "hono";
import { cors } from "hono/cors";
import { ZodError } from "zod";

import { createReplicationJob, referenceIntakeSchema } from "@shopify-web-replicator/shared";

import { InMemoryJobRepository, type JobRepository } from "./repository/in-memory-job-repository.js";

export function createApp(repository: JobRepository = new InMemoryJobRepository()) {
  const app = new Hono();

  app.use("*", cors());

  app.get("/health", (context) => {
    return context.json({ status: "ok" });
  });

  app.post("/api/jobs", async (context) => {
    try {
      const payload = await context.req.json();
      const intake = referenceIntakeSchema.parse(payload);
      const job = repository.save(createReplicationJob(intake));

      return context.json(
        {
          jobId: job.id,
          currentStage: job.currentStage,
          status: job.status,
          createdAt: job.createdAt
        },
        201
      );
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        return context.json(
          {
            error: "Invalid intake payload",
            issues: error.issues
          },
          400
        );
      }

      throw error;
    }
  });

  app.get("/api/jobs/:jobId", (context) => {
    const job = repository.getById(context.req.param("jobId"));

    if (!job) {
      return context.json({ error: "Job not found" }, 404);
    }

    return context.json(job);
  });

  return app;
}
