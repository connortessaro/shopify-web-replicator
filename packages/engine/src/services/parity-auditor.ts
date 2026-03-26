import type {
  AdminReplicationResult,
  ParityAudit,
  ParityRouteResult,
  ReferenceCapture
} from "@shopify-web-replicator/shared";

import type { StorefrontInspection } from "./storefront-inspector.js";
import { StorefrontInspector } from "./storefront-inspector.js";
import { stat } from "node:fs/promises";

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

async function scoreInspection(
  source: StorefrontInspection,
  destination: StorefrontInspection
): Promise<Omit<ParityRouteResult, "kind" | "url" | "previewUrl">> {
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
  const screenshotSizeScore = await scoreScreenshotSimilarity(
    source.desktopScreenshotPath,
    destination.desktopScreenshotPath
  );
  const components = [headingScore, navigationScore, ctaScore, imageScore];

  if (typeof screenshotSizeScore.score === "number") {
    components.push(screenshotSizeScore.score);
  }

  const visualSimilarity = Number((components.reduce((total, score) => total + score, 0) / components.length).toFixed(2));
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

  if (screenshotSizeScore.isMissing) {
    notes.push(screenshotSizeScore.note);
  }

  if (typeof screenshotSizeScore.score === "number" && screenshotSizeScore.score < 0.8) {
    notes.push("Screenshot byte-size drift is significant; visual parity may be degraded.");
  }

  const computedStatus: ParityStatus = visualSimilarity >= 0.85 ? "matched" : visualSimilarity >= 0.6 ? "warning" : "failed";

  return {
    status: screenshotSizeScore.isMissing ? (computedStatus === "matched" ? "warning" : computedStatus) : computedStatus,
    visualSimilarity,
    sourceTitle: source.title,
    destinationTitle: destination.title,
    notes
  };
}

async function scoreScreenshotSimilarity(sourceDesktopScreenshotPath: string, destinationDesktopScreenshotPath: string): Promise<{
  score?: number;
  isMissing: boolean;
  note: string;
}> {
  try {
    const [sourceStat, destinationStat] = await Promise.all([
      stat(sourceDesktopScreenshotPath),
      stat(destinationDesktopScreenshotPath)
    ]);

    if (sourceStat.size <= 0 || destinationStat.size <= 0) {
      return {
        isMissing: true,
        note: "Screenshot file is empty; visual parity comparison is not reliable."
      };
    }

    const sizeRatio = Math.min(sourceStat.size, destinationStat.size) / Math.max(sourceStat.size, destinationStat.size);
    return {
      score: Number(sizeRatio.toFixed(2)),
      isMissing: false,
      note: "Screenshot size comparison used for coarse visual parity."
    };
  } catch {
    return {
      isMissing: true,
      note: "Screenshot comparison is unavailable because one or both screenshot files are missing."
    };
  }
}

type ParityStatus = "matched" | "warning" | "failed";

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
      const scored = await scoreInspection(sourceInspection, destinationInspection);

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
