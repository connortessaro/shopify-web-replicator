import type {
  PageType,
  ReferenceAnalysis,
  SectionBlueprintType
} from "@shopify-web-replicator/shared";
import { pageTypeLabels } from "@shopify-web-replicator/shared";

type AnalyzeInput = {
  referenceUrl: string;
  pageType?: PageType;
  notes?: string;
};

function toTitleCase(value: string): string {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((segment) => `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`)
    .join(" ");
}

function deriveTitle(referenceUrl: URL): string {
  const pathSegments = referenceUrl.pathname.split("/").filter(Boolean);
  const lastSegment = pathSegments.at(-1);

  if (lastSegment) {
    return toTitleCase(lastSegment);
  }

  const hostBase = referenceUrl.hostname.replace(/^www\./, "").split(".")[0] ?? referenceUrl.hostname;
  return toTitleCase(hostBase);
}

function derivePageType(referenceUrl: URL, pageType?: PageType): PageType {
  if (pageType) {
    return pageType;
  }

  if (referenceUrl.pathname === "/" || referenceUrl.pathname === "") {
    return "homepage";
  }

  if (referenceUrl.pathname.startsWith("/products/")) {
    return "product_page";
  }

  if (referenceUrl.pathname.startsWith("/collections/")) {
    return "collection_page";
  }

  return "landing_page";
}

function deriveRecommendedSections(pageType: PageType): SectionBlueprintType[] {
  if (pageType === "product_page") {
    return ["product_detail", "rich_text", "cta"];
  }

  if (pageType === "collection_page") {
    return ["hero", "collection_grid", "cta"];
  }

  return ["hero", "rich_text", "cta"];
}

export class DeterministicPageAnalyzer {
  async analyze({ referenceUrl, pageType, notes }: AnalyzeInput): Promise<ReferenceAnalysis> {
    const parsedUrl = new URL(referenceUrl);
    const resolvedPageType = derivePageType(parsedUrl, pageType);
    const title = deriveTitle(parsedUrl);
    const summary = notes
      ? `Prepared deterministic ${pageTypeLabels[resolvedPageType]} analysis for ${title}. Operator notes: ${notes}`
      : `Prepared deterministic ${pageTypeLabels[resolvedPageType]} analysis for ${title}.`;

    return {
      sourceUrl: referenceUrl,
      referenceHost: parsedUrl.hostname.replace(/^www\./, ""),
      pageType: resolvedPageType,
      title,
      summary,
      analyzedAt: new Date().toISOString(),
      recommendedSections: deriveRecommendedSections(resolvedPageType)
    };
  }
}
