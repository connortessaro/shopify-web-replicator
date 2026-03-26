import { describe, expect, it, vi } from "vitest";

import type { ReplicationJob } from "@shopify-web-replicator/shared";

import { RuntimePreflightError } from "./runtime-preflight";
import { createReplicatorMcpHandlers } from "./server";

function createJob(): ReplicationJob {
  return {
    id: "job_123",
    status: "needs_review",
    currentStage: "review",
    intake: {
      referenceUrl: "https://example.com",
      destinationStore: "local-dev-store",
      pageType: "landing_page",
      notes: "Hero-first landing page"
    },
    stages: [],
    artifacts: [],
    routeInventory: {
      discoveredAt: "2026-03-20T12:00:20.000Z",
      referenceHost: "example.com",
      summary: "Discovered 3 routes (1 homepage, 1 collections, 1 products, 0 content pages).",
      routes: [
        { kind: "homepage", source: "root", url: "https://example.com/" },
        { kind: "collection_page", source: "navigation", url: "https://example.com/collections/all", handle: "all" },
        { kind: "product_page", source: "cta", url: "https://example.com/products/example-storefront", handle: "example-storefront" }
      ]
    },
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
      primaryCtas: [{ label: "Buy now", href: "https://example.com/products/example-storefront" }],
      imageAssets: [{ src: "https://example.com/cdn/hero.jpg", alt: "Example Storefront hero" }],
      styleTokens: {
        dominantColors: ["rgb(255, 255, 255)", "rgb(17, 24, 39)"],
        fontFamilies: ["Inter", "Georgia"]
      },
      routeHints: {
        productHandles: ["example-storefront"],
        collectionHandles: ["all"],
        cartPath: "/cart",
        checkoutPath: "/checkout"
      },
      routes: [
        {
          kind: "homepage",
          url: "https://example.com/",
          title: "Example Storefront",
          referenceHost: "example.com",
          headingOutline: ["Example Storefront"],
          navigationLinks: [{ label: "Shop", href: "https://example.com/collections/all" }],
          primaryCtas: [{ label: "Buy now", href: "https://example.com/products/example-storefront" }],
          imageAssets: [{ src: "https://example.com/cdn/hero.jpg", alt: "Example Storefront hero" }],
          styleTokens: {
            dominantColors: ["rgb(255, 255, 255)", "rgb(17, 24, 39)"],
            fontFamilies: ["Inter", "Georgia"]
          },
          captureBundlePath: "/tmp/captures/job_123/home/capture-bundle.json",
          desktopScreenshotPath: "/tmp/captures/job_123/home/desktop.jpg",
          mobileScreenshotPath: "/tmp/captures/job_123/home/mobile.jpg"
        }
      ]
    },
    storefrontModel: {
      modeledAt: "2026-03-20T12:00:45.000Z",
      referenceHost: "example.com",
      storeTitle: "Example Storefront",
      summary: "Built storefront model with 3 pages, 1 products, 1 collections, and 1 menus.",
      styleTokens: {
        dominantColors: ["rgb(255, 255, 255)", "rgb(17, 24, 39)"],
        fontFamilies: ["Inter", "Georgia"]
      },
      pages: [
        { kind: "homepage", url: "https://example.com/", title: "Example Storefront" },
        { kind: "collection_page", url: "https://example.com/collections/all", title: "All", handle: "all" },
        { kind: "product_page", url: "https://example.com/products/example-storefront", title: "Example Storefront", handle: "example-storefront" }
      ],
      products: [],
      collections: [],
      menus: [],
      contentModels: [],
      unsupportedFeatures: []
    },
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
    assetSync: {
      syncedAt: "2026-03-20T12:03:15.000Z",
      summary: "Synced 1 theme assets from the source storefront.",
      assets: [
        {
          sourceUrl: "https://example.com/cdn/hero.jpg",
          themePath: "assets/replicator-hero.jpg",
          status: "synced"
        }
      ]
    },
    storeSetup: {
      plannedAt: "2026-03-20T12:04:00.000Z",
      configPath: "config/generated-store-setup.json",
      importBundlePath: "config/generated-store-setup.json",
      summary: "Prepared import-ready store setup bundle for Example Storefront.",
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
    adminReplication: {
      replicatedAt: "2026-03-20T12:05:30.000Z",
      destinationStoreId: "local-dev-store",
      shopDomain: "local-dev-store.myshopify.com",
      themeId: "gid://shopify/OnlineStoreTheme/123456789",
      themeName: "Replicator job_123",
      previewUrl: "https://local-dev-store.myshopify.com?preview_theme_id=123456789",
      summary: "Replicated generated storefront to destination theme Replicator job_123.",
      createdResources: [],
      updatedResources: [],
      warnings: [],
      rollbackManifest: {
        generatedAt: "2026-03-20T12:05:30.000Z",
        resources: []
      }
    },
    parityAudit: {
      checkedAt: "2026-03-20T12:06:30.000Z",
      status: "passed",
      summary: "Parity audit completed for 1 routes.",
      routes: [
        {
          kind: "homepage",
          url: "https://example.com/",
          previewUrl: "https://local-dev-store.myshopify.com?preview_theme_id=123456789",
          status: "matched",
          visualSimilarity: 0.96,
          sourceTitle: "Example Storefront",
          destinationTitle: "Example Storefront",
          notes: []
        }
      ],
      warnings: []
    },
    createdAt: "2026-03-20T12:00:00.000Z",
    updatedAt: "2026-03-20T12:07:00.000Z"
  };
}

