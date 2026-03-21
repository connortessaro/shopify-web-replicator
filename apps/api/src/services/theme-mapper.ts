import type { ReferenceAnalysis, ThemeMapping } from "@shopify-web-replicator/shared";

type MapInput = {
  analysis: ReferenceAnalysis;
  referenceUrl: string;
  notes?: string;
};

function createPrimaryBody(analysis: ReferenceAnalysis, notes?: string): string {
  if (notes) {
    return `${notes}. This deterministic mapping keeps the landing page Liquid-first and ready for operator QA.`;
  }

  return `${analysis.title} is prepared as a Liquid-first landing page ready for operator QA.`;
}

export class DeterministicThemeMapper {
  async map({ analysis, referenceUrl, notes }: MapInput): Promise<ThemeMapping> {
    return {
      sourceUrl: referenceUrl,
      title: analysis.title,
      summary: notes
        ? `Mapped ${analysis.title} into the stable generated reference section. Operator notes: ${notes}`
        : `Mapped ${analysis.title} into the stable generated reference section.`,
      mappedAt: new Date().toISOString(),
      templatePath: "templates/page.generated-reference.json",
      sectionPath: "sections/generated-reference.liquid",
      sections: [
        {
          id: "hero-1",
          type: "hero",
          heading: analysis.title,
          body: createPrimaryBody(analysis, notes),
          ctaLabel: "Review generated output",
          ctaHref: "/pages/generated-reference"
        },
        {
          id: "supporting-copy-1",
          type: "rich_text",
          heading: "Mapping notes",
          body: analysis.summary
        },
        {
          id: "cta-1",
          type: "cta",
          heading: "Operator review",
          body: "Validate layout fidelity, mobile behavior, and native cart-to-checkout handoff before publish.",
          ctaLabel: "Open generated page",
          ctaHref: "/pages/generated-reference"
        }
      ]
    };
  }
}
