import { describe, expect, it } from "vitest";

import { StorefrontParityAuditor } from "./parity-auditor.js";

describe("StorefrontParityAuditor", () => {
  it("produces route-level parity results from source and destination inspections", async () => {
    const auditor = new StorefrontParityAuditor({
      inspector: {
        async inspect({ referenceUrl }) {
          if (referenceUrl.includes("preview_theme_id")) {
            return {
              sourceUrl: referenceUrl,
              resolvedUrl: referenceUrl,
              referenceHost: "local-dev-store.myshopify.com",
              title: "Example Store",
              capturedAt: "2026-03-21T18:02:00.000Z",
              description: "Preview",
              textContent: "Example Store",
              headingOutline: ["Example Store"],
              navigationLinks: [{ label: "Shop", href: `${referenceUrl}/collections/shop` }],
              primaryCtas: [{ label: "Buy now", href: `${referenceUrl}/products/trail-pack` }],
              imageAssets: [{ src: `${referenceUrl}/hero.jpg`, alt: "Hero" }],
              styleTokens: {
                dominantColors: ["rgb(255, 255, 255)"],
                fontFamilies: ["Inter"]
              },
              routeHints: {
                productHandles: ["trail-pack"],
                collectionHandles: ["shop"]
              },
              evidence: ["window.Shopify"],
              isPasswordProtected: false,
              captureBundlePath: "/tmp/captures/job_123/preview/capture-bundle.json",
              desktopScreenshotPath: "/tmp/captures/job_123/preview/desktop.jpg",
              mobileScreenshotPath: "/tmp/captures/job_123/preview/mobile.jpg"
            };
          }

          return {
            sourceUrl: referenceUrl,
            resolvedUrl: referenceUrl,
            referenceHost: "example.com",
            title: "Example Store",
            capturedAt: "2026-03-21T18:02:00.000Z",
            description: "Source",
            textContent: "Example Store",
            headingOutline: ["Example Store"],
            navigationLinks: [{ label: "Shop", href: "https://example.com/collections/shop" }],
            primaryCtas: [{ label: "Buy now", href: "https://example.com/products/trail-pack" }],
            imageAssets: [{ src: "https://example.com/hero.jpg", alt: "Hero" }],
            styleTokens: {
              dominantColors: ["rgb(255, 255, 255)"],
              fontFamilies: ["Inter"]
            },
            routeHints: {
              productHandles: ["trail-pack"],
              collectionHandles: ["shop"]
            },
            evidence: ["window.Shopify"],
            isPasswordProtected: false,
            captureBundlePath: "/tmp/captures/job_123/source/capture-bundle.json",
            desktopScreenshotPath: "/tmp/captures/job_123/source/desktop.jpg",
            mobileScreenshotPath: "/tmp/captures/job_123/source/mobile.jpg"
          };
        }
      }
    });

    const audit = await auditor.audit({
      sourceCapture: {
        sourceUrl: "https://example.com",
        resolvedUrl: "https://example.com/",
        referenceHost: "example.com",
        title: "Example Store",
        capturedAt: "2026-03-21T18:00:30.000Z",
        captureBundlePath: "/tmp/captures/job_123/capture-bundle.json",
        desktopScreenshotPath: "/tmp/captures/job_123/desktop.jpg",
        mobileScreenshotPath: "/tmp/captures/job_123/mobile.jpg",
        textContent: "Example Store",
        headingOutline: ["Example Store"],
        navigationLinks: [{ label: "Shop", href: "https://example.com/collections/shop" }],
        primaryCtas: [{ label: "Buy now", href: "https://example.com/products/trail-pack" }],
        imageAssets: [{ src: "https://example.com/hero.jpg", alt: "Hero" }],
        styleTokens: {
          dominantColors: ["rgb(255, 255, 255)"],
          fontFamilies: ["Inter"]
        },
        routeHints: {
          productHandles: ["trail-pack"],
          collectionHandles: ["shop"]
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
            imageAssets: [{ src: "https://example.com/hero.jpg", alt: "Hero" }],
            styleTokens: {
              dominantColors: ["rgb(255, 255, 255)"],
              fontFamilies: ["Inter"]
            },
            captureBundlePath: "/tmp/captures/job_123/home/capture-bundle.json",
            desktopScreenshotPath: "/tmp/captures/job_123/home/desktop.jpg",
            mobileScreenshotPath: "/tmp/captures/job_123/home/mobile.jpg"
          }
        ]
      },
      adminReplication: {
        replicatedAt: "2026-03-21T18:01:30.000Z",
        destinationStoreId: "local-dev-store",
        shopDomain: "local-dev-store.myshopify.com",
        themeId: "gid://shopify/OnlineStoreTheme/123456789",
        themeName: "Replicator job_123",
        previewUrl: "https://local-dev-store.myshopify.com?preview_theme_id=123456789",
        summary: "Replicated generated storefront to destination theme.",
        createdResources: [],
        updatedResources: [],
        warnings: [],
        rollbackManifest: {
          generatedAt: "2026-03-21T18:01:30.000Z",
          resources: []
        }
      }
    });

    expect(audit.status).toBe("passed");
    expect(audit.routes).toEqual([
      expect.objectContaining({
        kind: "homepage",
        status: "matched"
      })
    ]);
    expect(audit.summary).toContain("1 routes");
  });
});
