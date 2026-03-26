import { describe, expect, it } from "vitest";

import type { ReferenceCapture } from "@shopify-web-replicator/shared";

import { StorefrontModelBuilder } from "./storefront-model-builder.js";

function createCapture(): ReferenceCapture {
  return {
    sourceUrl: "https://example.com",
    resolvedUrl: "https://example.com/",
    referenceHost: "example.com",
    title: "Example Store",
    description: "Captured storefront hero and navigation.",
    capturedAt: "2026-03-21T18:00:30.000Z",
    captureBundlePath: "/tmp/captures/job_123/capture-bundle.json",
    desktopScreenshotPath: "/tmp/captures/job_123/desktop.jpg",
    mobileScreenshotPath: "/tmp/captures/job_123/mobile.jpg",
    textContent: "Example Store",
    headingOutline: ["Example Store"],
    navigationLinks: [{ label: "Shop", href: "https://example.com/collections/shop" }],
    primaryCtas: [{ label: "Buy now", href: "https://example.com/products/trail-pack" }],
    imageAssets: [{ src: "https://example.com/cdn/hero.jpg", alt: "Hero" }],
    styleTokens: {
      dominantColors: ["rgb(255, 255, 255)", "rgb(17, 24, 39)"],
      fontFamilies: ["Inter", "Georgia"]
    },
    routeHints: {
      productHandles: ["trail-pack"],
      collectionHandles: ["shop"],
      cartPath: "/cart",
      checkoutPath: "/checkout"
    },
    routes: [
      {
        kind: "homepage",
        url: "https://example.com/",
        title: "Example Store",
        referenceHost: "example.com",
        headingOutline: ["Example Store"],
        navigationLinks: [{ label: "Shop", href: "https://example.com/collections/shop" }],
        primaryCtas: [{ label: "Buy now", href: "https://example.com/products/trail-pack" }],
        imageAssets: [{ src: "https://example.com/cdn/hero.jpg", alt: "Hero" }],
        styleTokens: {
          dominantColors: ["rgb(255, 255, 255)"],
          fontFamilies: ["Inter"]
        },
        captureBundlePath: "/tmp/captures/job_123/home/capture-bundle.json",
        desktopScreenshotPath: "/tmp/captures/job_123/home/desktop.jpg",
        mobileScreenshotPath: "/tmp/captures/job_123/home/mobile.jpg"
      },
      {
        kind: "product_page",
        url: "https://example.com/products/trail-pack",
        handle: "trail-pack",
        title: "Trail Pack",
        referenceHost: "example.com",
        headingOutline: ["Trail Pack"],
        navigationLinks: [],
        primaryCtas: [{ label: "Add to cart", href: "https://example.com/cart" }],
        imageAssets: [{ src: "https://example.com/cdn/trail-pack.jpg", alt: "Trail Pack" }],
        styleTokens: {
          dominantColors: ["rgb(255, 255, 255)"],
          fontFamilies: ["Inter"]
        },
        captureBundlePath: "/tmp/captures/job_123/product/capture-bundle.json",
        desktopScreenshotPath: "/tmp/captures/job_123/product/desktop.jpg",
        mobileScreenshotPath: "/tmp/captures/job_123/product/mobile.jpg"
      }
    ]
  };
}

