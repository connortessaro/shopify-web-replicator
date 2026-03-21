import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { ReferenceAnalysis, ThemeMapping } from "@shopify-web-replicator/shared";

import { ShopifyThemeGenerator } from "./theme-generator";

describe("ShopifyThemeGenerator", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
    tempDirectories.length = 0;
  });

  it("writes the stable generated reference section and template into the theme workspace", async () => {
    const themeRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-theme-"));
    tempDirectories.push(themeRoot);

    const generator = new ShopifyThemeGenerator(themeRoot);
    const analysis: ReferenceAnalysis = {
      sourceUrl: "https://example.com",
      referenceHost: "example.com",
      pageType: "landing_page",
      title: "Example Store",
      summary: "Prepared deterministic analysis for Example Store.",
      analyzedAt: "2026-03-20T12:00:00.000Z",
      recommendedSections: ["hero", "cta"]
    };
    const mapping: ThemeMapping = {
      sourceUrl: "https://example.com",
      title: "Example Store",
      summary: "Mapped Example Store into the stable generated reference section.",
      mappedAt: "2026-03-20T12:01:00.000Z",
      templatePath: "templates/page.generated-reference.json",
      sectionPath: "sections/generated-reference.liquid",
      sections: [
        {
          id: "hero-1",
          type: "hero",
          heading: "Launch faster",
          body: "A hero section generated from the reference page.",
          ctaLabel: "Shop now",
          ctaHref: "/collections/all"
        },
        {
          id: "cta-2",
          type: "cta",
          heading: "Need a second push?",
          body: "This CTA closes the page.",
          ctaLabel: "View offer",
          ctaHref: "/pages/offer"
        }
      ]
    };

    const result = await generator.generate({ analysis, mapping });

    expect(result.artifacts).toEqual([
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
    ]);

    await expect(readFile(join(themeRoot, "sections/generated-reference.liquid"), "utf8")).resolves.toContain(
      "Launch faster"
    );
    await expect(readFile(join(themeRoot, "sections/generated-reference.liquid"), "utf8")).resolves.toContain(
      "Mapped Example Store into the stable generated reference section."
    );
    await expect(readFile(join(themeRoot, "templates/page.generated-reference.json"), "utf8")).resolves.toContain(
      '"type": "generated-reference"'
    );
  });
});
