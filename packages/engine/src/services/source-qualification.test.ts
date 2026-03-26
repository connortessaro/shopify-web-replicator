import { describe, expect, it } from "vitest";

import { ShopifySourceQualificationService } from "./source-qualification.js";
import { StorefrontInspectionError } from "./storefront-inspector.js";

describe("ShopifySourceQualificationService", () => {
  it("flags bot-protection captures as unsupported", async () => {
    const service = new ShopifySourceQualificationService({
      async inspect() {
        return {
          sourceUrl: "https://example.com",
          resolvedUrl: "https://example.com/",
          referenceHost: "example.com",
          title: "Protected Store",
          capturedAt: "2026-03-21T18:00:00.000Z",
          headingOutline: ["Just a moment"],
          navigationLinks: [{ label: "Home", href: "https://example.com/" }],
          primaryCtas: [],
          imageAssets: [],
          textContent: "Just a moment",
          styleTokens: {
            dominantColors: [],
            fontFamilies: ["Arial"]
          },
          routeHints: {
            productHandles: [],
            collectionHandles: []
          },
          evidence: [],
          captureWarnings: ["bot_protection_or_block_page_detected"],
          isPasswordProtected: false,
          description: "Cloudflare challenge page",
          desktopScreenshotPath: "/tmp/desktop.jpg",
          mobileScreenshotPath: "/tmp/mobile.jpg",
          captureBundlePath: "/tmp/capture-bundle.json"
        };
      }
    });

    const qualification = await service.qualify({ jobId: "job_123", referenceUrl: "https://example.com" });

    expect(qualification.status).toBe("unsupported");
    expect(qualification.failureCode).toBe("capture_failed");
    expect(qualification.summary).toContain("bot-protection");
  });

  it("surfaces browser_unavailable as unsupported", async () => {
    const service = new ShopifySourceQualificationService({
      async inspect() {
        throw new StorefrontInspectionError(
          "browser_unavailable",
          "Browser capture runtime unavailable."
        );
      }
    });

    const qualification = await service.qualify({ jobId: "job_123", referenceUrl: "https://example.com" });

    expect(qualification.status).toBe("unsupported");
    expect(qualification.failureCode).toBe("browser_unavailable");
  });
});
