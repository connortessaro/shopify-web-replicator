import { Hono } from "hono";
import { cors } from "hono/cors";
import { ZodError } from "zod";

import type {
  AppRuntimeConfig,
  HydrogenReplicationIntake,
  HydrogenReplicationJobSummary,
  ReferenceIntake,
  ReplicationJobSummary
} from "@shopify-web-replicator/shared";
import {
  createReplicationJob,
  hydrogenReplicationIntakeSchema,
  referenceIntakeSchema
} from "@shopify-web-replicator/shared";

import { logger } from "./logger.js";
import { InMemoryJobRepository, type JobRepository } from "./repository/in-memory-job-repository.js";
import { getDefaultRuntimeConfig } from "./runtime.js";

type CreateAppOptions = {
  repository?: JobRepository;
  createJob?: (intake: ReferenceIntake) => Promise<ReplicationJobSummary>;
  createHydrogenJob?: (intake: HydrogenReplicationIntake) => Promise<HydrogenReplicationJobSummary>;
  enqueueJob?: (jobId: string) => Promise<void> | void;
  runtime?: AppRuntimeConfig;
  allowedOrigins?: string[];
};

const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:8787",
  "http://127.0.0.1:8787"
] as const;

function resolveAllowedOrigins(configuredOrigins: string[] = []): string[] {
  return [...new Set([...defaultAllowedOrigins, ...configuredOrigins.map((origin) => origin.trim()).filter(Boolean)])];
}

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
  const createHydrogenJob =
    options.createHydrogenJob ??
    (async (intake: HydrogenReplicationIntake) => ({
      jobId: `hydrogen-${intake.targetId}`,
      pipelineKind: "hydrogen" as const,
      status: "in_progress",
      currentStage: "source_qualification",
      createdAt: new Date().toISOString(),
      targetId: intake.targetId,
      referenceUrl: intake.referenceUrl
    }));
  const runtime = options.runtime ?? getDefaultRuntimeConfig();
  const allowedOrigins = resolveAllowedOrigins(options.allowedOrigins);
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin) {
          return null;
        }

        return allowedOrigins.includes(origin) ? origin : null;
      }
    })
  );

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
          logger.error("Failed to enqueue replication job", {
            jobId: created.jobId,
            error
          });
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

  app.post("/api/hydrogen/jobs", async (context) => {
    try {
      const payload = await context.req.json();
      const intake = hydrogenReplicationIntakeSchema.parse(payload);
      const created = await createHydrogenJob(intake);

      return context.json(created, 201);
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        return context.json(
          {
            error: "Invalid Hydrogen intake payload",
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

  app.get("/api/runtime", (context) => {
    return context.json(runtime);
  });

  app.get("/api/destination-stores", (context) => {
    return context.json(runtime.destinationStores);
  });

  return app;
}
