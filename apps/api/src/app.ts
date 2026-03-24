import { Hono } from "hono";
import { cors } from "hono/cors";
import { ZodError } from "zod";

import type {
  AppRuntimeConfig,
  ReferenceIntake,
  ReplicationJobSummary
} from "@shopify-web-replicator/shared";
import { createReplicationJob, referenceIntakeSchema } from "@shopify-web-replicator/shared";

import { InMemoryJobRepository, type JobRepository } from "./repository/in-memory-job-repository.js";
import { getDefaultRuntimeConfig } from "./runtime.js";

type CreateAppOptions = {
  repository?: JobRepository;
  createJob?: (intake: ReferenceIntake) => Promise<ReplicationJobSummary>;
  enqueueJob?: (jobId: string) => Promise<void> | void;
  runtime?: AppRuntimeConfig;
};

export function createApp(options: CreateAppOptions = {}) {
  const repository = options.repository ?? new InMemoryJobRepository();
  const createJob =
    options.createJob ??
    (async (intake: ReferenceIntake) => {
      const job = await repository.save(createReplicationJob(intake));

      return {
        jobId: job.id,
        currentStage: job.currentStage,
        status: job.status,
        createdAt: job.createdAt,
        pageType: job.intake.pageType,
        destinationStore: job.intake.destinationStore
      };
    });
  const enqueueJob = options.enqueueJob ?? (async () => undefined);
  const runtime = options.runtime ?? getDefaultRuntimeConfig();
  const app = new Hono();

  app.use("*", cors());

  app.get("/health", (context) => {
    return context.json({ status: "ok" });
  });

  app.post("/api/jobs", async (context) => {
    try {
      const payload = await context.req.json();
      const intake = referenceIntakeSchema.parse(payload);
      const created = await createJob(intake);

      queueMicrotask(() => {
        void Promise.resolve(enqueueJob(created.jobId)).catch((error) => {
          console.error("Failed to enqueue replication job", error);
        });
      });

      return context.json(created, 201);
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

      if (error instanceof Error) {
        return context.json(
          {
            error: error.message
          },
          400
        );
      }

      throw error;
    }
  });

  app.get("/api/jobs/:jobId", async (context) => {
    const job = await repository.getById(context.req.param("jobId"));

    if (!job) {
      return context.json({ error: "Job not found" }, 404);
    }

    return context.json(job);
  });

  app.get("/api/jobs", async (context) => {
    const limit = Number.parseInt(context.req.query("limit") ?? "10", 10);
    const recentJobs = await repository.listRecent(Number.isFinite(limit) && limit > 0 ? limit : 10);

    return context.json(recentJobs);
  });

  app.get("/api/runtime", (context) => {
    return context.json(runtime);
  });

  app.get("/api/destination-stores", (context) => {
    return context.json(runtime.destinationStores);
  });

  return app;
}
