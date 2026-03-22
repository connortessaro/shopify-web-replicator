import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ReplicationJob } from "@shopify-web-replicator/shared";

import { JobDetailPage } from "./JobDetailPage";

function createJob(overrides: Partial<ReplicationJob> = {}): ReplicationJob {
  return {
    id: "job_123",
    status: "needs_review",
    currentStage: "review",
    intake: {
      referenceUrl: "https://example.com/collection",
      notes: "Collection page rebuild",
      pageType: "landing_page"
    },
    stages: [
      {
        name: "intake",
        status: "complete",
        summary: "Reference intake accepted.",
        startedAt: "2026-03-20T12:00:00.000Z",
        completedAt: "2026-03-20T12:00:00.000Z"
      },
      {
        name: "analysis",
        status: "complete",
        summary: "Prepared deterministic analysis for Example Store.",
        startedAt: "2026-03-20T12:00:00.000Z",
        completedAt: "2026-03-20T12:01:00.000Z"
      },
      {
        name: "mapping",
        status: "complete",
        summary: "Built Shopify section and template mapping.",
        startedAt: "2026-03-20T12:01:00.000Z",
        completedAt: "2026-03-20T12:02:00.000Z"
      },
      {
        name: "theme_generation",
        status: "complete",
        summary: "Stable theme outputs generated successfully.",
        startedAt: "2026-03-20T12:02:00.000Z",
        completedAt: "2026-03-20T12:03:00.000Z"
      },
      {
        name: "store_setup",
        status: "complete",
        summary: "Deterministic store setup plan is ready for operator review.",
        startedAt: "2026-03-20T12:03:00.000Z",
        completedAt: "2026-03-20T12:04:00.000Z"
      },
      {
        name: "commerce_wiring",
        status: "complete",
        summary: "Deterministic commerce wiring is ready for operator review.",
        startedAt: "2026-03-20T12:04:00.000Z",
        completedAt: "2026-03-20T12:05:00.000Z"
      },
      {
        name: "integration_check",
        status: "complete",
        summary: "Deterministic integration report is ready for operator review.",
        startedAt: "2026-03-20T12:05:00.000Z",
        completedAt: "2026-03-20T12:06:00.000Z"
      },
      {
        name: "review",
        status: "current",
        summary: "Generated theme files, store setup plan, commerce wiring, and integration report are ready for operator QA.",
        startedAt: "2026-03-20T12:06:00.000Z"
      }
    ],
    artifacts: [
      {
        kind: "section",
        path: "sections/generated-reference.liquid",
        status: "generated",
        description: "Primary generated landing section output",
        lastWrittenAt: "2026-03-20T12:03:00.000Z"
      },
      {
        kind: "template",
        path: "templates/page.generated-reference.json",
        status: "generated",
        description: "Generated JSON template that references the stable landing section",
        lastWrittenAt: "2026-03-20T12:03:00.000Z"
      },
      {
        kind: "config",
        path: "config/generated-store-setup.json",
        status: "generated",
        description: "Deterministic store setup plan covering products, collections, menus, and structured content",
        lastWrittenAt: "2026-03-20T12:04:00.000Z"
      },
      {
        kind: "snippet",
        path: "snippets/generated-commerce-wiring.liquid",
        status: "generated",
        description: "Deterministic commerce wiring snippet covering cart entrypoints and native checkout handoff",
        lastWrittenAt: "2026-03-20T12:05:00.000Z"
      },
      {
        kind: "config",
        path: "config/generated-integration-report.json",
        status: "generated",
        description: "Deterministic integration report covering theme, store setup, and commerce consistency",
        lastWrittenAt: "2026-03-20T12:06:00.000Z"
      }
    ],
    analysis: {
      sourceUrl: "https://example.com/collection",
      referenceHost: "example.com",
      pageType: "landing_page",
      title: "Example Store",
      summary: "Detected a hero-first landing page.",
      analyzedAt: "2026-03-20T12:02:00.000Z",
      recommendedSections: ["hero", "rich_text", "cta"]
    },
    mapping: {
      sourceUrl: "https://example.com/collection",
      title: "Example Store",
      summary: "Mapped Example Store into the stable generated reference section.",
      mappedAt: "2026-03-20T12:03:00.000Z",
      templatePath: "templates/page.generated-reference.json",
      sectionPath: "sections/generated-reference.liquid",
      sections: [
        {
          id: "hero-1",
          type: "hero",
          heading: "Collection page rebuild",
          body: "Hero summary"
        }
      ]
    },
    generation: {
      generatedAt: "2026-03-20T12:03:00.000Z",
      templatePath: "templates/page.generated-reference.json",
      sectionPath: "sections/generated-reference.liquid"
    },
    storeSetup: {
      plannedAt: "2026-03-20T12:04:00.000Z",
      configPath: "config/generated-store-setup.json",
      summary: "Prepared deterministic store setup plan for Example Store.",
      products: [
        {
          handle: "example-store-primary",
          title: "Example Store Primary",
          merchandisingRole: "Primary offer for the generated storefront."
        }
      ],
      collections: [
        {
          handle: "example-store-featured",
          title: "Example Store Featured",
          rule: "Manual collection for generated review.",
          featuredProductHandles: ["example-store-primary"]
        }
      ],
      menus: [
        {
          handle: "main-menu",
          title: "Main menu",
          items: [
            {
              title: "Shop",
              target: "/collections/example-store-featured"
            }
          ]
        }
      ],
      contentModels: [
        {
          name: "feature_callout",
          type: "metaobject",
          fields: ["eyebrow", "heading", "body"]
        }
      ]
    },
    commerce: {
      plannedAt: "2026-03-20T12:05:00.000Z",
      snippetPath: "snippets/generated-commerce-wiring.liquid",
      summary: "Prepared deterministic commerce wiring plan for Example Store with native Shopify cart and checkout handoff.",
      cartPath: "/cart",
      checkoutPath: "/checkout",
      entrypoints: [
        {
          label: "Primary CTA",
          target: "/products/example-store-primary",
          behavior: "Directs the operator to the primary product path before add-to-cart."
        }
      ],
      qaChecklist: [
        "Verify CTA routes land on the expected product or collection path.",
        "Verify the cart uses native Shopify checkout handoff."
      ]
    },
    integration: {
      checkedAt: "2026-03-20T12:06:00.000Z",
      reportPath: "config/generated-integration-report.json",
      status: "passed",
      summary: "All deterministic integration checks passed for Example Store.",
      checks: [
        {
          id: "generated_artifacts",
          status: "passed",
          details: "Theme, store setup, and commerce artifacts are all generated."
        }
      ]
    },
    validation: {
      status: "passed",
      summary: "Theme check passed.",
      checkedAt: "2026-03-20T12:03:30.000Z"
    },
    createdAt: "2026-03-20T12:00:00.000Z",
    updatedAt: "2026-03-20T12:03:30.000Z",
    ...overrides
  };
}

