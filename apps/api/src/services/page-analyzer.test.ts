import { describe, expect, it } from "vitest";

import { DeterministicPageAnalyzer } from "./page-analyzer";

describe("DeterministicPageAnalyzer", () => {
  it("derives a landing-page analysis from the reference URL and operator notes", async () => {
    const analyzer = new DeterministicPageAnalyzer();

    const analysis = await analyzer.analyze(
      {
        referenceUrl: "https://example.com/products/spring-launch",
        notes: "Keep the hero bold",
        pageType: "landing_page",
        capture: {
          sourceUrl: "https://example.com/products/spring-launch",
          resolvedUrl: "https://example.com/products/spring-launch",
          referenceHost: "example.com",
          title: "Spring Launch 2026",
          description: "Hero-first campaign page",
          capturedAt: "2026-03-20T11:59:00.000Z",
          captureBundlePath: "/tmp/job_123/capture-bundle.json",
          desktopScreenshotPath: "/tmp/job_123/desktop.jpg",
          mobileScreenshotPath: "/tmp/job_123/mobile.jpg",
          textContent: "Spring Launch 2026 Hero-first campaign page Shop the launch pack",
          headingOutline: ["Spring Launch 2026", "Why it converts"],
          navigationLinks: [{ label: "Shop Spring", href: "https://example.com/collections/spring" }],
          primaryCtas: [{ label: "Shop the launch pack", href: "https://example.com/products/launch-pack" }],
          imageAssets: [{ src: "https://example.com/hero.jpg", alt: "Launch hero" }],
          styleTokens: {
            dominantColors: ["rgb(255, 255, 255)", "rgb(17, 24, 39)"],
            fontFamilies: ["Inter", "Playfair Display"],
            bodyTextColor: "rgb(17, 24, 39)"
          },
          routeHints: {
            productHandles: ["launch-pack"],
            collectionHandles: ["spring"]
          }
        }
      } as never
    );

    expect(analysis).toMatchObject({
      sourceUrl: "https://example.com/products/spring-launch",
      referenceHost: "example.com",
      pageType: "landing_page",
      title: "Spring Launch 2026"
    });
    expect(analysis.recommendedSections).toEqual(["hero", "rich_text", "cta"]);
    expect(analysis.summary).toContain("Keep the hero bold");
    expect(analysis.summary).toContain("Shop Spring");
    expect(analysis.summary).toContain("primary font Inter");
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

  it("infers page type from captured commerce and collection signals before falling back to URL heuristics", async () => {
    const analyzer = new DeterministicPageAnalyzer();

    const analysis = await analyzer.analyze({
      referenceUrl: "https://example.com/pages/seasonal-feature",
      capture: {
        sourceUrl: "https://example.com/pages/seasonal-feature",
        resolvedUrl: "https://example.com/pages/seasonal-feature",
        referenceHost: "example.com",
        title: "Seasonal Feature",
        capturedAt: "2026-03-20T11:59:00.000Z",
        captureBundlePath: "/tmp/job_456/capture-bundle.json",
        desktopScreenshotPath: "/tmp/job_456/desktop.jpg",
        mobileScreenshotPath: "/tmp/job_456/mobile.jpg",
        textContent: "Seasonal Feature Shop the collection",
        headingOutline: ["Seasonal Feature"],
        navigationLinks: [{ label: "Shop", href: "https://example.com/collections/spring" }],
        primaryCtas: [{ label: "Shop the collection", href: "https://example.com/collections/spring" }],
        imageAssets: [{ src: "https://example.com/hero.jpg" }],
        styleTokens: {
          dominantColors: ["rgb(255, 255, 255)"],
          fontFamilies: ["Inter"]
        },
        routeHints: {
          productHandles: [],
          collectionHandles: ["spring"]
        }
      }
    });

    expect(analysis.pageType).toBe("collection_page");
    expect(analysis.recommendedSections).toEqual(["hero", "collection_grid", "cta"]);
  });
});
