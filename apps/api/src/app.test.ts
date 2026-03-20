import { describe, expect, it } from "vitest";

import { createApp } from "./app";

describe("createApp", () => {
  it("returns a health payload", async () => {
    const app = createApp();

    const response = await app.request("/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("creates a replication job from the intake payload", async () => {
    const app = createApp();

    const response = await app.request("/api/jobs", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        referenceUrl: "https://example.com",
        notes: "mobile-first PDP"
      })
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      currentStage: "intake",
      status: "in_progress"
    });
  });

  it("returns a stored replication job by id", async () => {
    const app = createApp();

    const createResponse = await app.request("/api/jobs", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        referenceUrl: "https://example.com/product",
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
        notes: "PDP recreation"
      }
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

