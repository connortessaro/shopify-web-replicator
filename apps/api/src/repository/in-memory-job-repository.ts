import type { ReplicationJob } from "@shopify-web-replicator/shared";

export interface JobRepository {
  save(job: ReplicationJob): ReplicationJob;
  getById(jobId: string): ReplicationJob | undefined;
}

export class InMemoryJobRepository implements JobRepository {
  #jobs = new Map<string, ReplicationJob>();

  save(job: ReplicationJob): ReplicationJob {
    this.#jobs.set(job.id, job);
    return job;
  }

  getById(jobId: string): ReplicationJob | undefined {
    return this.#jobs.get(jobId);
  }
}

