import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createReplicationJob } from "@shopify-web-replicator/shared";

import { SqliteJobRepository } from "./repository/sqlite-job-repository";
import { createApp } from "./app";

describe("createApp", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
    tempDirectories.length = 0;
  });

  it("returns a health payload", async () => {
    const app = createApp();

    const response = await app.request("/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("allows localhost origins for the companion web app by default", async () => {
    const app = createApp();

    const response = await app.request("/health", {
      headers: {
        origin: "http://localhost:5173"
      }
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    expect(response.headers.get("Vary")).toContain("Origin");
  });

  it("does not allow arbitrary origins by default", async () => {
    const app = createApp();

    const response = await app.request("/health", {
      headers: {
        origin: "https://evil.example"
      }
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("allows configured extra origins for companion surfaces", async () => {
    const app = createApp({
      allowedOrigins: ["https://preview.example.com"]
    });

    const response = await app.request("/health", {
      headers: {
        origin: "https://preview.example.com"
      }
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://preview.example.com");
  });

  it("creates a replication job, persists it, and enqueues background processing", async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-api-"));
    tempDirectories.push(dataRoot);

    const repository = new SqliteJobRepository(join(dataRoot, "replicator.db"));
    const enqueueJob = vi.fn().mockResolvedValue(undefined);
    const app = createApp({
      repository,
      enqueueJob
    });

    const response = await app.request("/api/jobs", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        referenceUrl: "https://example.com",
        destinationStore: "local-dev-store",
        notes: "mobile-first PDP",
        pageType: "product_page"
      })
    });

    expect(response.status).toBe(201);

    const created = await response.json();

    expect(created).toMatchObject({
      currentStage: "source_qualification",
      status: "in_progress"
    });
    expect(enqueueJob).toHaveBeenCalledWith(created.jobId);
    await expect(repository.getById(created.jobId)).resolves.toMatchObject({
      id: created.jobId,
        intake: {
          referenceUrl: "https://example.com",
          destinationStore: "local-dev-store",
          notes: "mobile-first PDP",
          pageType: "product_page"
        }
    });
  });

  it("returns a stored replication job by id", async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-api-"));
    tempDirectories.push(dataRoot);

    const repository = new SqliteJobRepository(join(dataRoot, "replicator.db"));
    const app = createApp({
      repository,
      enqueueJob: async () => undefined
    });

    const createResponse = await app.request("/api/jobs", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        referenceUrl: "https://example.com/product",
        destinationStore: "local-dev-store",
        notes: "PDP recreation"
      })
    });

    const created = await createResponse.json();
    const response = await app.request(`/api/jobs/${created.jobId}`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: created.jobId,
        intake: {
          referenceUrl: "https://example.com/product",
          destinationStore: "local-dev-store",
          notes: "PDP recreation"
        }
    });
  });

  it("lists recent replication jobs newest first and honors the limit query param", async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-api-"));
    tempDirectories.push(dataRoot);

    const repository = new SqliteJobRepository(join(dataRoot, "replicator.db"));
    const olderJob = createReplicationJob({
      referenceUrl: "https://example.com/older",
      destinationStore: "local-dev-store",
      notes: "Older job"
    });
    olderJob.createdAt = "2026-03-20T12:00:00.000Z";
    olderJob.updatedAt = "2026-03-20T12:00:00.000Z";

    const newerJob = createReplicationJob({
      referenceUrl: "https://example.com/newer",
      destinationStore: "local-dev-store",
      notes: "Newer job"
    });
    newerJob.createdAt = "2026-03-20T12:05:00.000Z";
    newerJob.updatedAt = "2026-03-20T12:05:00.000Z";

    await repository.save(olderJob);
    await repository.save(newerJob);

    const app = createApp({
      repository,
      enqueueJob: async () => undefined
    });

    const response = await app.request("/api/jobs?limit=1");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        jobId: newerJob.id,
        status: newerJob.status,
        currentStage: newerJob.currentStage,
        createdAt: newerJob.createdAt,
        pageType: "landing_page",
        destinationStore: "local-dev-store"
      }
    ]);
  });

  it("returns runtime config for the handoff flow", async () => {
    const app = createApp({
      runtime: {
        themeWorkspacePath: "/tmp/theme-workspace",
        captureRootPath: "/tmp/captures",
        previewCommand: "shopify theme dev",
        destinationStores: [
          {
            id: "local-dev-store",
            label: "Local Dev Store",
            shopDomain: "local-dev-store.myshopify.com"
          }
        ]
      }
    } as never);

    const response = await app.request("/api/runtime");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      themeWorkspacePath: "/tmp/theme-workspace",
      captureRootPath: "/tmp/captures",
      previewCommand: "shopify theme dev",
      destinationStores: [
        {
          id: "local-dev-store",
          label: "Local Dev Store",
          shopDomain: "local-dev-store.myshopify.com"
        }
      ]
    });
  });

  it("returns configured destination stores for operator and MCP discovery", async () => {
    const app = createApp({
      runtime: {
        themeWorkspacePath: "/tmp/theme-workspace",
        captureRootPath: "/tmp/captures",
        previewCommand: "shopify theme dev",
        destinationStores: [
          {
            id: "local-dev-store",
            label: "Local Dev Store",
            shopDomain: "local-dev-store.myshopify.com"
          }
        ]
      }
    } as never);

    const response = await app.request("/api/destination-stores");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        id: "local-dev-store",
        label: "Local Dev Store",
        shopDomain: "local-dev-store.myshopify.com"
      }
    ]);
  });

  it("returns validation issues for intake payloads missing a destination store", async () => {
    const app = createApp();

    const response = await app.request("/api/jobs", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        referenceUrl: "https://example.com"
      })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid intake payload"
    });
  });

  it("returns validation issues for invalid intake payloads", async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-api-"));
    tempDirectories.push(dataRoot);

    const repository = new SqliteJobRepository(join(dataRoot, "replicator.db"));
    const app = createApp({
      repository,
      enqueueJob: async () => undefined
    });

    const response = await app.request("/api/jobs", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        referenceUrl: "not-a-url",
        destinationStore: "local-dev-store"
      })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid intake payload"
    });
  });

  it("returns 404 for an unknown replication job id", async () => {
    const app = createApp();

    const response = await app.request("/api/jobs/missing-job");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Job not found"
    });
  });
});
