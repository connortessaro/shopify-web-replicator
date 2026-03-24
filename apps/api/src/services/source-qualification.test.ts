import { describe, expect, it } from "vitest";

import { ShopifySourceQualificationService } from "./source-qualification";

describe("ShopifySourceQualificationService", () => {
  it("qualifies a public Shopify storefront when browser inspection finds Shopify markers", async () => {
    const service = new ShopifySourceQualificationService({
      async inspect({ referenceUrl }) {
        return {
          sourceUrl: referenceUrl,
          resolvedUrl: "https://examplestore.com/",
          referenceHost: "examplestore.com",
          title: "Example Storefront",
          capturedAt: "2026-03-21T12:00:15.000Z",
          captureBundlePath: "/tmp/capture-bundle.json",
          desktopScreenshotPath: "/tmp/desktop.jpg",
          mobileScreenshotPath: "/tmp/mobile.jpg",
          textContent: "Example Storefront",
          headingOutline: ["Example Storefront"],
          navigationLinks: [],
          primaryCtas: [],
          imageAssets: [],
          styleTokens: {
            dominantColors: ["rgb(255, 255, 255)"],
            fontFamilies: ["Inter"]
          },
          routeHints: {
            productHandles: [],
            collectionHandles: []
          },
          evidence: ["window.Shopify", "cdn.shopify.com"],
          httpStatus: 200,
          isPasswordProtected: false,
          shopDomain: "examplestore.myshopify.com"
        };
      }
    });

    const qualification = await service.qualify({
      jobId: "job_123",
      referenceUrl: "https://examplestore.com"
    });

    expect(qualification).toMatchObject({
      status: "supported",
      platform: "shopify",
      resolvedUrl: "https://examplestore.com/",
      referenceHost: "examplestore.com",
      httpStatus: 200,
      isPasswordProtected: false,
      shopDomain: "examplestore.myshopify.com"
    });
    expect(qualification.evidence).toContain("window.Shopify");
  });

  it("marks password-protected Shopify storefronts as unsupported", async () => {
    const service = new ShopifySourceQualificationService({
      async inspect({ referenceUrl }) {
        return {
          sourceUrl: referenceUrl,
          resolvedUrl: "https://example.com/password",
          referenceHost: "example.com",
          title: "Opening soon",
          capturedAt: "2026-03-21T12:00:15.000Z",
          captureBundlePath: "/tmp/capture-bundle.json",
          desktopScreenshotPath: "/tmp/desktop.jpg",
          mobileScreenshotPath: "/tmp/mobile.jpg",
          textContent: "Enter using password",
          headingOutline: ["Opening soon"],
          navigationLinks: [],
          primaryCtas: [],
          imageAssets: [],
          styleTokens: {
            dominantColors: ["rgb(255, 255, 255)"],
            fontFamilies: ["Inter"]
          },
          routeHints: {
            productHandles: [],
            collectionHandles: []
          },
          evidence: ["window.Shopify"],
          httpStatus: 200,
          isPasswordProtected: true
        };
      }
    });

    const qualification = await service.qualify({
      jobId: "job_456",
      referenceUrl: "https://example.com"
    });

    expect(qualification).toMatchObject({
      status: "unsupported",
      platform: "shopify",
      failureCode: "password_protected",
      isPasswordProtected: true
    });
    expect(qualification.summary).toMatch(/password protected/i);
  });
});
