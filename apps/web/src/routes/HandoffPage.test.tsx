import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ReplicationJob } from "@shopify-web-replicator/shared";

import { HandoffPage } from "./HandoffPage";

function hasTextContent(pattern: RegExp) {
  return (_content: string, element: Element | null) => Boolean(element?.textContent && pattern.test(element.textContent));
}

describe("HandoffPage", () => {
  it("shows the selected job handoff with runtime config and validation output", async () => {
    const loadJob = async (): Promise<ReplicationJob> => ({
      id: "job_123",
      status: "needs_review",
      currentStage: "review",
      intake: {
        referenceUrl: "https://example.com",
        destinationStore: "local-dev-store",
        pageType: "landing_page"
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
          description: "Import-ready store setup bundle covering products, collections, menus, and structured content",
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
      capture: {
        sourceUrl: "https://example.com",
        resolvedUrl: "https://example.com/",
        referenceHost: "example.com",
        title: "Example Storefront",
        description: "Captured storefront hero and navigation.",
        capturedAt: "2026-03-20T12:00:30.000Z",
        captureBundlePath: "/tmp/captures/job_123/capture-bundle.json",
        desktopScreenshotPath: "/tmp/captures/job_123/desktop.jpg",
        mobileScreenshotPath: "/tmp/captures/job_123/mobile.jpg",
        textContent: "Example Storefront",
        headingOutline: ["Example Storefront"],
        navigationLinks: [{ label: "Shop", href: "https://example.com/collections/all" }],
        primaryCtas: [{ label: "Buy now", href: "https://example.com/products/example-storefront-primary" }],
        imageAssets: [{ src: "https://example.com/cdn/hero.jpg", alt: "Hero" }],
        styleTokens: {
          dominantColors: ["rgb(255, 255, 255)", "rgb(17, 24, 39)"],
          fontFamilies: ["Inter", "Georgia"],
          bodyTextColor: "rgb(17, 24, 39)"
        },
        routeHints: {
          productHandles: ["example-storefront-primary"],
          collectionHandles: ["all"],
          cartPath: "/cart",
          checkoutPath: "/checkout"
        }
      },
      sourceQualification: {
        status: "supported",
        platform: "shopify",
        referenceHost: "example.com",
        resolvedUrl: "https://example.com/",
        qualifiedAt: "2026-03-20T12:00:15.000Z",
        summary: "Verified a supported public Shopify storefront source.",
        evidence: ["window.Shopify"],
        httpStatus: 200,
        isPasswordProtected: false
      },
      storeSetup: {
        plannedAt: "2026-03-20T12:04:00.000Z",
        configPath: "config/generated-store-setup.json",
        importBundlePath: "config/generated-store-setup.json",
        summary: "Prepared import-ready store setup bundle for Example Storefront.",
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
      captureRootPath: "/tmp/captures",
      previewCommand: "shopify theme dev",
      destinationStores: [
        {
          id: "local-dev-store",
          label: "Local Dev Store",
          shopDomain: "local-dev-store.myshopify.com"
        }
      ]
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
    expect(screen.getAllByText(/\/tmp\/captures/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/shopify theme dev/i)).toBeInTheDocument();
    expect(screen.getAllByText(hasTextContent(/destination store: local-dev-store/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/verified a supported public shopify storefront source/i)).toBeInTheDocument();
    expect(screen.getAllByText(hasTextContent(/captured example storefront from example\.com/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/\/tmp\/captures\/job_123\/capture-bundle\.json/i)).toBeInTheDocument();
    expect(screen.getByText(/inter, georgia/i)).toBeInTheDocument();
    expect(screen.getByText(/no theme issues detected/i)).toBeInTheDocument();
    expect(screen.getByText(/sections\/generated-reference\.liquid/i)).toBeInTheDocument();
    expect(screen.getAllByText(/config\/generated-store-setup\.json/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/example-storefront-primary/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/snippets\/generated-commerce-wiring\.liquid/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/\/checkout/i)).toBeInTheDocument();
    expect(screen.getByText(/all deterministic integration checks passed for example storefront/i)).toBeInTheDocument();
    expect(screen.getAllByText(/config\/generated-integration-report\.json/i).length).toBeGreaterThan(0);
  });

  it("shows an error if the route does not include a job id", async () => {
    const loadJob = vi.fn<(jobId: string) => Promise<ReplicationJob>>().mockResolvedValue({
      id: "job_123",
      status: "needs_review",
      currentStage: "review",
      intake: {
        referenceUrl: "https://example.com",
        destinationStore: "local-dev-store",
        pageType: "landing_page"
      },
      stages: [],
      artifacts: [],
      validation: {
        status: "passed",
        summary: "Theme check passed."
      },
      createdAt: "2026-03-20T12:00:00.000Z",
      updatedAt: "2026-03-20T12:01:00.000Z"
    });
    const loadRuntime = vi.fn().mockResolvedValue({
      themeWorkspacePath: "/tmp/theme-workspace",
      captureRootPath: "/tmp/captures",
      previewCommand: "shopify theme dev",
      destinationStores: []
    });

    render(
      <MemoryRouter initialEntries={["/jobs/handoff"]}>
        <Routes>
          <Route
            path="/jobs/:jobId?/handoff"
            element={<HandoffPage loadJob={loadJob} loadRuntime={loadRuntime} />}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/missing job id/i)).toBeInTheDocument();
    expect(loadJob).not.toHaveBeenCalled();
  });

  it("shows a handoff error when runtime config cannot be loaded", async () => {
    const loadJob = vi.fn<(jobId: string) => Promise<ReplicationJob>>().mockResolvedValue({
      id: "job_123",
      status: "needs_review",
      currentStage: "review",
      intake: {
        referenceUrl: "https://example.com",
        destinationStore: "local-dev-store",
        pageType: "landing_page"
      },
      stages: [],
      artifacts: [],
      validation: {
        status: "passed",
        summary: "Theme check passed."
      },
      createdAt: "2026-03-20T12:00:00.000Z",
      updatedAt: "2026-03-20T12:01:00.000Z",
      capture: {
        sourceUrl: "https://example.com",
        resolvedUrl: "https://example.com/",
        referenceHost: "example.com",
        title: "Example Storefront",
        description: "Captured storefront.",
        capturedAt: "2026-03-20T12:01:00.000Z",
        captureBundlePath: "/tmp/captures/job_123/capture-bundle.json",
        desktopScreenshotPath: "/tmp/captures/job_123/desktop.jpg",
        mobileScreenshotPath: "/tmp/captures/job_123/mobile.jpg",
        textContent: "Example Storefront",
        headingOutline: ["Example Storefront"],
        navigationLinks: [],
        primaryCtas: [],
        imageAssets: [],
        styleTokens: {
          dominantColors: ["rgb(255, 255, 255)", "rgb(17, 24, 39)"],
          fontFamilies: ["Inter", "Georgia"]
        },
        routeHints: {
          productHandles: [],
          collectionHandles: []
        }
      }
    });

    render(
      <MemoryRouter initialEntries={["/jobs/job_123/handoff"]}>
        <Routes>
          <Route path="/jobs/:jobId/handoff" element={<HandoffPage loadJob={loadJob} loadRuntime={vi.fn().mockRejectedValue(new Error("runtime unavailable"))} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/unable to load the handoff view\./i)).toBeInTheDocument();
    });
  });
});