describe("StorefrontModelBuilder", () => {
  it("normalizes captured routes into reusable storefront entities", async () => {
    const builder = new StorefrontModelBuilder();

    const model = await builder.build({
      referenceUrl: "https://example.com",
      capture: createCapture(),
      routeInventory: {
        discoveredAt: "2026-03-21T18:00:10.000Z",
        referenceHost: "example.com",
        summary: "Discovered 2 routes.",
        routes: [
          { kind: "homepage", source: "root", url: "https://example.com/" },
          { kind: "product_page", source: "cta", url: "https://example.com/products/trail-pack", handle: "trail-pack" }
        ]
      }
    });

    expect(model.storeTitle).toBe("Example Store");
    expect(model.products).toEqual([
      expect.objectContaining({
        handle: "trail-pack",
        title: "Trail Pack"
      })
    ]);
    expect(model.menus).toEqual([
      expect.objectContaining({
        handle: "main-menu"
      })
    ]);
    expect(model.pages).toEqual([
      expect.objectContaining({ kind: "homepage" }),
      expect.objectContaining({ kind: "product_page", handle: "trail-pack" })
    ]);
  });

  it("deduplicates products and collections by handle and keeps first route title fallback order", async () => {
    const builder = new StorefrontModelBuilder();

    const model = await builder.build({
      referenceUrl: "https://example.com",
      capture: {
        ...createCapture(),
        title: "Duplicate Store",
        routes: [
          {
            kind: "homepage",
            url: "https://example.com/",
            referenceHost: "example.com",
            title: "Duplicate Store",
            headingOutline: ["Duplicate Store"],
            navigationLinks: [],
            primaryCtas: [],
            imageAssets: [],
            styleTokens: {
              dominantColors: ["rgb(0, 0, 0)"],
              fontFamilies: ["Inter"]
            },
            captureBundlePath: "/tmp/captures/job_123/home/capture-bundle.json",
            desktopScreenshotPath: "/tmp/captures/job_123/home/desktop.jpg",
            mobileScreenshotPath: "/tmp/captures/job_123/home/mobile.jpg"
          },
          {
            kind: "product_page",
            url: "https://example.com/products/trail-pack?variant=1",
            handle: "trail-pack",
            referenceHost: "example.com",
            headingOutline: ["Trail Pack Variant"],
            navigationLinks: [],
            primaryCtas: [],
            imageAssets: [],
            styleTokens: { dominantColors: ["rgb(255, 255, 255)"], fontFamilies: ["Inter"] },
            captureBundlePath: "/tmp/captures/job_123/product-variant/capture-bundle.json",
            desktopScreenshotPath: "/tmp/captures/job_123/product-variant/desktop.jpg",
            mobileScreenshotPath: "/tmp/captures/job_123/product-variant/mobile.jpg"
          },
          {
            kind: "product_page",
            url: "https://example.com/products/trail-pack?variant=2",
            handle: "trail-pack",
            referenceHost: "example.com",
            headingOutline: ["Trail Pack Variant 2"],
            navigationLinks: [],
            primaryCtas: [],
            imageAssets: [],
            styleTokens: { dominantColors: ["rgb(255, 255, 255)"], fontFamilies: ["Inter"] },
            captureBundlePath: "/tmp/captures/job_123/product-variant2/capture-bundle.json",
            desktopScreenshotPath: "/tmp/captures/job_123/product-variant2/desktop.jpg",
            mobileScreenshotPath: "/tmp/captures/job_123/product-variant2/mobile.jpg"
          },
          {
            kind: "product_page",
            url: "https://example.com/products/trail-pack?variant=3",
            handle: "trail-pack",
            referenceHost: "example.com",
            headingOutline: ["Trail Pack Variant 3"],
            navigationLinks: [],
            primaryCtas: [],
            imageAssets: [],
            styleTokens: { dominantColors: ["rgb(255, 255, 255)"], fontFamilies: ["Inter"] },
            captureBundlePath: "/tmp/captures/job_123/product-variant3/capture-bundle.json",
            desktopScreenshotPath: "/tmp/captures/job_123/product-variant3/desktop.jpg",
            mobileScreenshotPath: "/tmp/captures/job_123/product-variant3/mobile.jpg"
          },
          {
            kind: "collection_page",
            url: "https://example.com/collections/trail",
            handle: "trail",
            referenceHost: "example.com",
            headingOutline: ["Trail Collection"],
            navigationLinks: [],
            primaryCtas: [],
            imageAssets: [],
            styleTokens: { dominantColors: ["rgb(255, 255, 255)"], fontFamilies: ["Inter"] },
            captureBundlePath: "/tmp/captures/job_123/collection/capture-bundle.json",
            desktopScreenshotPath: "/tmp/captures/job_123/collection/desktop.jpg",
            mobileScreenshotPath: "/tmp/captures/job_123/collection/mobile.jpg"
          },
          {
            kind: "collection_page",
            url: "https://example.com/collections/trail#featured",
            handle: "trail",
            referenceHost: "example.com",
            headingOutline: ["Trail Collection Duplicate"],
            navigationLinks: [],
            primaryCtas: [],
            imageAssets: [],
            styleTokens: { dominantColors: ["rgb(255, 255, 255)"], fontFamilies: ["Inter"] },
            captureBundlePath: "/tmp/captures/job_123/collection2/capture-bundle.json",
            desktopScreenshotPath: "/tmp/captures/job_123/collection2/desktop.jpg",
            mobileScreenshotPath: "/tmp/captures/job_123/collection2/mobile.jpg"
          }
        ],
        navigationLinks: [
          {
            label: "Homepage",
            href: "https://example.com/?ref=home"
          },
          {
            label: "Search",
            href: "https://example.com/search?q=trail"
          },
          {
            label: "Relative",
            href: "/collections/trail"
          }
        ],
        primaryCtas: []
      },
      routeInventory: {
        discoveredAt: "2026-03-21T18:00:10.000Z",
        referenceHost: "example.com",
        summary: "Deduped 6 routes.",
        routes: [
          { kind: "homepage", source: "root", url: "https://example.com/" },
          { kind: "product_page", handle: "trail-pack", source: "cta", url: "https://example.com/products/trail-pack?variant=1" },
          { kind: "product_page", handle: "trail-pack", source: "cta", url: "https://example.com/products/trail-pack?variant=2" },
          { kind: "collection_page", handle: "trail", source: "navigation", url: "https://example.com/collections/trail" },
          { kind: "collection_page", handle: "trail", source: "navigation", url: "https://example.com/collections/trail?view=grid" }
        ]
      }
    });

    expect(model.products).toEqual([
      {
        handle: "trail-pack",
        title: "trail-pack",
        merchandisingRole: "Primary offer for the generated storefront."
      }
    ]);
    expect(model.collections).toEqual([
      expect.objectContaining({
        handle: "trail",
        title: "trail",
        featuredProductHandles: ["trail-pack"]
      })
    ]);
  });

  it("uses fallback menu targets when menu href cannot be parsed as a URL", async () => {
    const builder = new StorefrontModelBuilder();

    const model = await builder.build({
      referenceUrl: "https://example.com",
      capture: {
        ...createCapture(),
        navigationLinks: [{ label: "Invalid", href: "not-a-url" }]
      },
      routeInventory: {
        discoveredAt: "2026-03-21T18:00:10.000Z",
        referenceHost: "example.com",
        summary: "Invalid menu entry.",
        routes: [
          { kind: "homepage", source: "root", url: "https://example.com/" }
        ]
      }
    });

    expect(model.menus).toEqual([
      {
        handle: "main-menu",
        title: "Main menu",
        items: [
          {
            title: "Invalid",
            target: "not-a-url"
          }
        ]
      }
    ]);
  });
});
