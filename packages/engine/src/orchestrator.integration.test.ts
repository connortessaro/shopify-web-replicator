import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { SqliteJobRepository, createReplicationOrchestrator } from "./index";
import { ShopifyCommerceWiringGenerator } from "./services/commerce-wiring-generator.js";
import { ShopifyIntegrationReportGenerator } from "./services/integration-report-generator.js";
import { DeterministicPageAnalyzer } from "./services/page-analyzer.js";
import { ShopifyStoreSetupGenerator } from "./services/store-setup-generator.js";
import { ShopifyThemeGenerator } from "./services/theme-generator.js";
import { DeterministicThemeMapper } from "./services/theme-mapper.js";

describe("createReplicationOrchestrator integration", () => {
  const pathsToRemove: string[] = [];

  afterEach(async () => {
    await Promise.all(
      pathsToRemove.splice(0).map(async (path) => {
        await rm(path, { recursive: true, force: true });
      })
    );
  });

  it("persists a real SQLite-backed replication run and writes generated artifacts into a temp theme workspace", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "replicator-engine-"));
    const themeWorkspacePath = join(tempRoot, "theme-workspace");
    const databasePath = join(tempRoot, "data", "replicator.db");

    pathsToRemove.push(tempRoot);

    const orchestrator = createReplicationOrchestrator({
      repository: new SqliteJobRepository(databasePath),
      runtime: {
        themeWorkspacePath,
        captureRootPath: join(tempRoot, "captures"),
        previewCommand: "shopify theme dev",
        destinationStores: [
          { id: "test-store", label: "Test Store", shopDomain: "test.myshopify.com" }
        ]
      },
      qualificationService: {
        async qualify() {
          return {
            status: "supported" as const,
            platform: "shopify" as const,
            referenceHost: "example.com",
            resolvedUrl: "https://example.com/products/spring-launch",
            qualifiedAt: new Date().toISOString(),
            summary: "Supported source.",
            evidence: ["window.Shopify"],
            isPasswordProtected: false
          };
        }
      },
      captureService: {
        async capture() {
          return {
            sourceUrl: "https://example.com/products/spring-launch",
            resolvedUrl: "https://example.com/products/spring-launch",
            referenceHost: "example.com",
            title: "Spring Launch",
            capturedAt: new Date().toISOString(),
            captureBundlePath: "/tmp/bundle.json",
            desktopScreenshotPath: "/tmp/desktop.jpg",
            mobileScreenshotPath: "/tmp/mobile.jpg",
            textContent: "Spring Launch product page",
            headingOutline: ["Spring Launch"],
            navigationLinks: [],
            primaryCtas: [],
            imageAssets: [],
            styleTokens: { dominantColors: [], fontFamilies: [] },
            routeHints: { productHandles: ["spring-launch"], collectionHandles: [] }
          };
        }
      },
      routeInventoryService: {
        async build() {
          return {
            discoveredAt: new Date().toISOString(),
            referenceHost: "example.com",
            summary: "Discovered 1 routes.",
            routes: [{ kind: "product_page" as const, source: "cta" as const, url: "https://example.com/products/spring-launch", handle: "spring-launch" }]
          };
        }
      },
      storefrontModelBuilder: {
        async build() {
          return {
            modeledAt: new Date().toISOString(),
            referenceHost: "example.com",
            storeTitle: "Spring Launch",
            summary: "Built storefront model.",
            styleTokens: { dominantColors: [], fontFamilies: [] },
            pages: [{ kind: "product_page" as const, url: "https://example.com/products/spring-launch", title: "Spring Launch", handle: "spring-launch" }],
            products: [{ handle: "spring-launch", title: "Spring Launch", merchandisingRole: "Primary offer." }],
            collections: [],
            menus: [],
            contentModels: [],
            unsupportedFeatures: []
          };
        }
      },
      assetSyncService: {
        async sync() {
          return { syncedAt: new Date().toISOString(), summary: "Synced 0 assets.", assets: [] };
        }
      },
      analyzer: new DeterministicPageAnalyzer(),
      mapper: new DeterministicThemeMapper(),
      generator: new ShopifyThemeGenerator(themeWorkspacePath),
      storeSetupGenerator: new ShopifyStoreSetupGenerator(themeWorkspacePath),
      commerceGenerator: new ShopifyCommerceWiringGenerator(themeWorkspacePath),
      integrationGenerator: new ShopifyIntegrationReportGenerator(themeWorkspacePath),
      themeValidator: {
        async validate() {
          return {
            status: "passed" as const,
            summary: "Theme validation passed in the integration test.",
            checkedAt: "2026-03-22T03:00:00.000Z"
          };
        }
      }
    });

    const handoff = await orchestrator.replicateStorefront({
      referenceUrl: "https://example.com/products/spring-launch",
      destinationStore: "test-store",
      pageType: "product_page",
      notes: "Focus on purchase flow."
    });

    expect(handoff.job.status).toBe("needs_review");
    expect(handoff.job.currentStage).toBe("review");

    const generatedSection = await readFile(
      join(themeWorkspacePath, "sections/generated-product-reference.liquid"),
      "utf8"
    );
    const generatedTemplate = await readFile(
      join(themeWorkspacePath, "templates/product.generated-reference.json"),
      "utf8"
    );
    const generatedStoreSetup = await readFile(
      join(themeWorkspacePath, "config/generated-store-setup.json"),
      "utf8"
    );
    const generatedCommerce = await readFile(
      join(themeWorkspacePath, "snippets/generated-commerce-wiring.liquid"),
      "utf8"
    );
    const generatedIntegration = await readFile(
      join(themeWorkspacePath, "config/generated-integration-report.json"),
      "utf8"
    );

    expect(generatedSection).toContain("Generated by Shopify Web Replicator.");
    expect(generatedTemplate).toContain("\"type\": \"generated-product-reference\"");
    expect(generatedStoreSetup).toContain("\"storeSetup\"");
    expect(generatedCommerce).toContain("/checkout");
    expect(generatedIntegration).toContain("\"summary\"");

    const persisted = await orchestrator.getJob(handoff.job.id);

    expect(persisted).toMatchObject({
      id: handoff.job.id,
      status: "needs_review",
      currentStage: "review"
    });
  });
});