describe("JobDetailPage", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders stage summaries, mapping details, store setup, commerce wiring, integration, validation, and generated artifacts", async () => {
    const job = createJob();
    const loadJob = vi.fn().mockResolvedValue(job);

    render(
      <MemoryRouter initialEntries={[`/jobs/${job.id}`]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobDetailPage loadJob={loadJob} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(loadJob).toHaveBeenCalledWith(job.id);
    });

    expect(await screen.findByText(/analysis summary/i)).toBeInTheDocument();
    expect(screen.getByText(/detected a hero-first landing page/i)).toBeInTheDocument();
    expect(screen.getByText(/mapped example store into the stable generated reference section/i)).toBeInTheDocument();
    expect(screen.getByText(/prepared deterministic store setup plan for example store/i)).toBeInTheDocument();
    expect(screen.getAllByText(/example-store-primary/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/prepared deterministic commerce wiring plan for example store/i)).toBeInTheDocument();
    expect(screen.getAllByText(/snippets\/generated-commerce-wiring\.liquid/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/all deterministic integration checks passed for example store/i)).toBeInTheDocument();
    expect(screen.getAllByText(/config\/generated-integration-report\.json/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/theme check passed/i)).toBeInTheDocument();
    expect(screen.getByText(/primary generated landing section output/i)).toBeInTheDocument();
    expect(screen.getByText(/reference intake accepted/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /review theme workspace handoff/i })).toHaveAttribute(
      "href",
      `/jobs/${job.id}/handoff`
    );
  });

  it("polls until the job reaches a terminal state", async () => {
    const inFlightJob = createJob({
      status: "in_progress",
      currentStage: "mapping",
      stages: [
        {
          name: "intake",
          status: "complete",
          summary: "Reference intake accepted.",
          startedAt: "2026-03-20T12:00:00.000Z",
          completedAt: "2026-03-20T12:00:00.000Z"
        },
        {
          name: "analysis",
          status: "complete",
          summary: "Prepared deterministic analysis for Example Store.",
          startedAt: "2026-03-20T12:00:00.000Z",
          completedAt: "2026-03-20T12:01:00.000Z"
        },
        {
          name: "mapping",
          status: "current",
          summary: "Building Shopify section and template mapping.",
          startedAt: "2026-03-20T12:01:00.000Z"
        },
        {
          name: "theme_generation",
          status: "pending",
          summary: "Waiting for theme generation."
        },
        {
          name: "store_setup",
          status: "pending",
          summary: "Waiting for store setup."
        },
        {
          name: "commerce_wiring",
          status: "pending",
          summary: "Waiting for commerce wiring."
        },
        {
          name: "integration_check",
          status: "pending",
          summary: "Waiting for integration check."
        },
        {
          name: "review",
          status: "pending",
          summary: "Waiting for review."
        }
      ],
      validation: {
        status: "pending",
        summary: "Theme validation has not run yet."
      }
    });
    const finishedJob = createJob();
    const loadJob = vi.fn().mockResolvedValueOnce(inFlightJob).mockResolvedValueOnce(finishedJob);

    render(
      <MemoryRouter initialEntries={[`/jobs/${finishedJob.id}`]}>
        <Routes>
          <Route
            path="/jobs/:jobId"
            element={<JobDetailPage loadJob={loadJob} refreshIntervalMs={10} />}
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(loadJob).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(loadJob).toHaveBeenCalledTimes(2);
    });
    expect(
      (
        await screen.findAllByText(
          /generated theme files, store setup plan, commerce wiring, and integration report are ready for operator qa/i
        )
      ).length
    ).toBeGreaterThan(0);
  });

  it("renders a failed state when the job includes a pipeline error", async () => {
    const job = createJob({
      status: "failed",
      currentStage: "mapping",
      error: {
        stage: "mapping",
        message: "Mapping failed"
      },
      validation: {
        status: "pending",
        summary: "Theme validation has not run yet."
      }
    });
    const loadJob = vi.fn().mockResolvedValue(job);

    render(
      <MemoryRouter initialEntries={[`/jobs/${job.id}`]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobDetailPage loadJob={loadJob} />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/mapping failed/i)).toBeInTheDocument();
    expect(screen.getAllByText(/theme validation has not run yet/i).length).toBeGreaterThan(0);
  });
});
