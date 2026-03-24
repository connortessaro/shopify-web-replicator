import {
  pageTypeLabels,
  stableThemeArtifacts,
  type PageType,
  type ReferenceAnalysis,
  type ReferenceCapture,
  type ThemeMapping
} from "@shopify-web-replicator/shared";

type MapInput = {
  analysis: ReferenceAnalysis;
  referenceUrl: string;
  notes?: string;
  capture?: ReferenceCapture;
};

function createPrimaryBody(analysis: ReferenceAnalysis, notes?: string): string {
  if (analysis.pageType === "product_page") {
    return notes
      ? `${notes}. This deterministic product page mapping keeps purchase flow, merchandising context, and operator QA in view.`
      : `${analysis.title} is prepared as a Shopify-native product page with add-to-cart flow ready for operator QA.`;
  }

  if (analysis.pageType === "collection_page") {
    return notes
      ? `${notes}. This deterministic collection mapping keeps merchandising and browsing flow ready for operator QA.`
      : `${analysis.title} is prepared as a Shopify-native collection page ready for operator QA.`;
  }

  if (analysis.pageType === "homepage") {
    return notes
      ? `${notes}. This deterministic homepage mapping keeps the primary brand story Liquid-first and ready for operator QA.`
      : `${analysis.title} is prepared as a Liquid-first homepage ready for operator QA.`;
  }

  if (notes) {
    return `${notes}. This deterministic mapping keeps the landing page Liquid-first and ready for operator QA.`;
  }

  return `${analysis.title} is prepared as a Liquid-first landing page ready for operator QA.`;
}

function createSummary(pageType: PageType, title: string, notes?: string): string {
  const target =
    pageType === "homepage"
      ? "stable generated homepage template"
      : pageType === "product_page"
        ? "stable generated product template"
        : pageType === "collection_page"
          ? "stable generated collection template"
          : "stable generated landing template";

  return notes
    ? `Mapped ${title} into the ${target}. Operator notes: ${notes}`
    : `Mapped ${title} into the ${target}.`;
}

export class DeterministicThemeMapper {
  async map({ analysis, referenceUrl, notes, capture }: MapInput): Promise<ThemeMapping> {
    const artifacts = stableThemeArtifacts[analysis.pageType];
    const capturedHeading = capture?.headingOutline[0];
    const capturedCta = capture?.primaryCtas[0];
    const title = capturedHeading ?? analysis.title;

    return {
      sourceUrl: referenceUrl,
      title: analysis.title,
      summary: createSummary(analysis.pageType, analysis.title, notes),
      mappedAt: new Date().toISOString(),
      templatePath: artifacts.template,
      sectionPath: artifacts.section,
      sections:
        analysis.pageType === "product_page"
          ? [
              {
                id: "product-detail-1",
                type: "product_detail",
                heading: title,
                body: createPrimaryBody(analysis, notes),
                ctaLabel: capturedCta?.label ?? "Add to cart",
                ctaHref: capturedCta?.href ?? "/cart"
              },
              {
                id: "supporting-copy-1",
                type: "rich_text",
                heading: "Product mapping notes",
                body: analysis.summary
              },
              {
                id: "cta-1",
                type: "cta",
                heading: "Operator review",
                body: "Validate merchandising, purchase flow, and native Shopify checkout handoff before publish.",
                ctaLabel: "Open generated product template",
                ctaHref: "/products/generated-reference"
              }
            ]
          : analysis.pageType === "collection_page"
            ? [
                {
                  id: "collection-grid-1",
                  type: "collection_grid",
                  heading: title,
                  body: createPrimaryBody(analysis, notes)
                },
                {
                  id: "supporting-copy-1",
                  type: "rich_text",
                  heading: "Collection mapping notes",
                  body: analysis.summary
                },
                {
                  id: "cta-1",
                  type: "cta",
                  heading: "Operator review",
                  body: "Validate browsing flow, product card density, and collection merchandising before publish.",
                  ctaLabel: "Open generated collection template",
                  ctaHref: "/collections/generated-reference"
                }
              ]
            : [
                {
                  id: "hero-1",
                  type: "hero",
                  heading: title,
                  body: createPrimaryBody(analysis, notes),
                  ctaLabel: capturedCta?.label ?? (analysis.pageType === "homepage" ? "Shop now" : "Learn more"),
                  ctaHref: capturedCta?.href ?? (analysis.pageType === "homepage" ? "/" : "/pages/generated-reference")
                },
                {
                  id: "supporting-copy-1",
                  type: "rich_text",
                  heading: `${pageTypeLabels[analysis.pageType]} mapping notes`,
                  body: analysis.summary
                },
                {
                  id: "cta-1",
                  type: "cta",
                  heading: "Operator review",
                  body: "Validate layout fidelity, mobile behavior, and native cart-to-checkout handoff before publish.",
                  ctaLabel: analysis.pageType === "homepage" ? "Open generated homepage" : "Open generated page",
                  ctaHref: analysis.pageType === "homepage" ? "/" : "/pages/generated-reference"
                }
              ]
    };
  }
}
