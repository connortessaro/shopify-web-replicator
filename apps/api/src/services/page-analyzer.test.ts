import { describe, expect, it } from "vitest";

import { DeterministicPageAnalyzer } from "./page-analyzer";

describe("DeterministicPageAnalyzer", () => {
  it("derives a landing-page analysis from the reference URL and operator notes", async () => {
    const analyzer = new DeterministicPageAnalyzer();

    const analysis = await analyzer.analyze({
      referenceUrl: "https://example.com/products/spring-launch",
      notes: "Keep the hero bold",
      pageType: "landing_page"
    });

    expect(analysis).toMatchObject({
      sourceUrl: "https://example.com/products/spring-launch",
      referenceHost: "example.com",
      pageType: "landing_page",
      title: "Spring Launch"
    });
    expect(analysis.recommendedSections).toEqual(["hero", "rich_text", "cta"]);
    expect(analysis.summary).toContain("Keep the hero bold");
  });

  it("falls back to a host-based title when the URL path is empty", async () => {
    const analyzer = new DeterministicPageAnalyzer();

    const analysis = await analyzer.analyze({
      referenceUrl: "https://www.example-store.com"
    });

    expect(analysis.title).toBe("Example Store");
    expect(analysis.summary).toContain("Example Store");
    expect(analysis.pageType).toBe("homepage");
  });

  it("keeps explicit product-page intake and recommends product-detail sections", async () => {
    const analyzer = new DeterministicPageAnalyzer();

    const analysis = await analyzer.analyze({
      referenceUrl: "https://example.com/products/trail-pack",
      pageType: "product_page",
      notes: "Preserve PDP purchase flow"
    });

    expect(analysis).toMatchObject({
      pageType: "product_page",
      title: "Trail Pack"
    });
    expect(analysis.recommendedSections).toEqual(["product_detail", "rich_text", "cta"]);
    expect(analysis.summary).toContain("product page");
  });

  it("infers a collection page from the URL when page type is omitted", async () => {
    const analyzer = new DeterministicPageAnalyzer();

    const analysis = await analyzer.analyze({
      referenceUrl: "https://example.com/collections/summer-gear"
    });

    expect(analysis).toMatchObject({
      pageType: "collection_page",
      title: "Summer Gear"
    });
    expect(analysis.recommendedSections).toEqual(["hero", "collection_grid", "cta"]);
  });
});
