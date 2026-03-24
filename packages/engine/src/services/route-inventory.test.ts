import { describe, expect, it } from "vitest";

import { ShopifyRouteInventoryService } from "./route-inventory.js";

describe("ShopifyRouteInventoryService", () => {
  it("builds a bounded same-host route inventory from homepage navigation and CTAs", async () => {
    const service = new ShopifyRouteInventoryService();

    const inventory = await service.build({
      referenceUrl: "https://example.com",
      inspection: {
        sourceUrl: "https://example.com",
        resolvedUrl: "https://example.com/",
        referenceHost: "example.com",
        title: "Example Store",
        capturedAt: "2026-03-21T18:00:00.000Z",
        description: "Hero-led storefront",
        textContent: "Example Store",
        headingOutline: ["Example Store"],
        navigationLinks: [
          { label: "Shop", href: "https://example.com/collections/shop" },
          { label: "About", href: "https://example.com/pages/about" },
          { label: "Shop", href: "https://example.com/collections/shop" },
          { label: "External", href: "https://other.example.com/path" },
          { label: "Cart", href: "https://example.com/cart" }
        ],
        primaryCtas: [
          { label: "Buy now", href: "https://example.com/products/trail-pack" },
          { label: "Learn more", href: "https://example.com/pages/about" }
        ],
        imageAssets: [],
        styleTokens: {
          dominantColors: ["rgb(255, 255, 255)"],
          fontFamilies: ["Inter"]
        },
        routeHints: {
          productHandles: ["trail-pack"],
          collectionHandles: ["shop"],
          cartPath: "/cart",
          checkoutPath: "/checkout"
        },
        evidence: ["window.Shopify"],
        isPasswordProtected: false,
        captureBundlePath: "/tmp/captures/job_123/capture-bundle.json",
        desktopScreenshotPath: "/tmp/captures/job_123/desktop.jpg",
        mobileScreenshotPath: "/tmp/captures/job_123/mobile.jpg"
      }
    });

    expect(inventory.referenceHost).toBe("example.com");
    expect(inventory.routes).toEqual([
      expect.objectContaining({ kind: "homepage", url: "https://example.com/" }),
      expect.objectContaining({ kind: "collection_page", handle: "shop" }),
      expect.objectContaining({ kind: "content_page", handle: "about" }),
      expect.objectContaining({ kind: "product_page", handle: "trail-pack" })
    ]);
    expect(inventory.summary).toContain("4 routes");
  });
});
