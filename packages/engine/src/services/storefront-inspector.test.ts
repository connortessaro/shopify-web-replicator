import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { StorefrontInspector, buildContextOptions, detectCaptureWarnings, extractHandle } from "./storefront-inspector";

describe("StorefrontInspector", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
    tempDirectories.length = 0;
  });

  it("persists a capture bundle and screenshots to the capture root", async () => {
    const captureRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-captures-"));
    tempDirectories.push(captureRoot);

    const inspector = new StorefrontInspector(captureRoot, {
      async inspect({ referenceUrl }) {
        return {
          sourceUrl: referenceUrl,
          resolvedUrl: referenceUrl,
          referenceHost: "example.com",
          title: "Example Storefront",
          description: "Captured storefront hero and navigation.",
          capturedAt: "2026-03-21T12:00:30.000Z",
          html: "<html><body><h1>Example Storefront</h1></body></html>",
          textContent: "Example Storefront",
          headingOutline: ["Example Storefront"],
          navigationLinks: [{ label: "Shop", href: "https://example.com/collections/all" }],
          primaryCtas: [{ label: "Buy now", href: "https://example.com/products/example-storefront" }],
          imageAssets: [{ src: "https://cdn.shopify.com/example.jpg", alt: "Example storefront" }],
          styleTokens: {
            dominantColors: ["rgb(255, 255, 255)", "rgb(17, 24, 39)"],
            fontFamilies: ["Inter", "Georgia"],
            bodyTextColor: "rgb(17, 24, 39)",
            pageBackgroundColor: "rgb(255, 255, 255)"
          },
          routeHints: {
            productHandles: ["example-storefront"],
            collectionHandles: ["all"],
            cartPath: "/cart",
            checkoutPath: "/checkout"
          },
          evidence: ["window.Shopify"],
          captureWarnings: [],
          httpStatus: 200,
          isPasswordProtected: false,
          shopDomain: "example-store.myshopify.com",
          desktopScreenshot: new Uint8Array([1, 2, 3]),
          mobileScreenshot: new Uint8Array([4, 5, 6])
        };
      }
    });

    const inspection = await inspector.inspect({
      jobId: "job_test123",
      referenceUrl: "https://example.com"
    });

    expect(inspection.captureBundlePath).toBe(join(captureRoot, "job_test123", "capture-bundle.json"));
    expect(inspection.desktopScreenshotPath).toBe(join(captureRoot, "job_test123", "desktop.jpg"));
    expect(inspection.mobileScreenshotPath).toBe(join(captureRoot, "job_test123", "mobile.jpg"));
    expect(inspection.routeHints.productHandles).toEqual(["example-storefront"]);

    await expect(readFile(inspection.desktopScreenshotPath)).resolves.toEqual(Buffer.from([1, 2, 3]));
    await expect(readFile(inspection.mobileScreenshotPath)).resolves.toEqual(Buffer.from([4, 5, 6]));
    await expect(readFile(inspection.captureBundlePath, "utf8")).resolves.toContain("\"window.Shopify\"");
    await expect(readFile(inspection.captureBundlePath, "utf8")).resolves.toContain("\"html\":");
  });

  it("flags bot-protection content in capture warnings", () => {
    const warningKeys = detectCaptureWarnings("Need to pass challenge", "<html>Just a moment</html>", "Blocked");
    expect(warningKeys).toContain("bot_protection_or_block_page_detected");
  });

  it("adds sparse text warnings for empty captures", () => {
    const warningKeys = detectCaptureWarnings("tiny", "<html></html>", "Home");
    expect(warningKeys).toContain("sparse_text_signal");
  });

  it("normalizes desktop and mobile context defaults", () => {
    expect(buildContextOptions({ width: 1440, height: 1200 })).toMatchObject({
      hasTouch: false,
      isMobile: false,
      deviceScaleFactor: 1,
      colorScheme: "light",
      locale: "en-US",
      timezoneId: "America/New_York",
      viewport: { width: 1440, height: 1200 }
    });

    expect(buildContextOptions({ width: 393, height: 852 })).toMatchObject({
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 3,
      colorScheme: "light",
      locale: "en-US",
      timezoneId: "America/New_York",
      viewport: { width: 393, height: 852 }
    });
  });

  it("extracts Shopify handles from route URLs", () => {
    expect(extractHandle("https://example.com/products/blue-shirt?size=xl", "/products/")).toBe("blue-shirt");
    expect(extractHandle("https://example.com/collections/sale/special", "/collections/")).toBe("sale");
    expect(extractHandle("https://example.com/cart", "/products/")).toBeUndefined();
  });
});
