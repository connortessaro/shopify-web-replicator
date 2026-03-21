import { describe, expect, it } from "vitest";

import { DeterministicPageAnalyzer } from "./page-analyzer";

describe("DeterministicPageAnalyzer", () => {
  it("derives a landing-page analysis from the reference URL and operator notes", async () => {
    const analyzer = new DeterministicPageAnalyzer();

    const analysis = await analyzer.analyze({
      referenceUrl: "https://example.com/products/spring-launch",
      notes: "Keep the hero bold"
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
  });
});
