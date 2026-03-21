import type { ReplicationJob } from "@shopify-web-replicator/shared";

export interface JobRepository {
  save(job: ReplicationJob): Promise<ReplicationJob>;
  getById(jobId: string): Promise<ReplicationJob | undefined>;
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
}