describe("createReplicatorMcpHandlers", () => {
  it("validates reference intake and rejects malformed inputs before calling orchestrator", async () => {
    const replicateStorefront = vi.fn();
    const handlers = createReplicatorMcpHandlers({
      replicateStorefront,
      getJob: vi.fn(),
      listRecentJobs: vi.fn()
    } as never);

    await expect(
      handlers.replicateStorefront({
        referenceUrl: "not-a-url",
        destinationStore: "local-dev-store",
        pageType: "landing_page"
      } as never)
    ).rejects.toThrowError();
    expect(replicateStorefront).not.toHaveBeenCalled();
  });

  it("uses the default limit when listing jobs without an explicit limit", async () => {
    const listRecentJobs = vi.fn(async () => []);
    const handlers = createReplicatorMcpHandlers({
      replicateStorefront: vi.fn(),
      getJob: vi.fn(),
      listRecentJobs
    } as never);

    await handlers.listReplicationJobs({});

    expect(listRecentJobs).toHaveBeenCalledWith(10);
  });

  it("returns structured content for the one-shot replicate storefront tool", async () => {
    const replicateStorefront = vi.fn().mockResolvedValue({
      job: createJob(),
      runtime: {
        themeWorkspacePath: "/tmp/theme-workspace",
        captureRootPath: "/tmp/captures",
        previewCommand: "shopify theme dev",
        destinationStores: [
          {
            id: "local-dev-store",
            label: "Local Dev Store",
            shopDomain: "local-dev-store.myshopify.com",
            adminTokenEnvVar: "SHOPIFY_LOCAL_DEV_TOKEN"
          }
        ]
      },
      nextActions: [
        "Review the generated artifacts in the theme workspace.",
        "Open the unpublished destination theme preview and verify route parity, content wiring, and cart-to-checkout handoff.",
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
      destinationStore: "local-dev-store",
      pageType: "landing_page",
      notes: "Hero-first landing page"
    });

    expect(replicateStorefront).toHaveBeenCalledWith({
      referenceUrl: "https://example.com",
      destinationStore: "local-dev-store",
      pageType: "landing_page",
      notes: "Hero-first landing page"
    });
    expect(result.structuredContent).toMatchObject({
      jobId: "job_123",
      status: "needs_review",
      currentStage: "review",
      capture: {
        title: "Example Storefront"
      },
      destinationStore: {
        id: "local-dev-store"
      },
      themeWorkspacePath: "/tmp/theme-workspace",
      captureRootPath: "/tmp/captures",
      previewCommand: "shopify theme dev",
      nextActions: [
        "Review the generated artifacts in the theme workspace.",
        "Open the unpublished destination theme preview and verify route parity, content wiring, and cart-to-checkout handoff.",
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
          captureRootPath: "/tmp/captures",
          previewCommand: "shopify theme dev",
          destinationStores: []
        },
        nextActions: ["Inspect the recorded pipeline error and any generated artifacts."]
      }),
      getJob: vi.fn(),
      listRecentJobs: vi.fn()
    } as never);

    const result = await handlers.replicateStorefront({
      referenceUrl: "https://example.com",
      destinationStore: "local-dev-store",
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
        pageType: "landing_page",
        destinationStore: "local-dev-store"
      }
    ]);
    const handlers = createReplicatorMcpHandlers({
      replicateStorefront: vi.fn(),
      getJob,
      listRecentJobs,
      listDestinationStores: vi.fn().mockReturnValue([
        {
          id: "local-dev-store",
          label: "Local Dev Store",
          shopDomain: "local-dev-store.myshopify.com",
          adminTokenEnvVar: "SHOPIFY_LOCAL_DEV_TOKEN"
        }
      ])
    } as never);

    const jobResult = await handlers.getReplicationJob({ jobId: "job_123" });
    const listResult = await handlers.listReplicationJobs({ limit: 1 });
    const storesResult = await handlers.listDestinationStores();

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
    expect(storesResult.structuredContent).toEqual([
      {
        id: "local-dev-store",
        label: "Local Dev Store",
        shopDomain: "local-dev-store.myshopify.com",
        adminTokenEnvVar: "SHOPIFY_LOCAL_DEV_TOKEN"
      }
    ]);
  });

  it("returns a structured not-found error for missing jobs", async () => {
    const handlers = createReplicatorMcpHandlers({
      replicateStorefront: vi.fn(),
      getJob: vi.fn().mockResolvedValue(undefined),
      listRecentJobs: vi.fn(),
      listDestinationStores: vi.fn()
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

  it("returns a structured runtime preflight error when replication cannot start", async () => {
    const handlers = createReplicatorMcpHandlers({
      replicateStorefront: vi.fn().mockRejectedValue(
        new RuntimePreflightError([
          {
            code: "shopify_cli_unavailable",
            message: "Shopify CLI is required for replication and theme validation."
          },
          {
            code: "theme_workspace_missing",
            message: "Theme workspace path does not exist: /tmp/missing-theme"
          }
        ])
      ),
      getJob: vi.fn(),
      listRecentJobs: vi.fn()
    } as never);

    const result = handlers.replicateStorefront({
      referenceUrl: "https://example.com",
      destinationStore: "local-dev-store",
      pageType: "landing_page"
    });

    await expect(result).rejects.toBeInstanceOf(RuntimePreflightError);
  });
});
