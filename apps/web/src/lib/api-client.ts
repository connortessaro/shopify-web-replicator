import type {
  AppRuntimeConfig,
  DestinationStoreProfile,
  ReferenceIntake,
  ReplicationJob,
  ReplicationJobSummary
} from "@shopify-web-replicator/shared";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function submitReference(intake: ReferenceIntake): Promise<ReplicationJobSummary> {
  const response = await fetch(`${apiBaseUrl}/api/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(intake)
  });

  return parseJsonResponse<ReplicationJobSummary>(response);
}

export async function loadJob(jobId: string): Promise<ReplicationJob> {
  const response = await fetch(`${apiBaseUrl}/api/jobs/${jobId}`);

  return parseJsonResponse<ReplicationJob>(response);
}

export async function loadRecentJobs(limit = 5): Promise<ReplicationJobSummary[]> {
  const response = await fetch(`${apiBaseUrl}/api/jobs?limit=${limit}`);

  return parseJsonResponse<ReplicationJobSummary[]>(response);
}

export async function loadRuntime(): Promise<AppRuntimeConfig> {
  const response = await fetch(`${apiBaseUrl}/api/runtime`);

  return parseJsonResponse<AppRuntimeConfig>(response);
}

export async function loadDestinationStores(): Promise<DestinationStoreProfile[]> {
  const response = await fetch(`${apiBaseUrl}/api/destination-stores`);

  return parseJsonResponse<DestinationStoreProfile[]>(response);
}
