import { describe, expect, it } from "vitest";

import { createReplicationJob, pipelineStages } from "./job";

describe("createReplicationJob", () => {
  it("creates a job ready for deterministic analysis with stable pending theme, setup, commerce, and integration artifacts", () => {
    const job = createReplicationJob({
      referenceUrl: "https://example.com",
      notes: "hero-focused landing page",
      pageType: "landing_page"
    });

    expect(job.status).toBe("in_progress");
    expect(job.currentStage).toBe("analysis");
    expect(job.intake).toEqual({
      referenceUrl: "https://example.com",
      notes: "hero-focused landing page",
      pageType: "landing_page"
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
      summary: "Preparing deterministic landing page analysis.",
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
      },
      {
        kind: "config",
        path: "config/generated-store-setup.json",
        status: "pending",
        description: "Deterministic store setup plan covering products, collections, menus, and structured content"
      },
      {
        kind: "snippet",
        path: "snippets/generated-commerce-wiring.liquid",
        status: "pending",
        description: "Deterministic commerce wiring snippet covering cart entrypoints and native checkout handoff"
      },
      {
        kind: "config",
        path: "config/generated-integration-report.json",
        status: "pending",
        description: "Deterministic integration report covering theme, store setup, and commerce consistency"
      }
    ]);
    expect(job.analysis).toBeUndefined();
    expect(job.mapping).toBeUndefined();
    expect(job.generation).toBeUndefined();
    expect(job.storeSetup).toBeUndefined();
    expect(job.commerce).toBeUndefined();
    expect(job.integration).toBeUndefined();
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

  it("creates product-page jobs with product-specific stable artifacts", () => {
    const job = createReplicationJob({
      referenceUrl: "https://example.com/products/trail-pack",
      pageType: "product_page"
    });

    expect(job.intake.pageType).toBe("product_page");
    expect(job.stages[1]).toMatchObject({
      summary: "Preparing deterministic product page analysis."
    });
    expect(job.artifacts).toEqual([
      {
        kind: "section",
        path: "sections/generated-product-reference.liquid",
        status: "pending",
        description: "Stable generated product section output"
      },
      {
        kind: "template",
        path: "templates/product.generated-reference.json",
        status: "pending",
        description: "Generated product template that references the stable product section"
      },
      {
        kind: "config",
        path: "config/generated-store-setup.json",
        status: "pending",
        description: "Deterministic store setup plan covering products, collections, menus, and structured content"
      },
      {
        kind: "snippet",
        path: "snippets/generated-commerce-wiring.liquid",
        status: "pending",
        description: "Deterministic commerce wiring snippet covering cart entrypoints and native checkout handoff"
      },
      {
        kind: "config",
        path: "config/generated-integration-report.json",
        status: "pending",
        description: "Deterministic integration report covering theme, store setup, and commerce consistency"
      }
    ]);
  });
});
