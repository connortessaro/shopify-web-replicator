import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createReplicationJob } from "@shopify-web-replicator/shared";

import { SqliteJobRepository } from "./sqlite-job-repository";

describe("SqliteJobRepository", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
    tempDirectories.length = 0;
  });

  it("persists and reloads replication jobs from a SQLite database file", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "shopify-web-replicator-sqlite-"));
    tempDirectories.push(tempDirectory);

    const databasePath = join(tempDirectory, "replicator.db");
    const job = createReplicationJob({
      referenceUrl: "https://example.com",
      destinationStore: "local-dev-store",
      notes: "Preserve the hero hierarchy"
    });

    const repository = new SqliteJobRepository(databasePath);
    await repository.save(job);

    const reloadedRepository = new SqliteJobRepository(databasePath);

    await expect(reloadedRepository.getById(job.id)).resolves.toEqual(job);
  });

  it("updates an existing job with the latest pipeline state", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "shopify-web-replicator-sqlite-"));
    tempDirectories.push(tempDirectory);

    const databasePath = join(tempDirectory, "replicator.db");
    const repository = new SqliteJobRepository(databasePath);
    const job = createReplicationJob({
      referenceUrl: "https://example.com/offer",
      destinationStore: "local-dev-store"
    });

    await repository.save(job);

    const updatedJob = {
      ...job,
      status: "needs_review" as const,
      currentStage: "review" as const,
      updatedAt: "2026-03-20T12:05:00.000Z"
    };

    await repository.save(updatedJob);

    await expect(repository.getById(job.id)).resolves.toMatchObject({
      id: job.id,
      status: "needs_review",
      currentStage: "review",
      updatedAt: "2026-03-20T12:05:00.000Z"
    });
  });
});
