import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { ReplicationJob, ReplicationJobSummary } from "@shopify-web-replicator/shared";

import type { JobRepository } from "./in-memory-job-repository.js";

type StoredJobRow = {
  payload: string;
};

type StoredJobSummaryRow = {
  id: string;
  status: ReplicationJobSummary["status"];
  current_stage: ReplicationJobSummary["currentStage"];
  created_at: string;
};

export class SqliteJobRepository implements JobRepository {
  readonly #database: DatabaseSync;

  constructor(databasePath: string) {
    mkdirSync(dirname(databasePath), { recursive: true });
    this.#database = new DatabaseSync(databasePath);
    this.#database.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS replication_jobs (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        current_stage TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );
    `);
  }

  async save(job: ReplicationJob): Promise<ReplicationJob> {
    this.#database
      .prepare(
        `
          INSERT INTO replication_jobs (id, status, current_stage, created_at, updated_at, payload)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            status = excluded.status,
            current_stage = excluded.current_stage,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at,
            payload = excluded.payload
        `
      )
      .run(job.id, job.status, job.currentStage, job.createdAt, job.updatedAt, JSON.stringify(job));

    return job;
  }

  async getById(jobId: string): Promise<ReplicationJob | undefined> {
    const row = this.#database
      .prepare("SELECT payload FROM replication_jobs WHERE id = ?")
      .get(jobId) as StoredJobRow | undefined;

    if (!row) {
      return undefined;
    }

    return JSON.parse(row.payload) as ReplicationJob;
  }

  async listRecent(limit: number): Promise<ReplicationJobSummary[]> {
    return (
      this.#database
        .prepare(
          `
            SELECT id, status, current_stage, created_at
            FROM replication_jobs
            ORDER BY created_at DESC
            LIMIT ?
          `
        )
        .all(limit) as StoredJobSummaryRow[]
    ).map((row) => ({
      jobId: row.id,
      status: row.status,
      currentStage: row.current_stage,
      createdAt: row.created_at
    }));
  }
}
