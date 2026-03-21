import { describe, expect, it } from "vitest";

import { createReplicationJob, pipelineStages } from "./job";

describe("createReplicationJob", () => {
  it("creates a job ready for deterministic analysis with stable pending theme artifacts", () => {
    const job = createReplicationJob({
      referenceUrl: "https://example.com",
      notes: "hero-focused landing page"
    });

    expect(job.status).toBe("in_progress");
    expect(job.currentStage).toBe("analysis");
    expect(job.intake).toEqual({
      referenceUrl: "https://example.com",
      notes: "hero-focused landing page"
    });
    expect(job.stages.map((stage) => stage.name)).toEqual([...pipelineStages]);
    expect(job.stages[0]).toMatchObject({
      name: "intake",
      status: "complete",
      summary: "Reference intake accepted.",
      completedAt: job.createdAt
    });
    expect(job.stages[1]).toMatchObject({
      name: "analysis",
      status: "current",
      summary: "Preparing deterministic landing-page analysis.",
      startedAt: job.createdAt
    });
    expect(job.stages.slice(2).every((stage) => stage.status === "pending")).toBe(true);
    expect(job.artifacts).toEqual([
      {
        kind: "section",
        path: "sections/generated-reference.liquid",
        status: "pending",
        description: "Primary generated landing section output"
      },
      {
        kind: "template",
        path: "templates/page.generated-reference.json",
        status: "pending",
        description: "Generated JSON template that references the stable landing section"
      }
    ]);
    expect(job.analysis).toBeUndefined();
    expect(job.mapping).toBeUndefined();
    expect(job.generation).toBeUndefined();
    expect(job.validation).toEqual({
      status: "pending",
      summary: "Theme validation has not run yet."
    });
    expect(job.error).toBeUndefined();
  });

  it("starts with review-only terminal states unset", () => {
    const job = createReplicationJob({
      referenceUrl: "https://example.com/offer"
    });

    expect(job.status).not.toBe("failed");
    expect(job.status).not.toBe("needs_review");
    expect(job.error).toBeUndefined();
  });
});
