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
});
