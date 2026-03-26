import { describe, expect, it } from "vitest";

import { createHydrogenReplicationJob } from "../../../shared/src/hydrogen.js";

import { InMemoryJobRepository } from "../repository/in-memory-job-repository.js";
import { HydrogenReplicationPipeline } from "./hydrogen-replication-pipeline.js";

describe("HydrogenReplicationPipeline", () => {
  it("processes a Hydrogen job end-to-end into a reviewable workspace result", async () => {
    const repository = new InMemoryJobRepository();
    const job = createHydrogenReplicationJob({
      referenceUrl: "https://example.com",
      targetId: "example-store",
      targetLabel: "Example Store"
    });
    await repository.save(job as never);
    const pipeline = new HydrogenReplicationPipeline({
      repository,
      qualificationService: {
        async qualify() {
          return {
            status: "supported",
            platform: "shopify",
            referenceHost: "example.com",
            resolvedUrl: "https://example.com/",
            qualifiedAt: "2026-03-26T00:00:10.000Z",
            summary: "Supported source.",
            evidence: ["window.Shopify"],
            isPasswordProtected: false
          };
        }
      },
      captureService: {
        async capture() {
          return {
            sourceUrl: "https://example.com",
            resolvedUrl: "https://example.com/",
            referenceHost: "example.com",
            title: "Example Store",
            capturedAt: "2026-03-26T00:00:20.000Z",
            captureBundlePath: "/tmp/capture.json",
            desktopScreenshotPath: "/tmp/desktop.jpg",
            mobileScreenshotPath: "/tmp/mobile.jpg",
            textContent: "Example Store",
            headingOutline: ["Example Store"],
            navigationLinks: [{ label: "Catalog", href: "https://example.com/collections/all" }],
            primaryCtas: [{ label: "Buy now", href: "https://example.com/products/trail-pack" }],
            imageAssets: [{ src: "https://example.com/hero.jpg", alt: "Hero" }],
            styleTokens: {
              dominantColors: ["#ffffff"],
              fontFamilies: ["Inter"]
            },
            routeHints: {
              productHandles: ["trail-pack"],
              collectionHandles: ["all"],
              cartPath: "/cart",
              checkoutPath: "/checkout"
            }
          };
        }
      },
      routeInventoryService: {
        async build() {
          return {
            discoveredAt: "2026-03-26T00:00:20.000Z",
            referenceHost: "example.com",
            summary: "Discovered routes.",
            routes: [
              { kind: "homepage", source: "root", url: "https://example.com/" },
              { kind: "product_page", source: "cta", url: "https://example.com/products/trail-pack", handle: "trail-pack" },
              { kind: "collection_page", source: "navigation", url: "https://example.com/collections/all", handle: "all" }
            ]
          };
        }
      },
      discoveryService: {
        build({ capture, routeInventory }) {
          return {
            discoveredAt: capture.capturedAt,
            summary: routeInventory.summary,
            screenshots: {
              desktopPath: capture.desktopScreenshotPath,
              mobilePath: capture.mobileScreenshotPath
            },
            routes: [
              { path: "/", sourceUrl: "https://example.com/", kind: "homepage", confidence: "high" },
              { path: "/products/trail-pack", sourceUrl: "https://example.com/products/trail-pack", kind: "product_page", confidence: "high" },
              { path: "/cart", sourceUrl: "https://example.com/cart", kind: "cart", confidence: "high" }
            ],
            interactions: [],
            observedFeatures: ["catalog", "cart", "checkout"],
            networkEndpoints: []
          };
        }
      } as never,
      figmaStagingService: {
        async stage({ referenceUrl }) {
          return {
            stagedAt: "2026-03-26T00:00:30.000Z",
            status: "imported",
            sourceUrl: referenceUrl,
            summary: "Imported into Figma.",
            handoffPrompt: "Use Figma context.",
            recommendedTools: ["generate_figma_design", "get_design_context"],
            availableTools: ["generate_figma_design", "get_design_context"],
            fileKey: "FILE123",
            nodeId: "0:1",
            figmaUrl: "https://www.figma.com/design/FILE123/Test",
            designContextCode: "export const hero = true;"
          };
        }
      } as never,
      frontendSpecBuilder: {
        build() {
          return {
            builtAt: "2026-03-26T00:00:40.000Z",
            summary: "Built frontend spec.",
            components: ["SiteLayout", "HeroSection"],
            routes: [
              {
                path: "/",
                kind: "homepage",
                component: "HomepageRoute",
                sourceUrl: "https://example.com/"
              }
            ],
            designTokens: {
              colors: ["#ffffff"],
              fonts: ["Inter"]
            }
          };
        }
      } as never,
      backendInferenceService: {
        infer() {
          return {
            inferredAt: "2026-03-26T00:00:50.000Z",
            summary: "Inferred backend capabilities.",
            capabilities: [
              { name: "catalog", confidence: "high", rationale: "Observed product and collection routes." },
              { name: "custom_integrations", confidence: "unsupported", rationale: "Not observable." }
            ],
            unresolvedCapabilities: ["custom_integrations"]
          };
        }
      } as never,
      hydrogenGenerator: {
        async generate() {
          return {
            artifacts: [
              {
                kind: "config",
                path: "generated-sites/example-store/.replicator/hydrogen-generation.json",
                status: "generated",
                description: "Hydrogen generation metadata",
                lastWrittenAt: "2026-03-26T00:01:00.000Z"
              }
            ],
            generation: {
              generatedAt: "2026-03-26T00:01:00.000Z",
              workspacePath: "/tmp/generated-sites/example-store",
              summary: "Generated Hydrogen workspace.",
              routesWritten: ["/"],
              generatedFiles: ["/tmp/generated-sites/example-store/app/root.tsx"]
            }
          };
        }
      } as never,
      hydrogenValidator: {
        async validate() {
          return {
            checkedAt: "2026-03-26T00:01:10.000Z",
            status: "warning",
            summary: "Validation passed with unresolved capabilities.",
            output: "custom_integrations"
          };
        }
      } as never
    });

    await pipeline.process(job.id);
    const stored = await repository.getById(job.id);

    expect(stored).toMatchObject({
      pipelineKind: "hydrogen",
      status: "needs_review",
      currentStage: "review",
      playwrightDiscovery: {
        summary: "Discovered routes."
      },
      figmaImport: {
        status: "imported",
        fileKey: "FILE123"
      },
      frontendSpec: {
        components: ["SiteLayout", "HeroSection"]
      },
      backendInference: {
        unresolvedCapabilities: ["custom_integrations"]
      },
      hydrogenGeneration: {
        workspacePath: "/tmp/generated-sites/example-store"
      },
      hydrogenValidation: {
        status: "warning"
      },
      hydrogenReview: {
        nextActions: expect.arrayContaining([
          expect.stringContaining("Resolve unresolved capability areas")
        ])
      }
    });
  });

  it("fails the Hydrogen job when Figma import fails", async () => {
    const repository = new InMemoryJobRepository();
    const job = createHydrogenReplicationJob({
      referenceUrl: "https://example.com",
      targetId: "example-store"
    });
    await repository.save(job as never);
    const pipeline = new HydrogenReplicationPipeline({
      repository,
      qualificationService: {
        async qualify() {
          return {
            status: "supported",
            platform: "shopify",
            referenceHost: "example.com",
            resolvedUrl: "https://example.com/",
            qualifiedAt: "2026-03-26T00:00:10.000Z",
            summary: "Supported source.",
            evidence: ["window.Shopify"],
            isPasswordProtected: false
          };
        }
      },
      captureService: {
        async capture() {
          return {
            sourceUrl: "https://example.com",
            resolvedUrl: "https://example.com/",
            referenceHost: "example.com",
            title: "Example Store",
            capturedAt: "2026-03-26T00:00:20.000Z",
            captureBundlePath: "/tmp/capture.json",
            desktopScreenshotPath: "/tmp/desktop.jpg",
            mobileScreenshotPath: "/tmp/mobile.jpg",
            textContent: "Example Store",
            headingOutline: ["Example Store"],
            navigationLinks: [],
            primaryCtas: [],
            imageAssets: [],
            styleTokens: {
              dominantColors: ["#ffffff"],
              fontFamilies: ["Inter"]
            },
            routeHints: {
              productHandles: [],
              collectionHandles: []
            }
          };
        }
      },
      routeInventoryService: {
        async build() {
          return {
            discoveredAt: "2026-03-26T00:00:20.000Z",
            referenceHost: "example.com",
            summary: "Discovered routes.",
            routes: [{ kind: "homepage", source: "root", url: "https://example.com/" }]
          };
        }
      },
      discoveryService: {
        build() {
          return {
            discoveredAt: "2026-03-26T00:00:20.000Z",
            summary: "Discovered routes.",
            screenshots: {
              desktopPath: "/tmp/desktop.jpg",
              mobilePath: "/tmp/mobile.jpg"
            },
            routes: [{ path: "/", sourceUrl: "https://example.com/", kind: "homepage", confidence: "high" }],
            interactions: [],
            observedFeatures: [],
            networkEndpoints: []
          };
        }
      } as never,
      figmaStagingService: {
        async stage() {
          throw new Error("Figma bridge unavailable.");
        }
      } as never,
      frontendSpecBuilder: {} as never,
      backendInferenceService: {} as never,
      hydrogenGenerator: {} as never,
      hydrogenValidator: {} as never
    });

    await pipeline.process(job.id);
    const stored = await repository.getById(job.id);

    expect(stored).toMatchObject({
      status: "failed",
      currentStage: "figma_import",
      error: {
        message: "Figma bridge unavailable."
      }
    });
  });
});
