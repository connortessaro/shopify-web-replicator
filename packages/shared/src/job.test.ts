import { describe, expect, it } from "vitest";

import { createReplicationJob, pipelineStages, referenceIntakeSchema } from "./job";

describe("createReplicationJob", () => {
  it("normalizes trimmed input for destination store and notes", () => {
    const job = createReplicationJob({
      referenceUrl: "https://example.com/products/trail-pack",
      destinationStore: "  local-dev-store  ",
      notes: "  trim this input  "
    });

    expect(job.intake.destinationStore).toBe("local-dev-store");
    expect(job.intake.notes).toBe("trim this input");
  });

  it("creates a job ready for route discovery, capture, replication, parity audit, and review", () => {
    const job = createReplicationJob({
      referenceUrl: "https://example.com",
      destinationStore: "local-dev-store",
      notes: "hero-focused landing page",
      pageType: "landing_page"
    });

    expect(job.status).toBe("in_progress");
    expect(job.currentStage).toBe("source_qualification");
    expect(job.intake).toEqual({
      referenceUrl: "https://example.com",
      destinationStore: "local-dev-store",
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
      name: "source_qualification",
      status: "current",
      summary: "Validating the reference source and destination store.",
      startedAt: job.createdAt
    });
    expect(job.stages[2]).toMatchObject({
      name: "route_inventory",
      status: "pending",
      summary: "Waiting for route inventory."
    });
    expect(job.stages[3]).toMatchObject({
      name: "capture",
      status: "pending",
      summary: "Waiting for capture."
    });
    expect(job.stages[4]).toMatchObject({
      name: "storefront_model",
      status: "pending",
      summary: "Waiting for storefront model."
    });
    expect(job.stages[5]).toMatchObject({
      name: "analysis",
      status: "pending",
      summary: "Waiting for analysis."
    });
    expect(job.stages[8]).toMatchObject({
      name: "asset_sync",
      status: "pending",
      summary: "Waiting for asset sync."
    });
    expect(job.stages[11]).toMatchObject({
      name: "admin_replication",
      status: "pending",
      summary: "Waiting for admin replication."
    });
    expect(job.stages.at(-3)).toMatchObject({
      name: "parity_audit",
      status: "pending",
      summary: "Waiting for parity audit."
    });
    expect(job.stages.at(-2)).toMatchObject({
      name: "integration_check",
      status: "pending",
      summary: "Waiting for integration check."
    });
    expect(job.stages.at(-1)).toMatchObject({
      name: "review",
      status: "pending",
      summary: "Waiting for review."
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
        description: "Import-ready store setup bundle covering products, collections, menus, and structured content"
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
    expect((job as { routeInventory?: unknown }).routeInventory).toBeUndefined();
    expect((job as { storefrontModel?: unknown }).storefrontModel).toBeUndefined();
    expect((job as { assetSync?: unknown }).assetSync).toBeUndefined();
    expect(job.storeSetup).toBeUndefined();
    expect(job.commerce).toBeUndefined();
    expect((job as { adminReplication?: unknown }).adminReplication).toBeUndefined();
    expect((job as { parityAudit?: unknown }).parityAudit).toBeUndefined();
    expect(job.integration).toBeUndefined();
    expect(job.validation).toEqual({
      status: "pending",
      summary: "Theme validation has not run yet."
    });
    expect((job as { capture?: unknown }).capture).toBeUndefined();
    expect(job.error).toBeUndefined();
  });

  it("supports runtime capture roots and disk-backed capture metadata", () => {
    const job = createReplicationJob({
      referenceUrl: "https://example.com/products/trail-pack",
      destinationStore: "local-dev-store",
      pageType: "product_page"
    });

    job.sourceQualification = {
      status: "supported",
      platform: "shopify",
      referenceHost: "example.com",
      resolvedUrl: "https://example.com/products/trail-pack",
      qualifiedAt: "2026-03-21T12:00:00.000Z",
      summary: "Verified a supported public Shopify storefront source.",
      evidence: ["window.Shopify"],
      httpStatus: 200,
      isPasswordProtected: false
    };

    job.capture = {
      sourceUrl: "https://example.com/products/trail-pack",
      resolvedUrl: "https://example.com/products/trail-pack",
      referenceHost: "example.com",
      title: "Trail Pack",
      capturedAt: "2026-03-21T12:00:30.000Z",
      captureBundlePath: ".data/captures/job_123/capture-bundle.json",
      desktopScreenshotPath: ".data/captures/job_123/desktop.jpg",
      mobileScreenshotPath: ".data/captures/job_123/mobile.jpg",
      textContent: "Trail Pack Product details",
      headingOutline: ["Trail Pack", "Product details"],
      navigationLinks: [{ label: "Shop", href: "https://example.com/collections/all" }],
      primaryCtas: [{ label: "Buy now", href: "https://example.com/products/trail-pack" }],
      imageAssets: [{ src: "https://cdn.shopify.com/trail-pack.jpg", alt: "Trail Pack" }],
      styleTokens: {
        dominantColors: ["rgb(255, 255, 255)", "rgb(17, 24, 39)"],
        fontFamilies: ["Inter", "Georgia"],
        bodyTextColor: "rgb(17, 24, 39)",
        pageBackgroundColor: "rgb(255, 255, 255)",
        primaryButtonBackgroundColor: "rgb(17, 24, 39)",
        primaryButtonTextColor: "rgb(255, 255, 255)",
        linkColor: "rgb(37, 99, 235)"
      },
      routeHints: {
        productHandles: ["trail-pack"],
        collectionHandles: ["all"],
        cartPath: "/cart",
        checkoutPath: "/checkout"
      }
    };

    expect(job.sourceQualification.httpStatus).toBe(200);
    expect(job.capture.captureBundlePath).toContain("capture-bundle.json");
    expect(job.capture.desktopScreenshotPath).toContain("desktop.jpg");
    expect(job.capture.mobileScreenshotPath).toContain("mobile.jpg");
    expect(job.capture.styleTokens.fontFamilies).toEqual(["Inter", "Georgia"]);
    expect(job.capture.routeHints.productHandles).toEqual(["trail-pack"]);
  });

  it("starts with review-only terminal states unset", () => {
    const job = createReplicationJob({
      referenceUrl: "https://example.com/offer",
      destinationStore: "local-dev-store"
    });

    expect(job.status).not.toBe("failed");
    expect(job.status).not.toBe("needs_review");
    expect(job.error).toBeUndefined();
  });

  it("creates product-page jobs with product-specific stable artifacts", () => {
    const job = createReplicationJob({
      referenceUrl: "https://example.com/products/trail-pack",
      destinationStore: "local-dev-store",
      pageType: "product_page"
    });

    expect(job.intake.pageType).toBe("product_page");
    expect(job.stages[1]).toMatchObject({
      name: "source_qualification",
      summary: "Validating the reference source and destination store."
    });
    expect(job.stages[2]).toMatchObject({
      name: "route_inventory",
      summary: "Waiting for route inventory."
    });
    expect(job.stages[3]).toMatchObject({
      name: "capture",
      summary: "Waiting for capture."
    });
    expect(job.stages[4]).toMatchObject({
      name: "storefront_model",
      summary: "Waiting for storefront model."
    });
    expect(job.stages[5]).toMatchObject({
      summary: "Waiting for analysis."
    });
    expect(job.stages.at(-4)?.name).toBe("validation");
    expect(job.stages.at(-3)?.name).toBe("parity_audit");
    expect(job.stages.at(-2)?.name).toBe("integration_check");
    expect(job.stages.at(-1)?.name).toBe("review");
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
        description: "Import-ready store setup bundle covering products, collections, menus, and structured content"
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

describe("URL-based page-type inference", () => {
  it.each([
    ["https://example.com/products/trail-pack", "product_page"],
    ["https://example.com/collections/summer", "collection_page"],
    ["https://example.com/", "homepage"],
    ["https://example.com/offer", "landing_page"]
  ] as const)("%s → %s", (url, expectedPageType) => {
    const job = createReplicationJob({
      referenceUrl: url,
      destinationStore: "local-dev-store"
    });
    expect(job.intake.pageType).toBe(expectedPageType);
  });
});

describe("referenceIntakeSchema", () => {
  it("rejects reference URLs with leading or trailing whitespace", () => {
    const result = referenceIntakeSchema.safeParse({
      referenceUrl: " https://example.com ",
      destinationStore: "local-dev-store"
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.referenceUrl).toBe("https://example.com");
    }
  });

  it("rejects blank notes after trimming", () => {
    const result = referenceIntakeSchema.safeParse({
      referenceUrl: "https://example.com",
      destinationStore: "local-dev-store",
      notes: "   "
    });
    expect(result.success).toBe(false);
  });

  it("rejects notes longer than 500 characters", () => {
    const result = referenceIntakeSchema.safeParse({
      referenceUrl: "https://example.com",
      destinationStore: "local-dev-store",
      notes: "a".repeat(501)
    });
    expect(result.success).toBe(false);
  });

  it("accepts notes at exactly 500 characters", () => {
    const result = referenceIntakeSchema.safeParse({
      referenceUrl: "https://example.com",
      destinationStore: "local-dev-store",
      notes: "a".repeat(500)
    });
    expect(result.success).toBe(true);
  });
});
