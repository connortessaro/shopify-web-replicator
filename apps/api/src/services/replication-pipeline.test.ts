import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createReplicationJob,
  type ReferenceCapture,
  type ReferenceAnalysis,
  type SourceQualification,
  type ThemeMapping,
  type ThemeCheckResult
} from "@shopify-web-replicator/shared";

import { SqliteJobRepository } from "../repository/sqlite-job-repository";

import { ReplicationPipeline } from "./replication-pipeline";
import { ShopifyCommerceWiringGenerator } from "./commerce-wiring-generator";
import { ShopifyIntegrationReportGenerator } from "./integration-report-generator";
import { ShopifyStoreSetupGenerator } from "./store-setup-generator";
import { ShopifyThemeGenerator } from "./theme-generator";

function createCapture(referenceUrl: string, title: string): ReferenceCapture {
  return {
    sourceUrl: referenceUrl,
    resolvedUrl: referenceUrl,
    referenceHost: new URL(referenceUrl).hostname.replace(/^www\./, ""),
    title,
    capturedAt: "2026-03-20T12:00:30.000Z",
    captureBundlePath: `/tmp/${title.replace(/\s+/g, "-").toLowerCase()}/capture-bundle.json`,
    desktopScreenshotPath: `/tmp/${title.replace(/\s+/g, "-").toLowerCase()}/desktop.jpg`,
    mobileScreenshotPath: `/tmp/${title.replace(/\s+/g, "-").toLowerCase()}/mobile.jpg`,
    textContent: `${title} captured storefront text`,
    headingOutline: [title],
    navigationLinks: [{ label: "Shop", href: "https://example.com/collections/featured" }],
    primaryCtas: [{ label: "Buy now", href: "https://example.com/products/example-storefront" }],
    imageAssets: [{ src: "https://example.com/hero.jpg", alt: `${title} hero` }],
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
      productHandles: ["example-storefront"],
      collectionHandles: ["featured"],
      cartPath: "/cart",
      checkoutPath: "/checkout"
    }
  };
}

