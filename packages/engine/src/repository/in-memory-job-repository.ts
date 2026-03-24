import type { ReplicationJob, ReplicationJobSummary } from "@shopify-web-replicator/shared";

export interface JobRepository {
  save(job: ReplicationJob): Promise<ReplicationJob>;
  getById(jobId: string): Promise<ReplicationJob | undefined>;
  listRecent(limit: number): Promise<ReplicationJobSummary[]>;
}

export class InMemoryJobRepository implements JobRepository {
  #jobs = new Map<string, ReplicationJob>();

  async save(job: ReplicationJob): Promise<ReplicationJob> {
    this.#jobs.set(job.id, job);
    return job;
  }

  async getById(jobId: string): Promise<ReplicationJob | undefined> {
    return this.#jobs.get(jobId);
  }

  async listRecent(limit: number): Promise<ReplicationJobSummary[]> {
    return Array.from(this.#jobs.values())
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit)
      .map((job) => ({
        jobId: job.id,
        status: job.status,
        currentStage: job.currentStage,
        createdAt: job.createdAt,
        pageType: job.intake.pageType,
        destinationStore: job.intake.destinationStore
      }));
  }
}
