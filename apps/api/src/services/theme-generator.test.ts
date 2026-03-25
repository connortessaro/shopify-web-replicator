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
    await expect(readFile(join(themeRoot, "sections/generated-reference.liquid"), "utf8")).resolves.toContain(
      "{% render 'generated-commerce-wiring', page_type: 'landing_page' %}"
    );
    await expect(readFile(join(themeRoot, "templates/page.generated-reference.json"), "utf8")).resolves.toContain(
      '"type": "generated-reference"'
    );
    await expect(readFile(join(themeRoot, "templates/page.generated-reference.json"), "utf8")).resolves.not.toContain(
      '"mapping_summary"'
    );
  });

  it("writes product-page outputs with a product form into product-specific stable files", async () => {
    const themeRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-theme-"));
    tempDirectories.push(themeRoot);

    const generator = new ShopifyThemeGenerator(themeRoot);
    const analysis: ReferenceAnalysis = {
      sourceUrl: "https://example.com/products/trail-pack",
      referenceHost: "example.com",
      pageType: "product_page",
      title: "Trail Pack",
      summary: "Prepared deterministic product page analysis for Trail Pack.",
      analyzedAt: "2026-03-20T12:00:00.000Z",
      recommendedSections: ["product_detail", "rich_text", "cta"]
    };
    const mapping: ThemeMapping = {
      sourceUrl: "https://example.com/products/trail-pack",
      title: "Trail Pack",
      summary: "Mapped Trail Pack into the stable generated product template.",
      mappedAt: "2026-03-20T12:01:00.000Z",
      templatePath: "templates/product.generated-reference.json",
      sectionPath: "sections/generated-product-reference.liquid",
      sections: [
        {
          id: "product-hero-1",
          type: "product_detail",
          heading: "Trail Pack",
          body: "Durable pack copy",
          ctaLabel: "Add to cart",
          ctaHref: "/cart"
        }
      ]
    };

    const result = await generator.generate({ analysis, mapping });

    expect(result.artifacts).toEqual([
      expect.objectContaining({
        path: "sections/generated-product-reference.liquid"
      }),
      expect.objectContaining({
        path: "templates/product.generated-reference.json"
      })
    ]);
    await expect(readFile(join(themeRoot, "sections/generated-product-reference.liquid"), "utf8")).resolves.toContain(
      "{% form 'product', product %}"
    );
    await expect(readFile(join(themeRoot, "templates/product.generated-reference.json"), "utf8")).resolves.toContain(
      '"type": "generated-product-reference"'
    );
  });

  it("lets landing, homepage, product, and collection outputs coexist in the same theme workspace", async () => {
    const themeRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-theme-"));
    tempDirectories.push(themeRoot);

    const generator = new ShopifyThemeGenerator(themeRoot);
    const scenarios = [
      {
        analysis: {
          sourceUrl: "https://example.com",
          referenceHost: "example.com",
          pageType: "homepage",
          title: "Example Store",
          summary: "Prepared deterministic homepage analysis for Example Store.",
          analyzedAt: "2026-03-20T12:00:00.000Z",
          recommendedSections: ["hero", "rich_text", "cta"]
        } satisfies ReferenceAnalysis,
        mapping: {
          sourceUrl: "https://example.com",
          title: "Example Store",
          summary: "Mapped Example Store into the stable generated homepage template.",
          mappedAt: "2026-03-20T12:01:00.000Z",
          templatePath: "templates/index.generated-reference.json",
          sectionPath: "sections/generated-homepage-reference.liquid",
          sections: [{ id: "hero-1", type: "hero", heading: "Example Store", body: "Homepage copy" }]
        } satisfies ThemeMapping
      },
      {
        analysis: {
          sourceUrl: "https://example.com/products/trail-pack",
          referenceHost: "example.com",
          pageType: "product_page",
          title: "Trail Pack",
          summary: "Prepared deterministic product page analysis for Trail Pack.",
          analyzedAt: "2026-03-20T12:00:00.000Z",
          recommendedSections: ["product_detail", "rich_text", "cta"]
        } satisfies ReferenceAnalysis,
        mapping: {
          sourceUrl: "https://example.com/products/trail-pack",
          title: "Trail Pack",
          summary: "Mapped Trail Pack into the stable generated product template.",
          mappedAt: "2026-03-20T12:01:00.000Z",
          templatePath: "templates/product.generated-reference.json",
          sectionPath: "sections/generated-product-reference.liquid",
          sections: [{ id: "product-1", type: "product_detail", heading: "Trail Pack", body: "Product copy" }]
        } satisfies ThemeMapping
      },
      {
        analysis: {
          sourceUrl: "https://example.com/collections/summer-gear",
          referenceHost: "example.com",
          pageType: "collection_page",
          title: "Summer Gear",
          summary: "Prepared deterministic collection page analysis for Summer Gear.",
          analyzedAt: "2026-03-20T12:00:00.000Z",
          recommendedSections: ["hero", "collection_grid", "cta"]
        } satisfies ReferenceAnalysis,
        mapping: {
          sourceUrl: "https://example.com/collections/summer-gear",
          title: "Summer Gear",
          summary: "Mapped Summer Gear into the stable generated collection template.",
          mappedAt: "2026-03-20T12:01:00.000Z",
          templatePath: "templates/collection.generated-reference.json",
          sectionPath: "sections/generated-collection-reference.liquid",
          sections: [{ id: "collection-1", type: "collection_grid", heading: "Summer Gear", body: "Collection copy" }]
        } satisfies ThemeMapping
      },
      {
        analysis: {
          sourceUrl: "https://example.com/launch",
          referenceHost: "example.com",
          pageType: "landing_page",
          title: "Launch",
          summary: "Prepared deterministic landing-page analysis for Launch.",
          analyzedAt: "2026-03-20T12:00:00.000Z",
          recommendedSections: ["hero", "rich_text", "cta"]
        } satisfies ReferenceAnalysis,
        mapping: {
          sourceUrl: "https://example.com/launch",
          title: "Launch",
          summary: "Mapped Launch into the stable generated landing template.",
          mappedAt: "2026-03-20T12:01:00.000Z",
          templatePath: "templates/page.generated-reference.json",
          sectionPath: "sections/generated-reference.liquid",
          sections: [{ id: "landing-1", type: "hero", heading: "Launch", body: "Landing copy" }]
        } satisfies ThemeMapping
      }
    ];

    for (const scenario of scenarios) {
      await generator.generate(scenario);
    }

    await expect(readFile(join(themeRoot, "templates/index.generated-reference.json"), "utf8")).resolves.toContain(
      '"type": "generated-homepage-reference"'
    );
    await expect(readFile(join(themeRoot, "templates/product.generated-reference.json"), "utf8")).resolves.toContain(
      '"type": "generated-product-reference"'
    );
    await expect(readFile(join(themeRoot, "templates/collection.generated-reference.json"), "utf8")).resolves.toContain(
      '"type": "generated-collection-reference"'
    );
    await expect(readFile(join(themeRoot, "templates/page.generated-reference.json"), "utf8")).resolves.toContain(
      '"type": "generated-reference"'
    );
  });

  it("guards the product-page eyebrow with a blank check, includes a product image, and omits mapping_summary", async () => {
    const themeRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-theme-"));
    tempDirectories.push(themeRoot);

    const generator = new ShopifyThemeGenerator(themeRoot);
    const analysis: ReferenceAnalysis = {
      sourceUrl: "https://example.com/products/trail-pack",
      referenceHost: "example.com",
      pageType: "product_page",
      title: "Trail Pack",
      summary: "Product page summary.",
      analyzedAt: "2026-03-20T12:00:00.000Z",
      recommendedSections: ["product_detail"]
    };
    const mapping: ThemeMapping = {
      sourceUrl: "https://example.com/products/trail-pack",
      title: "Trail Pack",
      summary: "Product mapping summary.",
      mappedAt: "2026-03-20T12:01:00.000Z",
      templatePath: "templates/product.generated-reference.json",
      sectionPath: "sections/generated-product-reference.liquid",
      sections: [
        {
          id: "product-hero-1",
          type: "product_detail",
          heading: "Trail Pack",
          body: "Durable pack copy",
          ctaLabel: "Add to cart",
          ctaHref: "/cart"
        }
      ]
    };

    await generator.generate({ analysis, mapping });

    const sectionContent = await readFile(join(themeRoot, "sections/generated-product-reference.liquid"), "utf8");
    const templateContent = await readFile(join(themeRoot, "templates/product.generated-reference.json"), "utf8");

    // Bug 4 fix: eyebrow is wrapped in a blank check
    expect(sectionContent).toContain("{% if section.settings.eyebrow != blank %}");

    // Feature 2 fix: product image is rendered
    expect(sectionContent).toContain("product.featured_image");

    // Feature 1 fix: mapping_summary is absent from section HTML and schema settings
    expect(sectionContent).not.toContain("section.settings.mapping_summary");
    expect(sectionContent).not.toContain('"mapping_summary"');

    // Feature 1 fix: mapping_summary is absent from the template JSON
    expect(templateContent).not.toContain('"mapping_summary"');
  });

  it("renders collection-page product cards as linked <a> elements and omits mapping_summary", async () => {
    const themeRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-theme-"));
    tempDirectories.push(themeRoot);

    const generator = new ShopifyThemeGenerator(themeRoot);
    const analysis: ReferenceAnalysis = {
      sourceUrl: "https://example.com/collections/summer-gear",
      referenceHost: "example.com",
      pageType: "collection_page",
      title: "Summer Gear",
      summary: "Collection page summary.",
      analyzedAt: "2026-03-20T12:00:00.000Z",
      recommendedSections: ["collection_grid"]
    };
    const mapping: ThemeMapping = {
      sourceUrl: "https://example.com/collections/summer-gear",
      title: "Summer Gear",
      summary: "Collection mapping summary.",
      mappedAt: "2026-03-20T12:01:00.000Z",
      templatePath: "templates/collection.generated-reference.json",
      sectionPath: "sections/generated-collection-reference.liquid",
      sections: [
        {
          id: "collection-1",
          type: "collection_grid",
          heading: "Summer Gear",
          body: "Collection copy"
        }
      ]
    };

    await generator.generate({ analysis, mapping });

    const sectionContent = await readFile(join(themeRoot, "sections/generated-collection-reference.liquid"), "utf8");
    const templateContent = await readFile(join(themeRoot, "templates/collection.generated-reference.json"), "utf8");

    // Bug 5 fix: cards use <a href="{{ product.url }}"> instead of <article>
    expect(sectionContent).toContain('<a class="generated-collection-reference__card" href="{{ product.url }}">');
    expect(sectionContent).not.toContain("<article");

    // Feature 1 fix: mapping_summary is absent from section HTML, schema settings, and template JSON
    expect(sectionContent).not.toContain("section.settings.mapping_summary");
    expect(sectionContent).not.toContain('"mapping_summary"');
    expect(templateContent).not.toContain('"mapping_summary"');
  });
});
