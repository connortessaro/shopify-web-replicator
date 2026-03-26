import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { StorefrontParityAuditor } from "./parity-auditor.js";

describe("StorefrontParityAuditor", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
    tempDirectories.length = 0;
  });

  const buildBaseCapture = async () => {
    const captureRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-parity-"));
    const sourceCaptureDesktopScreenshotPath = join(captureRoot, "source-desktop.jpg");
    const sourceCaptureMobileScreenshotPath = join(captureRoot, "source-mobile.jpg");
    const destinationCaptureDesktopScreenshotPath = join(captureRoot, "dest-desktop.jpg");
    const destinationCaptureMobileScreenshotPath = join(captureRoot, "dest-mobile.jpg");

    await writeFile(sourceCaptureDesktopScreenshotPath, "a".repeat(1200));
    await writeFile(sourceCaptureMobileScreenshotPath, "a".repeat(1200));
    await writeFile(destinationCaptureDesktopScreenshotPath, "a".repeat(1200));
    await writeFile(destinationCaptureMobileScreenshotPath, "a".repeat(1200));
    tempDirectories.push(captureRoot);

    return {
      captureRoot,
      sourceCaptureDesktopScreenshotPath,
      sourceCaptureMobileScreenshotPath,
      destinationCaptureDesktopScreenshotPath,
      destinationCaptureMobileScreenshotPath
    };
  };

  it("produces route-level parity results from source and destination inspections", async () => {
    const {
      sourceCaptureDesktopScreenshotPath,
      sourceCaptureMobileScreenshotPath,
      destinationCaptureDesktopScreenshotPath,
      destinationCaptureMobileScreenshotPath
    } = await buildBaseCapture();

    const auditor = new StorefrontParityAuditor({
      inspector: {
        async inspect({ referenceUrl }) {
          const isPreview = referenceUrl.includes("preview_theme_id");

          return {
            sourceUrl: referenceUrl,
            resolvedUrl: referenceUrl,
            referenceHost: "example.com",
            title: "Example Store",
            capturedAt: "2026-03-21T18:02:00.000Z",
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
            captureBundlePath: isPreview ? "/tmp/preview-capture-bundle.json" : "/tmp/source-inspection-capture-bundle.json",
            desktopScreenshotPath: isPreview ? destinationCaptureDesktopScreenshotPath : sourceCaptureDesktopScreenshotPath,
            mobileScreenshotPath: isPreview ? destinationCaptureMobileScreenshotPath : sourceCaptureMobileScreenshotPath
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
        captureBundlePath: join(tempDirectories[0]!, "source-bundle.json"),
        desktopScreenshotPath: sourceCaptureDesktopScreenshotPath,
        mobileScreenshotPath: sourceCaptureMobileScreenshotPath,
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
            captureBundlePath: join(tempDirectories[0]!, "source-home-bundle.json"),
            desktopScreenshotPath: sourceCaptureDesktopScreenshotPath,
            mobileScreenshotPath: sourceCaptureMobileScreenshotPath
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

  it("raises a warning when screenshot files are missing for parity checks", async () => {
    const { sourceCaptureDesktopScreenshotPath } = await buildBaseCapture();
    const missingDestinationScreenshot = "/tmp/does-not-exist-3x93c6m-desktop.jpg";

    const auditor = new StorefrontParityAuditor({
      inspector: {
        async inspect({ referenceUrl }) {
          const isPreview = referenceUrl.includes("preview_theme_id");

          return {
            sourceUrl: referenceUrl,
            resolvedUrl: referenceUrl,
            referenceHost: "example.com",
            title: "Example Store",
            capturedAt: "2026-03-21T18:02:00.000Z",
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
            captureBundlePath: `${referenceUrl}-bundle.json`,
            desktopScreenshotPath: isPreview ? missingDestinationScreenshot : sourceCaptureDesktopScreenshotPath,
            mobileScreenshotPath: isPreview ? "/tmp/missing-mobile.jpg" : "/tmp/missing-mobile-src.jpg"
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
        captureBundlePath: join(tempDirectories[0]!, "source-bundle.json"),
        desktopScreenshotPath: sourceCaptureDesktopScreenshotPath,
        mobileScreenshotPath: "/tmp/source-mobile-missing.jpg",
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
            captureBundlePath: join(tempDirectories[0]!, "route-bundle.json"),
            desktopScreenshotPath: sourceCaptureDesktopScreenshotPath,
            mobileScreenshotPath: "/tmp/source-mobile-missing.jpg"
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

    expect(audit.status).toBe("warning");
    expect(audit.routes[0].notes.join(" ")).toContain("one or both screenshot files are missing");
  });

  it("flags screenshot byte-size drift as a visual divergence", async () => {
    const {
      sourceCaptureDesktopScreenshotPath,
      sourceCaptureMobileScreenshotPath,
      destinationCaptureDesktopScreenshotPath,
      destinationCaptureMobileScreenshotPath
    } = await buildBaseCapture();

    await writeFile(destinationCaptureDesktopScreenshotPath, "a".repeat(24));
    await writeFile(destinationCaptureMobileScreenshotPath, "a");

    const auditor = new StorefrontParityAuditor({
      inspector: {
        async inspect({ referenceUrl }) {
          const isPreview = referenceUrl.includes("preview_theme_id");

          return {
            sourceUrl: referenceUrl,
            resolvedUrl: referenceUrl,
            referenceHost: "example.com",
            title: "Example Store",
            capturedAt: "2026-03-21T18:02:00.000Z",
            textContent: "Example Store",
            headingOutline: isPreview ? ["Example Store"] : ["Example Store"],
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
            captureBundlePath: `${referenceUrl}-bundle.json`,
            desktopScreenshotPath: isPreview ? destinationCaptureDesktopScreenshotPath : sourceCaptureDesktopScreenshotPath,
            mobileScreenshotPath: isPreview ? destinationCaptureMobileScreenshotPath : sourceCaptureMobileScreenshotPath
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
        captureBundlePath: join(tempDirectories[0]!, "source-bundle.json"),
        desktopScreenshotPath: sourceCaptureDesktopScreenshotPath,
        mobileScreenshotPath: sourceCaptureMobileScreenshotPath,
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
            captureBundlePath: join(tempDirectories[0]!, "route-bundle.json"),
            desktopScreenshotPath: sourceCaptureDesktopScreenshotPath,
            mobileScreenshotPath: sourceCaptureMobileScreenshotPath
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

    expect(audit.status).toBe("warning");
    expect(audit.routes[0].notes.join(" ")).toContain("byte-size drift");
  });
});
