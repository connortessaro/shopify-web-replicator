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
});
