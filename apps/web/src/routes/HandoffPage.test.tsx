import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HandoffPage } from "./HandoffPage";

describe("HandoffPage", () => {
  it("shows the selected job handoff with runtime config and validation output", async () => {
    const loadJob = async () => ({
      id: "job_123",
      status: "needs_review",
      currentStage: "review",
      intake: {
        referenceUrl: "https://example.com"
      },
      stages: [],
      artifacts: [
        {
          kind: "section",
          path: "sections/generated-reference.liquid",
          status: "generated",
          description: "Primary generated landing section output",
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
      storeSetup: {
        plannedAt: "2026-03-20T12:04:00.000Z",
        configPath: "config/generated-store-setup.json",
        summary: "Prepared deterministic store setup plan for Example Storefront.",
        products: [
          {
            handle: "example-storefront-primary",
            title: "Example Storefront Primary",
            merchandisingRole: "Primary offer for the generated storefront."
          }
        ],
        collections: [],
        menus: [
          {
            handle: "main-menu",
            title: "Main menu",
            items: [
              {
                title: "Shop",
                target: "/collections/example-storefront-featured"
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
        summary: "Prepared deterministic commerce wiring plan for Example Storefront with native Shopify cart and checkout handoff.",
        cartPath: "/cart",
        checkoutPath: "/checkout",
        entrypoints: [
          {
            label: "Primary CTA",
            target: "/products/example-storefront-primary",
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
        summary: "All deterministic integration checks passed for Example Storefront.",
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
        output: "No theme issues detected."
      },
      createdAt: "2026-03-20T12:00:00.000Z",
      updatedAt: "2026-03-20T12:03:00.000Z"
    });
    const loadRuntime = async () => ({
      themeWorkspacePath: "/tmp/theme-workspace",
      previewCommand: "shopify theme dev"
    });

    render(
      <MemoryRouter initialEntries={["/jobs/job_123/handoff"]}>
        <Routes>
          <Route
            path="/jobs/:jobId/handoff"
            element={<HandoffPage loadJob={loadJob} loadRuntime={loadRuntime} />}
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/local shopify theme workspace/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/\/tmp\/theme-workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/shopify theme dev/i)).toBeInTheDocument();
    expect(screen.getByText(/no theme issues detected/i)).toBeInTheDocument();
    expect(screen.getByText(/sections\/generated-reference\.liquid/i)).toBeInTheDocument();
    expect(screen.getAllByText(/config\/generated-store-setup\.json/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/example-storefront-primary/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/snippets\/generated-commerce-wiring\.liquid/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/\/checkout/i)).toBeInTheDocument();
    expect(screen.getByText(/all deterministic integration checks passed for example storefront/i)).toBeInTheDocument();
    expect(screen.getAllByText(/config\/generated-integration-report\.json/i).length).toBeGreaterThan(0);
  });
});
