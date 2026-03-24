import { describe, expect, it } from "vitest";

import { HtmlReferenceCaptureService } from "./reference-capture";

describe("HtmlReferenceCaptureService", () => {
  it("returns disk-backed browser capture metadata and extracted storefront signals", async () => {
    const service = new HtmlReferenceCaptureService({
      async inspect({ referenceUrl }) {
        return {
          sourceUrl: referenceUrl,
          resolvedUrl: "https://example.com/pages/spring-launch",
          referenceHost: "example.com",
          title: "Spring Launch 2026",
          description: "High-converting launch page for the spring collection.",
          capturedAt: "2026-03-21T12:00:30.000Z",
          captureBundlePath: "/tmp/job_123/capture-bundle.json",
          desktopScreenshotPath: "/tmp/job_123/desktop.jpg",
          mobileScreenshotPath: "/tmp/job_123/mobile.jpg",
          textContent: "Spring Launch 2026 Hero copy for the launch page.",
          headingOutline: ["Spring Launch 2026", "Why it converts"],
          navigationLinks: [
            { label: "Shop Spring", href: "https://example.com/collections/spring" },
            { label: "Our Story", href: "https://example.com/pages/story" }
          ],
          primaryCtas: [
            { label: "Shop the launch pack", href: "https://example.com/products/launch-pack" }
          ],
          imageAssets: [{ src: "https://example.com/cdn/hero.jpg", alt: "Launch hero" }],
          styleTokens: {
            dominantColors: ["rgb(255, 255, 255)", "rgb(17, 24, 39)"],
            fontFamilies: ["Inter", "Playfair Display"],
            bodyTextColor: "rgb(17, 24, 39)",
            pageBackgroundColor: "rgb(255, 255, 255)",
            primaryButtonBackgroundColor: "rgb(17, 24, 39)",
            primaryButtonTextColor: "rgb(255, 255, 255)",
            linkColor: "rgb(37, 99, 235)"
          },
          routeHints: {
            productHandles: ["launch-pack"],
            collectionHandles: ["spring"],
            cartPath: "/cart",
            checkoutPath: "/checkout"
          },
          evidence: ["window.Shopify"],
          isPasswordProtected: false
        };
      }
    });

    const capture = await service.capture({
      jobId: "job_123",
      referenceUrl: "https://example.com/pages/spring-launch"
    });

    expect(capture).toMatchObject({
      sourceUrl: "https://example.com/pages/spring-launch",
      resolvedUrl: "https://example.com/pages/spring-launch",
      referenceHost: "example.com",
      title: "Spring Launch 2026",
      description: "High-converting launch page for the spring collection.",
      captureBundlePath: "/tmp/job_123/capture-bundle.json",
      desktopScreenshotPath: "/tmp/job_123/desktop.jpg",
      mobileScreenshotPath: "/tmp/job_123/mobile.jpg"
    });
    expect(capture.headingOutline).toEqual(["Spring Launch 2026", "Why it converts"]);
    expect(capture.styleTokens.fontFamilies).toEqual(["Inter", "Playfair Display"]);
    expect(capture.routeHints.productHandles).toEqual(["launch-pack"]);
    expect(capture.routeHints.collectionHandles).toEqual(["spring"]);
    expect(capture.textContent).toContain("Hero copy for the launch page.");
  });
});
