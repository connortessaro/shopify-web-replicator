import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createReplicationJob } from "@shopify-web-replicator/shared";
import { SqliteJobRepository } from "./apps/api/src/repository/sqlite-job-repository.js";
import { ReplicationPipeline } from "./packages/engine/src/services/replication-pipeline.ts";
import { ShopifyCommerceWiringGenerator } from "./apps/api/src/services/commerce-wiring-generator.ts";
import { ShopifyIntegrationReportGenerator } from "./apps/api/src/services/integration-report-generator.ts";
import { ShopifyStoreSetupGenerator } from "./apps/api/src/services/store-setup-generator.ts";
import { ShopifyThemeGenerator } from "./apps/api/src/services/theme-generator.ts";

function createCapture(referenceUrl: string, title: string) {
  return {
    sourceUrl: referenceUrl,
    resolvedUrl: referenceUrl,
    referenceHost: new URL(referenceUrl).hostname.replace(/^www\./, ""),
    title,
    capturedAt: "2026-03-20T12:00:30.000Z",
    captureBundlePath: "/tmp/capture.json",
    desktopScreenshotPath: "/tmp/desktop.jpg",
    mobileScreenshotPath: '/tmp/mobile.jpg',
    textContent: `${title} captured storefront text`,
    headingOutline: [title],
    navigationLinks: [{ label: "Shop", href: "https://example.com/collections/featured" }],
    primaryCtas: [{ label: "Buy now", href: "https://example.com/products/example-storefront" }],
    imageAssets: [{ src: "https://example.com/hero.jpg", alt: `${title} hero` }],
    styleTokens: {
      dominantColors: ["rgb(255, 255, 255)", "rgb(17, 24, 39)"],
      fontFamilies: ["Inter", "Georgia"],
      pageBackgroundColor: "rgb(255, 255, 255)",
      bodyTextColor: "rgb(17, 24, 39)",
      primaryButtonBackgroundColor: "rgb(17, 24, 39)",
      primaryButtonTextColor: "rgb(255, 255, 255)",
      linkColor: "rgb(37, 99, 235)"
    },
    routeHints: {
      productHandles: ["example-storefront"],
      collectionHandles: ["featured"],
      cartPath: "/cart",
      checkoutPath: "/checkout"
    }
  };
}

function createQualification(referenceUrl: string) {
  return {
    status: "supported",
    platform: "shopify",
    referenceHost: new URL(referenceUrl).hostname.replace(/^www\./, ""),
    resolvedUrl: referenceUrl,
    qualifiedAt: "2026-03-20T12:00:15.000Z",
    summary: "Verified a supported public Shopify storefront source.",
    evidence: ["window.Shopify"],
    httpStatus: 200,
    isPasswordProtected: false
  };
}

async function main() {
  const dataRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-jobs-"));
  const themeRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-theme-"));

  const repository = new SqliteJobRepository(join(dataRoot, "replicator.db"));
  const job = createReplicationJob({
    referenceUrl: "https://example.com",
    destinationStore: "local-dev-store",
    notes: "Landing page MVP"
  });
  await repository.save(job);

  const pipeline = new ReplicationPipeline({
    repository,
    runtime: {
      themeWorkspacePath: themeRoot,
      captureRootPath: join(dataRoot, "captures"),
      previewCommand: "shopify theme dev",
      destinationStores: [{ id: "local-dev-store", label: "Local Dev Store", shopDomain: "local-dev-store.myshopify.com" }]
    },
    qualificationService: {
      async qualify({ referenceUrl }) {
        return createQualification(referenceUrl);
      }
    },
    captureService: {
      async capture({ referenceUrl }) {
        return createCapture(referenceUrl, "Example Storefront");
      }
    },
    routeInventoryService: {
      async build() {
        return {
          discoveredAt: "2026-03-20T12:00:20.000Z",
          referenceHost: "example.com",
          summary: "Discovered 1 routes.",
          routes: [{ kind: "homepage" as const, source: "root" as const, url: "https://example.com/" }]
        };
      }
    },
    storefrontModelBuilder: {
      async build() {
        return {
          modeledAt: "2026-03-20T12:00:25.000Z",
          referenceHost: "example.com",
          storeTitle: "Example Storefront",
          summary: "Built storefront model.",
          styleTokens: { dominantColors: [], fontFamilies: [] },
          pages: [],
          products: [],
          collections: [],
          menus: [],
          contentModels: [],
          unsupportedFeatures: []
        };
      }
    },
    assetSyncService: {
      async sync() {
        return { syncedAt: "2026-03-20T12:02:30.000Z", summary: "Synced 0 assets.", assets: [] };
      }
    },
    analyzer: {
      async analyze({ referenceUrl, notes }) {
        return {
          sourceUrl: referenceUrl,
          pageType: "landing_page",
          title: "Example Storefront",
          summary: notes ? `Prepared deterministic analysis for Example Storefront. Operator notes: ${notes}` : "Prepared deterministic analysis for Example Storefront.",
          analyzedAt: "2026-03-20T12:01:00.000Z",
          recommendedSections: ["hero", "cta"]
        };
      }
    },
    mapper: {
      async map({ analysis, referenceUrl, notes }) {
        return {
          sourceUrl: referenceUrl,
          title: analysis.title,
          summary: notes ? `Mapped ${analysis.title} into the stable generated reference section. Operator notes: ${notes}` : `Mapped ${analysis.title} into the stable generated reference section.`,
          mappedAt: "2026-03-20T12:02:00.000Z",
          templatePath: "templates/page.generated-reference.json",
          sectionPath: "sections/generated-reference.liquid",
          sections: [{ id: "hero-1", type: "hero", heading: "Example heading", body: "Example body copy", ctaLabel: "Review generated output", ctaHref: "/pages/generated-reference" }]
        };
      }
    },
    generator: new ShopifyThemeGenerator(themeRoot),
    storeSetupGenerator: new ShopifyStoreSetupGenerator(themeRoot),
    commerceGenerator: new ShopifyCommerceWiringGenerator(themeRoot),
    integrationGenerator: new ShopifyIntegrationReportGenerator(themeRoot),
    themeValidator: {
      async validate() {
        return {
          status: "passed",
          summary: "Theme check passed.",
          checkedAt: "2026-03-20T12:03:00.000Z"
        };
      }
    }
  });

  await pipeline.process(job.id);
  const savedJob = await repository.getById(job.id);

  console.log(JSON.stringify({ status: savedJob?.status, currentStage: savedJob?.currentStage, error: savedJob?.error, integration: savedJob?.integration }, null, 2));
  if (savedJob?.integration) {
    console.log("integration checks:", savedJob.integration.checks);
  }
  console.log(await readFile(join(themeRoot, "config/generated-integration-report.json"), "utf8"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
