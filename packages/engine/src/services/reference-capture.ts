import type { ReferenceCapture } from "@shopify-web-replicator/shared";

type CaptureInput = {
  jobId: string;
  referenceUrl: string;
};
import type { StorefrontInspection } from "./storefront-inspector.js";

export class HtmlReferenceCaptureService {
  readonly #inspector: {
    inspect(input: CaptureInput): Promise<StorefrontInspection>;
  };

  constructor(inspector: { inspect(input: CaptureInput): Promise<StorefrontInspection> }) {
    this.#inspector = inspector;
  }

  async capture({ jobId, referenceUrl }: CaptureInput): Promise<ReferenceCapture> {
    const inspection = await this.#inspector.inspect({ jobId, referenceUrl });

    return {
      sourceUrl: inspection.sourceUrl,
      resolvedUrl: inspection.resolvedUrl,
      referenceHost: inspection.referenceHost,
      title: inspection.title,
      ...(inspection.description ? { description: inspection.description } : {}),
      capturedAt: inspection.capturedAt,
      captureBundlePath: inspection.captureBundlePath,
      desktopScreenshotPath: inspection.desktopScreenshotPath,
      mobileScreenshotPath: inspection.mobileScreenshotPath,
      textContent: inspection.textContent,
      headingOutline: inspection.headingOutline,
      navigationLinks: inspection.navigationLinks,
      primaryCtas: inspection.primaryCtas,
      imageAssets: inspection.imageAssets,
      styleTokens: inspection.styleTokens,
      routeHints: inspection.routeHints
    };
  }
}
