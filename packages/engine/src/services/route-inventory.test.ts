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

  it("canonicalizes hashes and deduplicates same-route entries across links", async () => {
    const service = new ShopifyRouteInventoryService();

    const inventory = await service.build({
      referenceUrl: "https://example.com",
      inspection: {
        sourceUrl: "https://example.com",
        resolvedUrl: "https://example.com/",
        referenceHost: "example.com",
        title: "Example Store",
        capturedAt: "2026-03-21T18:00:00.000Z",
        description: "Hash dedupe storefront",
        textContent: "Example Store",
        headingOutline: ["Example Store"],
        navigationLinks: [
          { label: "Shop", href: "https://example.com/collections/sale#top" },
          { label: "Shop", href: "https://example.com/collections/sale" },
          { label: "Local", href: "/collections/sale" },
          { label: "External", href: "https://outside.example.com/collections/noise" },
          { label: "Cart", href: "https://example.com/cart" },
          { label: "Checkout", href: "https://example.com/checkout" }
        ],
        primaryCtas: [
          { label: "Sale", href: "https://example.com/products/black-jacket#fit" },
          { label: "Sale", href: "https://example.com/products/black-jacket" },
          { label: "Invalid", href: "https://outside.example.com/products/noise" }
        ],
        imageAssets: [],
        styleTokens: {
          dominantColors: ["rgb(255, 255, 255)"],
          fontFamilies: ["Inter"]
        },
        routeHints: {
          productHandles: ["black-jacket"],
          collectionHandles: ["sale"],
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

    expect(inventory.routes.map((route) => route.url)).toEqual([
      "https://example.com/",
      "https://example.com/collections/sale",
      "https://example.com/products/black-jacket"
    ]);
    expect(inventory.routes).toEqual([
      expect.objectContaining({ kind: "homepage", source: "root" }),
      expect.objectContaining({ kind: "collection_page", handle: "sale", source: "navigation" }),
      expect.objectContaining({ kind: "product_page", handle: "black-jacket", source: "cta" })
    ]);
    expect(inventory.summary).toContain("3 routes");
  });

  it("respects per-kind route caps while retaining deterministic ordering", async () => {
    const service = new ShopifyRouteInventoryService();

    const inventory = await service.build({
      referenceUrl: "https://example.com",
      inspection: {
        sourceUrl: "https://example.com",
        resolvedUrl: "https://example.com/",
        referenceHost: "example.com",
        title: "Edge Route Store",
        capturedAt: "2026-03-21T18:00:00.000Z",
        description: "Wide route inventory",
        textContent: "Edge Route Store",
        headingOutline: ["Edge Route Store"],
        navigationLinks: Array.from({ length: 12 }, (_, index) => ({
          label: `Collection ${index + 1}`,
          href: `https://example.com/collections/collection-${index + 1}`
        })),
        primaryCtas: [
          ...Array.from({ length: 25 }, (_, index) => ({
            label: `Product ${index + 1}`,
            href: `https://example.com/products/product-${index + 1}`
          })),
          ...Array.from({ length: 12 }, (_, index) => ({
            label: `Page ${index + 1}`,
            href: `https://example.com/pages/page-${index + 1}`
          }))
        ],
        imageAssets: [],
        styleTokens: {
          dominantColors: ["rgb(255, 255, 255)"],
          fontFamilies: ["Inter"]
        },
        routeHints: {
          productHandles: [],
          collectionHandles: [],
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

    expect(inventory.routes[0]).toEqual(expect.objectContaining({ kind: "homepage", url: "https://example.com/" }));
    expect(inventory.routes).toHaveLength(1 + 10 + 20 + 10);
    expect(inventory.routes.filter((route) => route.kind === "product_page")).toHaveLength(20);
    expect(inventory.routes.filter((route) => route.kind === "collection_page")).toHaveLength(10);
    expect(inventory.routes.filter((route) => route.kind === "content_page")).toHaveLength(10);
    expect(inventory.summary).toContain("41 routes (1 homepage");
    expect(inventory.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "product_page", url: "https://example.com/products/product-20" }),
        expect.objectContaining({ kind: "collection_page", url: "https://example.com/collections/collection-10" }),
        expect.objectContaining({ kind: "content_page", url: "https://example.com/pages/page-10" })
      ])
    );
  });
});
