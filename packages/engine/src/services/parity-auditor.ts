import type {
  AdminReplicationResult,
  ParityAudit,
  ParityRouteResult,
  ReferenceCapture
} from "@shopify-web-replicator/shared";

import type { StorefrontInspection } from "./storefront-inspector.js";
import { StorefrontInspector } from "./storefront-inspector.js";

type InspectorLike = Pick<StorefrontInspector, "inspect">;

type AuditInput = {
  jobId?: string;
  sourceCapture: ReferenceCapture;
  adminReplication: AdminReplicationResult;
};

function overlapScore(left: string[], right: string[]): number {
  const leftSet = new Set(left.map((value) => value.toLowerCase()));
  const rightSet = new Set(right.map((value) => value.toLowerCase()));

  if (leftSet.size === 0 && rightSet.size === 0) {
    return 1;
  }

  const shared = [...leftSet].filter((value) => rightSet.has(value)).length;
  return shared / Math.max(leftSet.size, rightSet.size, 1);
}

function buildPreviewRouteUrl(previewUrl: string, sourceUrl: string): string {
  const preview = new URL(previewUrl);
  const source = new URL(sourceUrl);
  preview.pathname = source.pathname;
  preview.searchParams.set("preview_theme_id", preview.searchParams.get("preview_theme_id") ?? "");
  return preview.toString();
}

function scoreInspection(source: StorefrontInspection, destination: StorefrontInspection): Omit<ParityRouteResult, "kind" | "url" | "previewUrl"> {
  const headingScore = overlapScore(source.headingOutline, destination.headingOutline);
  const navigationScore = overlapScore(
    source.navigationLinks.map((link) => link.label),
    destination.navigationLinks.map((link) => link.label)
  );
  const ctaScore = overlapScore(
    source.primaryCtas.map((link) => link.label),
    destination.primaryCtas.map((link) => link.label)
  );
  const imageScore =
    Math.abs(source.imageAssets.length - destination.imageAssets.length) === 0
      ? 1
      : Math.max(0, 1 - Math.abs(source.imageAssets.length - destination.imageAssets.length) / 5);
  const visualSimilarity = Number(((headingScore + navigationScore + ctaScore + imageScore) / 4).toFixed(2));
  const notes: string[] = [];

  if (visualSimilarity < 0.85) {
    notes.push("Structural storefront signals diverged from the source capture.");
  }

  if (headingScore < 1) {
    notes.push("Heading outline does not fully match the source.");
  }

  if (ctaScore < 1) {
    notes.push("Primary CTA labels changed between source and destination.");
  }

  return {
    status: visualSimilarity >= 0.85 ? "matched" : visualSimilarity >= 0.6 ? "warning" : "failed",
    visualSimilarity,
    sourceTitle: source.title,
    destinationTitle: destination.title,
    notes
  };
}

export class StorefrontParityAuditor {
  readonly #inspector: InspectorLike;

  constructor(options: { inspector?: InspectorLike } = {}) {
    this.#inspector = options.inspector ?? new StorefrontInspector("/tmp");
  }

  async audit({ jobId, sourceCapture, adminReplication }: AuditInput): Promise<ParityAudit> {
    const sourceRoutes = sourceCapture.routes ?? [
      {
        kind: "homepage" as const,
        url: sourceCapture.resolvedUrl,
        title: sourceCapture.title,
        referenceHost: sourceCapture.referenceHost,
        headingOutline: sourceCapture.headingOutline,
        navigationLinks: sourceCapture.navigationLinks,
        primaryCtas: sourceCapture.primaryCtas,
        imageAssets: sourceCapture.imageAssets,
        styleTokens: sourceCapture.styleTokens,
        captureBundlePath: sourceCapture.captureBundlePath,
        desktopScreenshotPath: sourceCapture.desktopScreenshotPath,
        mobileScreenshotPath: sourceCapture.mobileScreenshotPath
      }
    ];

    const routes: ParityRouteResult[] = [];

    for (const route of sourceRoutes) {
      const previewUrl = buildPreviewRouteUrl(adminReplication.previewUrl, route.url);
      const destinationInspection = await this.#inspector.inspect({
        jobId: `${jobId ?? "parity"}-${route.kind}`,
        referenceUrl: previewUrl
      });
      const sourceInspection = await this.#inspector.inspect({
        jobId: `${jobId ?? "parity"}-source-${route.kind}`,
        referenceUrl: route.url
      });
      const scored = scoreInspection(sourceInspection, destinationInspection);

      routes.push({
        kind: route.kind,
        url: route.url,
        previewUrl,
        ...scored
      });
    }

    const hasFailure = routes.some((route) => route.status === "failed");
    const hasWarning = routes.some((route) => route.status === "warning");

    return {
      checkedAt: new Date().toISOString(),
      status: hasFailure ? "failed" : hasWarning ? "warning" : "passed",
      summary: `Parity audit completed for ${routes.length} routes.`,
      routes,
      warnings: routes.flatMap((route) => route.notes)
    };
  }
}
