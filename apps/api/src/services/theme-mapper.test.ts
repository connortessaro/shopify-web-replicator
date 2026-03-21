import { describe, expect, it } from "vitest";

import type { ReferenceAnalysis } from "@shopify-web-replicator/shared";

import { DeterministicThemeMapper } from "./theme-mapper";

describe("DeterministicThemeMapper", () => {
  it("maps deterministic analysis into the stable theme workspace targets", async () => {
    const mapper = new DeterministicThemeMapper();
    const analysis: ReferenceAnalysis = {
      sourceUrl: "https://example.com/launch",
      referenceHost: "example.com",
      pageType: "landing_page",
      title: "Launch Offer",
      summary: "Prepared deterministic analysis for Launch Offer.",
      analyzedAt: "2026-03-20T12:01:00.000Z",
      recommendedSections: ["hero", "rich_text", "cta"]
    };

    const mapping = await mapper.map({
      analysis,
      referenceUrl: analysis.sourceUrl,
      notes: "Keep the CTA aggressive"
    });

    expect(mapping).toMatchObject({
      sourceUrl: "https://example.com/launch",
      title: "Launch Offer",
      templatePath: "templates/page.generated-reference.json",
      sectionPath: "sections/generated-reference.liquid"
    });
    expect(mapping.sections[0]).toMatchObject({
      type: "hero",
      heading: "Launch Offer",
      ctaLabel: "Review generated output"
    });
    expect(mapping.summary).toContain("Keep the CTA aggressive");
  });

  it("maps product-page analysis into product-specific template and section targets", async () => {
    const mapper = new DeterministicThemeMapper();
    const analysis: ReferenceAnalysis = {
      sourceUrl: "https://example.com/products/trail-pack",
      referenceHost: "example.com",
      pageType: "product_page",
      title: "Trail Pack",
      summary: "Prepared deterministic product page analysis for Trail Pack.",
      analyzedAt: "2026-03-20T12:01:00.000Z",
      recommendedSections: ["product_detail", "rich_text", "cta"]
    };

    const mapping = await mapper.map({
      analysis,
      referenceUrl: analysis.sourceUrl,
      notes: "Keep merchandising anchored near add to cart"
    });

    expect(mapping).toMatchObject({
      templatePath: "templates/product.generated-reference.json",
      sectionPath: "sections/generated-product-reference.liquid"
    });
    expect(mapping.sections[0]).toMatchObject({
      type: "product_detail",
      heading: "Trail Pack"
    });
    expect(mapping.summary).toContain("product template");
  });

  it("maps homepage analysis into a stable index template target", async () => {
    const mapper = new DeterministicThemeMapper();
    const analysis: ReferenceAnalysis = {
      sourceUrl: "https://example.com",
      referenceHost: "example.com",
      pageType: "homepage",
      title: "Example Store",
      summary: "Prepared deterministic homepage analysis for Example Store.",
      analyzedAt: "2026-03-20T12:01:00.000Z",
      recommendedSections: ["hero", "rich_text", "cta"]
    };

    const mapping = await mapper.map({
      analysis,
      referenceUrl: analysis.sourceUrl
    });

    expect(mapping).toMatchObject({
      templatePath: "templates/index.generated-reference.json",
      sectionPath: "sections/generated-homepage-reference.liquid"
    });
  });
});
