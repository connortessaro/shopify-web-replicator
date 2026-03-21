import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createReplicationJob,
  type ReferenceAnalysis,
  type ThemeMapping,
  type ThemeCheckResult
} from "@shopify-web-replicator/shared";

import { SqliteJobRepository } from "../repository/sqlite-job-repository";

import { ReplicationPipeline } from "./replication-pipeline";
import { ShopifyStoreSetupGenerator } from "./store-setup-generator";
import { ShopifyThemeGenerator } from "./theme-generator";

describe("ReplicationPipeline", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
    tempDirectories.length = 0;
  });

  it("processes a job from analysis through theme generation, store setup, and validation", async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-jobs-"));
    const themeRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-theme-"));
    tempDirectories.push(dataRoot, themeRoot);

    const repository = new SqliteJobRepository(join(dataRoot, "replicator.db"));
    const job = createReplicationJob({
      referenceUrl: "https://example.com",
      notes: "Landing page MVP"
    });

    await repository.save(job);

    const pipeline = new ReplicationPipeline({
      repository,
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
      analysis: {
        title: "Example Storefront"
      },
      mapping: {
        summary: "Mapped Example Storefront into the stable generated reference section. Operator notes: Landing page MVP"
      },
      storeSetup: {
        summary:
          "Prepared deterministic store setup plan for Example Storefront covering products, collections, menus, and structured content for the landing page."
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
  });

  it("persists a failed job when a stage throws", async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-jobs-"));
    const themeRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-theme-"));
    tempDirectories.push(dataRoot, themeRoot);

    const repository = new SqliteJobRepository(join(dataRoot, "replicator.db"));
    const job = createReplicationJob({
      referenceUrl: "https://example.com"
    });

    await repository.save(job);

    const pipeline = new ReplicationPipeline({
      repository,
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
      pageType: "product_page"
    });

    await repository.save(job);

    const pipeline = new ReplicationPipeline({
      repository,
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
});
