import { describe, expect, it, vi } from "vitest";

import type { ReplicationJob } from "@shopify-web-replicator/shared";

import { createReplicatorMcpHandlers } from "./server";

function createJob(): ReplicationJob {
  return {
    id: "job_123",
    status: "needs_review",
    currentStage: "review",
    intake: {
      referenceUrl: "https://example.com",
      pageType: "landing_page",
      notes: "Hero-first landing page"
    },
    stages: [],
    artifacts: [],
    analysis: {
      sourceUrl: "https://example.com",
      referenceHost: "example.com",
      pageType: "landing_page",
      title: "Example Storefront",
      summary: "Prepared deterministic landing page analysis for Example Storefront.",
      analyzedAt: "2026-03-20T12:01:00.000Z",
      recommendedSections: ["hero", "rich_text", "cta"]
    },
    mapping: {
      sourceUrl: "https://example.com",
      title: "Example Storefront",
      summary: "Mapped Example Storefront into the stable generated landing template.",
      mappedAt: "2026-03-20T12:02:00.000Z",
      templatePath: "templates/page.generated-reference.json",
      sectionPath: "sections/generated-reference.liquid",
      sections: []
    },
    generation: {
      generatedAt: "2026-03-20T12:03:00.000Z",
      templatePath: "templates/page.generated-reference.json",
      sectionPath: "sections/generated-reference.liquid"
    },
    storeSetup: {
      plannedAt: "2026-03-20T12:04:00.000Z",
      configPath: "config/generated-store-setup.json",
      summary: "Prepared deterministic store setup plan for Example Storefront.",
      products: [],
      collections: [],
      menus: [],
      contentModels: []
    },
    commerce: {
      plannedAt: "2026-03-20T12:05:00.000Z",
      snippetPath: "snippets/generated-commerce-wiring.liquid",
      summary: "Prepared deterministic commerce wiring plan for Example Storefront with native Shopify cart and checkout handoff.",
      cartPath: "/cart",
      checkoutPath: "/checkout",
      entrypoints: [],
      qaChecklist: []
    },
    integration: {
      checkedAt: "2026-03-20T12:07:00.000Z",
      reportPath: "config/generated-integration-report.json",
      status: "passed",
      summary: "All deterministic integration checks passed for Example Storefront.",
      checks: []
    },
    validation: {
      status: "passed",
      summary: "Final theme validation passed.",
      checkedAt: "2026-03-20T12:06:00.000Z",
      output: "No issues detected."
    },
    createdAt: "2026-03-20T12:00:00.000Z",
    updatedAt: "2026-03-20T12:07:00.000Z"
  };
}

describe("createReplicatorMcpHandlers", () => {
  it("returns structured content for the one-shot replicate storefront tool", async () => {
    const replicateStorefront = vi.fn().mockResolvedValue({
      job: createJob(),
      runtime: {
        themeWorkspacePath: "/tmp/theme-workspace",
        previewCommand: "shopify theme dev"
      },
      nextActions: [
        "Review the generated artifacts in the theme workspace.",
        "Run the preview command and verify layout, content wiring, and cart-to-checkout handoff.",
        "Resolve any failed validation or integration checks before publish."
      ]
    });
    const handlers = createReplicatorMcpHandlers({
      replicateStorefront,
      getJob: vi.fn(),
      listRecentJobs: vi.fn()
    } as never);

    const result = await handlers.replicateStorefront({
      referenceUrl: "https://example.com",
      pageType: "landing_page",
      notes: "Hero-first landing page"
    });

    expect(replicateStorefront).toHaveBeenCalledWith({
      referenceUrl: "https://example.com",
      pageType: "landing_page",
      notes: "Hero-first landing page"
    });
    expect(result.structuredContent).toMatchObject({
      jobId: "job_123",
      status: "needs_review",
      currentStage: "review",
      themeWorkspacePath: "/tmp/theme-workspace",
      previewCommand: "shopify theme dev",
      nextActions: [
        "Review the generated artifacts in the theme workspace.",
        "Run the preview command and verify layout, content wiring, and cart-to-checkout handoff.",
        "Resolve any failed validation or integration checks before publish."
      ]
    });
    expect(result.content[0]?.type).toBe("text");
    expect(result.content[0]?.text).toContain("needs_review");
  });

  it("returns a structured tool failure when replication ends in a failed terminal state", async () => {
    const failedJob = {
      ...createJob(),
      status: "failed" as const,
      currentStage: "validation" as const,
      error: {
        stage: "validation" as const,
        message: "Theme validation failed."
      }
    };
    const handlers = createReplicatorMcpHandlers({
      replicateStorefront: vi.fn().mockResolvedValue({
        job: failedJob,
        runtime: {
          themeWorkspacePath: "/tmp/theme-workspace",
          previewCommand: "shopify theme dev"
        },
        nextActions: ["Inspect the recorded pipeline error and any generated artifacts."]
      }),
      getJob: vi.fn(),
      listRecentJobs: vi.fn()
    } as never);

    const result = await handlers.replicateStorefront({
      referenceUrl: "https://example.com",
      pageType: "landing_page"
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      status: "failed",
      currentStage: "validation",
      error: {
        code: "replication_failed",
        message: "Theme validation failed.",
        stage: "validation"
      }
    });
  });

  it("returns structured content for helper read tools", async () => {
    const getJob = vi.fn().mockResolvedValue(createJob());
    const listRecentJobs = vi.fn().mockResolvedValue([
      {
        jobId: "job_123",
        status: "needs_review",
        currentStage: "review",
        createdAt: "2026-03-20T12:00:00.000Z",
        pageType: "landing_page"
      }
    ]);
    const handlers = createReplicatorMcpHandlers({
      replicateStorefront: vi.fn(),
      getJob,
      listRecentJobs
    } as never);

    const jobResult = await handlers.getReplicationJob({ jobId: "job_123" });
    const listResult = await handlers.listReplicationJobs({ limit: 1 });

    expect(getJob).toHaveBeenCalledWith("job_123");
    expect(listRecentJobs).toHaveBeenCalledWith(1);
    expect(jobResult.structuredContent).toMatchObject({
      id: "job_123",
      status: "needs_review"
    });
    expect(listResult.structuredContent).toEqual([
      expect.objectContaining({
        jobId: "job_123"
      })
    ]);
  });

  it("returns a structured not-found error for missing jobs", async () => {
    const handlers = createReplicatorMcpHandlers({
      replicateStorefront: vi.fn(),
      getJob: vi.fn().mockResolvedValue(undefined),
      listRecentJobs: vi.fn()
    } as never);

    const result = await handlers.getReplicationJob({ jobId: "missing-job" });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      error: {
        code: "job_not_found",
        message: "Replication job missing-job was not found."
      }
    });
  });
});
