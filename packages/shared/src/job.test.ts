import { describe, expect, it } from "vitest";

import { createReplicationJob, pipelineStages } from "./job";

describe("createReplicationJob", () => {
  it("creates a job with the expected stage order and current stage", () => {
    const job = createReplicationJob({
      referenceUrl: "https://example.com",
      notes: "hero-focused landing page"
    });

    expect(job.status).toBe("in_progress");
    expect(job.currentStage).toBe("intake");
    expect(job.intake).toEqual({
      referenceUrl: "https://example.com",
      notes: "hero-focused landing page"
    });
    expect(job.stages.map((stage) => stage.name)).toEqual([...pipelineStages]);
    expect(job.stages[0]).toMatchObject({ name: "intake", status: "current" });
    expect(job.stages.slice(1).every((stage) => stage.status === "pending")).toBe(true);
  });

  it("seeds placeholder generated artifacts for the future theme output", () => {
    const job = createReplicationJob({
      referenceUrl: "https://example.com"
    });

    expect(job.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "section",
          path: "sections/generated-reference.liquid",
          status: "placeholder"
        }),
        expect.objectContaining({
          kind: "template",
          path: "templates/page.generated-reference.json",
          status: "placeholder"
        })
      ])
    );
  });
});

