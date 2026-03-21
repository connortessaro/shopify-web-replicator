import type { ReferenceAnalysis, SectionBlueprintType } from "@shopify-web-replicator/shared";

type AnalyzeInput = {
  referenceUrl: string;
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

function deriveRecommendedSections(notes?: string): SectionBlueprintType[] {
  if (!notes) {
    return ["hero", "rich_text", "cta"];
  }

  return ["hero", "rich_text", "cta"];
}

export class DeterministicPageAnalyzer {
  async analyze({ referenceUrl, notes }: AnalyzeInput): Promise<ReferenceAnalysis> {
    const parsedUrl = new URL(referenceUrl);
    const title = deriveTitle(parsedUrl);
    const summary = notes
      ? `Prepared deterministic analysis for ${title}. Operator notes: ${notes}`
      : `Prepared deterministic analysis for ${title}.`;

    return {
      sourceUrl: referenceUrl,
      referenceHost: parsedUrl.hostname.replace(/^www\./, ""),
      pageType: "landing_page",
      title,
      summary,
      analyzedAt: new Date().toISOString(),
      recommendedSections: deriveRecommendedSections(notes)
    };
  }
}