function createQualification(referenceUrl: string): SourceQualification {
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

describe("ReplicationPipeline", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
    tempDirectories.length = 0;
  });

  it("processes a job from analysis through theme generation, store setup, commerce wiring, integration checks, and validation", async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-jobs-"));
    const themeRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-theme-"));
    tempDirectories.push(dataRoot, themeRoot);

    const repository = new SqliteJobRepository(join(dataRoot, "replicator.db"));
    const job = createReplicationJob({
      referenceUrl: "https://example.com",
      destinationStore: "local-dev-store",
      notes: "Landing page MVP"
    });

    await repository.save(job);

    const pipeline = new ReplicationPipeline({
      repository,
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
      analyzer: {
        async analyze({ referenceUrl, notes }) {
          return {
            sourceUrl: referenceUrl,
            pageType: "landing_page",
            title: "Example Storefront",
            summary: notes
              ? `Prepared deterministic analysis for Example Storefront. Operator notes: ${notes}`
              : "Prepared deterministic analysis for Example Storefront.",
            analyzedAt: "2026-03-20T12:01:00.000Z",
            recommendedSections: ["hero", "cta"]
          } satisfies ReferenceAnalysis;
        }
      },
      mapper: {
        async map({ analysis, referenceUrl, notes }) {
          return {
            sourceUrl: referenceUrl,
            title: analysis.title,
            summary: notes
              ? `Mapped ${analysis.title} into the stable generated reference section. Operator notes: ${notes}`
              : `Mapped ${analysis.title} into the stable generated reference section.`,
            mappedAt: "2026-03-20T12:02:00.000Z",
            templatePath: "templates/page.generated-reference.json",
            sectionPath: "sections/generated-reference.liquid",
            sections: [
              {
                id: "hero-1",
                type: "hero",
                heading: "Example heading",
                body: "Example body copy",
                ctaLabel: "Review generated output",
                ctaHref: "/pages/generated-reference"
              }
            ]
          } satisfies ThemeMapping;
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
          } satisfies ThemeCheckResult;
        }
      }
    });

    await pipeline.process(job.id);

    const savedJob = await repository.getById(job.id);

    expect(savedJob).toMatchObject({
      id: job.id,
      status: "needs_review",
      currentStage: "review",
      sourceQualification: {
        status: "supported"
      },
      capture: {
        title: "Example Storefront"
      },
      analysis: {
        title: "Example Storefront"
      },
      mapping: {
        summary: "Mapped Example Storefront into the stable generated reference section. Operator notes: Landing page MVP"
      },
      storeSetup: {
        summary:
          "Prepared import-ready store setup bundle for Example Storefront covering products, collections, menus, and structured content for the landing page."
      },
      commerce: {
        summary: "Prepared deterministic commerce wiring plan for Example Storefront with native Shopify cart and checkout handoff."
      },
      integration: {
        summary: "All deterministic integration checks passed for Example Storefront."
      },
      validation: {
        status: "passed"
      }
    });
    expect(savedJob?.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "section",
          path: "sections/generated-reference.liquid",
          status: "generated"
        }),
        expect.objectContaining({
          kind: "template",
          path: "templates/page.generated-reference.json",
          status: "generated"
        }),
        expect.objectContaining({
          kind: "config",
          path: "config/generated-store-setup.json",
          status: "generated"
        }),
        expect.objectContaining({
          kind: "snippet",
          path: "snippets/generated-commerce-wiring.liquid",
          status: "generated"
        }),
        expect.objectContaining({
          kind: "config",
          path: "config/generated-integration-report.json",
          status: "generated"
        })
      ])
    );
    await expect(readFile(join(themeRoot, "sections/generated-reference.liquid"), "utf8")).resolves.toContain(
      "Example heading"
    );
    await expect(
      readFile(join(themeRoot, "templates/page.generated-reference.json"), "utf8")
    ).resolves.toContain('"type": "generated-reference"');
    await expect(readFile(join(themeRoot, "config/generated-store-setup.json"), "utf8")).resolves.toContain(
      "\"example-storefront\""
    );
    await expect(readFile(join(themeRoot, "snippets/generated-commerce-wiring.liquid"), "utf8")).resolves.toContain(
      "/checkout"
    );
    await expect(readFile(join(themeRoot, "config/generated-integration-report.json"), "utf8")).resolves.toContain(
      "\"commerce_snippet_reference\""
    );
  });

  it("persists a failed job when a stage throws", async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-jobs-"));
    const themeRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-theme-"));
    tempDirectories.push(dataRoot, themeRoot);

    const repository = new SqliteJobRepository(join(dataRoot, "replicator.db"));
    const job = createReplicationJob({
      referenceUrl: "https://example.com",
      destinationStore: "local-dev-store"
    });

    await repository.save(job);

    const pipeline = new ReplicationPipeline({
      repository,
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
      analyzer: {
        async analyze() {
          return {
            sourceUrl: "https://example.com",
            pageType: "landing_page",
            title: "Example Storefront",
            summary: "Prepared deterministic analysis for Example Storefront.",
            analyzedAt: "2026-03-20T12:01:00.000Z",
            recommendedSections: ["hero"]
          } satisfies ReferenceAnalysis;
        }
      },
      mapper: {
        async map() {
          throw new Error("Mapping failed");
        }
      },
      generator: new ShopifyThemeGenerator(themeRoot),
      storeSetupGenerator: {
        async generate() {
          throw new Error("Should never run");
        }
      },
      commerceGenerator: {
        async generate() {
          throw new Error("Should never run");
        }
      },
      integrationGenerator: {
        async generate() {
          throw new Error("Should never run");
        }
      },
      themeValidator: {
        async validate() {
          return {
            status: "passed",
            summary: "Should never run"
          } satisfies ThemeCheckResult;
        }
      }
    });

    await pipeline.process(job.id);

    await expect(repository.getById(job.id)).resolves.toMatchObject({
      id: job.id,
      status: "failed",
      currentStage: "mapping",
      error: {
        stage: "mapping",
        message: "Mapping failed"
      },
      validation: {
        status: "pending"
      }
    });
  });

  it("persists a failed job when store setup generation throws", async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-jobs-"));
    const themeRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-theme-"));
    tempDirectories.push(dataRoot, themeRoot);

    const repository = new SqliteJobRepository(join(dataRoot, "replicator.db"));
    const job = createReplicationJob({
      referenceUrl: "https://example.com/products/trail-pack",
      destinationStore: "local-dev-store",
      pageType: "product_page"
    });

    await repository.save(job);

    const pipeline = new ReplicationPipeline({
      repository,
      qualificationService: {
        async qualify({ referenceUrl }) {
          return createQualification(referenceUrl);
        }
      },
      captureService: {
        async capture({ referenceUrl }) {
          return createCapture(referenceUrl, "Trail Pack");
        }
      },
      analyzer: {
        async analyze() {
          return {
            sourceUrl: "https://example.com/products/trail-pack",
            referenceHost: "example.com",
            pageType: "product_page",
            title: "Trail Pack",
            summary: "Prepared deterministic product page analysis for Trail Pack.",
            analyzedAt: "2026-03-20T12:01:00.000Z",
            recommendedSections: ["product_detail", "rich_text", "cta"]
          } satisfies ReferenceAnalysis;
        }
      },
      mapper: {
        async map() {
          return {
            sourceUrl: "https://example.com/products/trail-pack",
            title: "Trail Pack",
            summary: "Mapped Trail Pack into the stable generated product template.",
            mappedAt: "2026-03-20T12:02:00.000Z",
            templatePath: "templates/product.generated-reference.json",
            sectionPath: "sections/generated-product-reference.liquid",
            sections: [
              {
                id: "product-detail-1",
                type: "product_detail",
                heading: "Trail Pack",
                body: "Product detail copy"
              }
            ]
          } satisfies ThemeMapping;
        }
      },
      generator: new ShopifyThemeGenerator(themeRoot),
      storeSetupGenerator: {
        async generate() {
          throw new Error("Store setup generation failed");
        }
      },
      commerceGenerator: {
        async generate() {
          throw new Error("Should never run");
        }
      },
      integrationGenerator: {
        async generate() {
          throw new Error("Should never run");
        }
      },
      themeValidator: {
        async validate() {
          return {
            status: "passed",
            summary: "Theme check passed.",
            checkedAt: "2026-03-20T12:03:00.000Z"
          } satisfies ThemeCheckResult;
        }
      }
    });

    await pipeline.process(job.id);

    await expect(repository.getById(job.id)).resolves.toMatchObject({
      id: job.id,
      status: "failed",
      currentStage: "store_setup",
      error: {
        stage: "store_setup",
        message: "Store setup generation failed"
      },
      artifacts: expect.arrayContaining([
        expect.objectContaining({
          kind: "section",
          status: "generated"
        }),
        expect.objectContaining({
          kind: "template",
          status: "generated"
        }),
        expect.objectContaining({
          kind: "config",
          status: "failed"
        })
      ])
    });
  });

  it("persists a failed job when commerce wiring generation throws", async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-jobs-"));
    const themeRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-theme-"));
    tempDirectories.push(dataRoot, themeRoot);

    const repository = new SqliteJobRepository(join(dataRoot, "replicator.db"));
    const job = createReplicationJob({
      referenceUrl: "https://example.com",
      destinationStore: "local-dev-store",
      pageType: "homepage"
    });

    await repository.save(job);

    const pipeline = new ReplicationPipeline({
      repository,
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
      analyzer: {
        async analyze() {
          return {
            sourceUrl: "https://example.com",
            referenceHost: "example.com",
            pageType: "homepage",
            title: "Example Storefront",
            summary: "Prepared deterministic homepage analysis for Example Storefront.",
            analyzedAt: "2026-03-20T12:01:00.000Z",
            recommendedSections: ["hero", "rich_text", "cta"]
          } satisfies ReferenceAnalysis;
        }
      },
      mapper: {
        async map() {
          return {
            sourceUrl: "https://example.com",
            title: "Example Storefront",
            summary: "Mapped Example Storefront into the stable generated homepage template.",
            mappedAt: "2026-03-20T12:02:00.000Z",
            templatePath: "templates/index.generated-reference.json",
            sectionPath: "sections/generated-homepage-reference.liquid",
            sections: [
              {
                id: "hero-1",
                type: "hero",
                heading: "Example Storefront",
                body: "Homepage copy"
              }
            ]
          } satisfies ThemeMapping;
        }
      },
      generator: new ShopifyThemeGenerator(themeRoot),
      storeSetupGenerator: new ShopifyStoreSetupGenerator(themeRoot),
      commerceGenerator: {
        async generate() {
          throw new Error("Commerce wiring generation failed");
        }
      },
      integrationGenerator: {
        async generate() {
          throw new Error("Should never run");
        }
      },
      themeValidator: {
        async validate() {
          return {
            status: "passed",
            summary: "Theme check passed.",
            checkedAt: "2026-03-20T12:03:00.000Z"
          } satisfies ThemeCheckResult;
        }
      }
    });

    await pipeline.process(job.id);

    await expect(repository.getById(job.id)).resolves.toMatchObject({
      id: job.id,
      status: "failed",
      currentStage: "commerce_wiring",
      error: {
        stage: "commerce_wiring",
        message: "Commerce wiring generation failed"
      },
      artifacts: expect.arrayContaining([
        expect.objectContaining({
          kind: "section",
          status: "generated"
        }),
        expect.objectContaining({
          kind: "template",
          status: "generated"
        }),
        expect.objectContaining({
          kind: "config",
          status: "generated"
        }),
        expect.objectContaining({
          kind: "snippet",
          status: "failed"
        })
      ])
    });
  });

  it("persists a failed job when integration checks fail", async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-jobs-"));
    const themeRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-theme-"));
    tempDirectories.push(dataRoot, themeRoot);

    const repository = new SqliteJobRepository(join(dataRoot, "replicator.db"));
    const job = createReplicationJob({
      referenceUrl: "https://example.com",
      destinationStore: "local-dev-store",
      pageType: "landing_page"
    });

    await repository.save(job);

    const pipeline = new ReplicationPipeline({
      repository,
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
      analyzer: {
        async analyze() {
          return {
            sourceUrl: "https://example.com",
            referenceHost: "example.com",
            pageType: "landing_page",
            title: "Example Storefront",
            summary: "Prepared deterministic landing page analysis for Example Storefront.",
            analyzedAt: "2026-03-20T12:01:00.000Z",
            recommendedSections: ["hero", "rich_text", "cta"]
          } satisfies ReferenceAnalysis;
        }
      },
      mapper: {
        async map() {
          return {
            sourceUrl: "https://example.com",
            title: "Example Storefront",
            summary: "Mapped Example Storefront into the stable generated landing template.",
            mappedAt: "2026-03-20T12:02:00.000Z",
            templatePath: "templates/page.generated-reference.json",
            sectionPath: "sections/generated-reference.liquid",
            sections: [
              {
                id: "hero-1",
                type: "hero",
                heading: "Example Storefront",
                body: "Landing copy"
              }
            ]
          } satisfies ThemeMapping;
        }
      },
      generator: new ShopifyThemeGenerator(themeRoot),
      storeSetupGenerator: new ShopifyStoreSetupGenerator(themeRoot),
      commerceGenerator: new ShopifyCommerceWiringGenerator(themeRoot),
      integrationGenerator: {
        async generate() {
          return {
            artifact: {
              kind: "config",
              path: "config/generated-integration-report.json",
              status: "generated",
              description: "Deterministic integration report covering theme, store setup, and commerce consistency",
              lastWrittenAt: "2026-03-20T12:05:00.000Z"
            },
            integration: {
              checkedAt: "2026-03-20T12:05:00.000Z",
              reportPath: "config/generated-integration-report.json",
              status: "failed",
              summary: "Integration checks failed for Example Storefront.",
              checks: [
                {
                  id: "commerce_snippet_reference",
                  status: "failed",
                  details: "Generated section is missing the commerce snippet render."
                }
              ]
            }
          };
        }
      },
      themeValidator: {
        async validate() {
          return {
            status: "passed",
            summary: "Theme check passed.",
            checkedAt: "2026-03-20T12:03:00.000Z"
          } satisfies ThemeCheckResult;
        }
      }
    });

    await pipeline.process(job.id);

    await expect(repository.getById(job.id)).resolves.toMatchObject({
      id: job.id,
      status: "failed",
      currentStage: "integration_check",
      integration: {
        status: "failed",
        summary: "Integration checks failed for Example Storefront."
      },
      error: {
        stage: "integration_check",
        message: "Integration checks failed for Example Storefront."
      },
      artifacts: expect.arrayContaining([
        expect.objectContaining({
          path: "config/generated-integration-report.json",
          status: "generated"
        })
      ])
    });
  });
});
