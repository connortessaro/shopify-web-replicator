import type {
  PageType,
  ReferenceCapture,
  ReferenceAnalysis,
  SectionBlueprintType
} from "@shopify-web-replicator/shared";
import { pageTypeLabels } from "@shopify-web-replicator/shared";

type AnalyzeInput = {
  referenceUrl: string;
  pageType?: PageType;
  notes?: string;
  capture?: ReferenceCapture;
};

function toTitleCase(value: string): string {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((segment) => `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`)
    .join(" ");
}

function deriveTitle(referenceUrl: URL, capture?: ReferenceCapture): string {
  if (capture?.title) {
    return capture.title;
  }

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

function derivePageTypeFromCapture(referenceUrl: URL, capture?: ReferenceCapture): PageType | undefined {
  if (!capture) {
    return undefined;
  }

  if (capture.routeHints.productHandles.length > 0 && capture.primaryCtas.some((cta) => /\/products\//.test(cta.href))) {
    return "product_page";
  }

  if (capture.routeHints.collectionHandles.length > 0 && capture.primaryCtas.some((cta) => /\/collections\//.test(cta.href))) {
    return "collection_page";
  }

  const path = new URL(capture.resolvedUrl || referenceUrl.toString()).pathname;

  if (path === "/" || path === "") {
    return "homepage";
  }

  if (capture.navigationLinks.length >= 3 && capture.imageAssets.length >= 2) {
    return "homepage";
  }

  return undefined;
}

function deriveRecommendedSections(pageType: PageType, capture?: ReferenceCapture): SectionBlueprintType[] {
  if (pageType === "product_page") {
    return ["product_detail", "rich_text", "cta"];
  }

  if (pageType === "collection_page") {
    return ["hero", "collection_grid", "cta"];
  }

  if (pageType === "homepage" && capture && capture.routeHints.collectionHandles.length > 0) {
    return ["hero", "collection_grid", "rich_text", "cta"];
  }

  return ["hero", "rich_text", "cta"];
}

function describeCapturedSignals(capture?: ReferenceCapture): string | undefined {
  if (!capture) {
    return undefined;
  }

  const parts: string[] = [];

  if (capture.navigationLinks[0]) {
    parts.push(
      `${capture.navigationLinks.length} navigation links including ${capture.navigationLinks[0].label}`
    );
  }

  if (capture.primaryCtas[0]) {
    parts.push(`${capture.primaryCtas.length} CTA signals including ${capture.primaryCtas[0].label}`);
  }

  if (capture.imageAssets.length > 0) {
    parts.push(`${capture.imageAssets.length} captured images`);
  }

  return parts.length > 0 ? parts.join(", ") : undefined;
}

function describeStyleSignals(capture?: ReferenceCapture): string | undefined {
  if (!capture) {
    return undefined;
  }

  const parts: string[] = [];

  if (capture.styleTokens.fontFamilies[0]) {
    parts.push(`primary font ${capture.styleTokens.fontFamilies[0]}`);
  }

  if (capture.styleTokens.dominantColors.length > 0) {
    parts.push(`${capture.styleTokens.dominantColors.length} dominant colors`);
  }

  if (capture.routeHints.productHandles.length > 0) {
    parts.push(`${capture.routeHints.productHandles.length} product route hints`);
  }

  if (capture.routeHints.collectionHandles.length > 0) {
    parts.push(`${capture.routeHints.collectionHandles.length} collection route hints`);
  }

  return parts.length > 0 ? parts.join(", ") : undefined;
}

export class DeterministicPageAnalyzer {
  async analyze({ referenceUrl, pageType, notes, capture }: AnalyzeInput): Promise<ReferenceAnalysis> {
    const parsedUrl = new URL(referenceUrl);
    const resolvedPageType =
      pageType ?? derivePageTypeFromCapture(parsedUrl, capture) ?? derivePageType(parsedUrl, pageType);
    const title = deriveTitle(parsedUrl, capture);
    const signalSummary = describeCapturedSignals(capture);
    const styleSummary = describeStyleSignals(capture);
    const signalParts = [signalSummary, styleSummary].filter(Boolean);
    const summaryBase =
      signalParts.length > 0
        ? `Prepared deterministic ${pageTypeLabels[resolvedPageType]} analysis for ${title} using captured signals from ${signalParts.join(", ")}.`
        : `Prepared deterministic ${pageTypeLabels[resolvedPageType]} analysis for ${title}.`;
    const summary = notes ? `${summaryBase} Operator notes: ${notes}` : summaryBase;

    return {
      sourceUrl: referenceUrl,
      referenceHost: capture?.referenceHost ?? parsedUrl.hostname.replace(/^www\./, ""),
      pageType: resolvedPageType,
      title,
      summary,
      analyzedAt: new Date().toISOString(),
      recommendedSections: deriveRecommendedSections(resolvedPageType, capture)
    };
  }
}
