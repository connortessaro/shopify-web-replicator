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
import { ShopifyThemeGenerator } from "./theme-generator";

describe("ReplicationPipeline", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
    tempDirectories.length = 0;
  });

  it("processes a job from capture through theme generation and validation", async () => {
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
        })
      ])
    );
    await expect(readFile(join(themeRoot, "sections/generated-reference.liquid"), "utf8")).resolves.toContain(
      "Example heading"
    );
    await expect(
      readFile(join(themeRoot, "templates/page.generated-reference.json"), "utf8")
    ).resolves.toContain('"type": "generated-reference"');
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
});
