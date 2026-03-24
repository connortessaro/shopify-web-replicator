import { describe, expect, it } from "vitest";

import type {
  AdminReplicationResult,
  AssetSyncResult,
  CommerceWiringPlan,
  RouteInventory,
  ReferenceAnalysis,
  StorefrontModel,
  StoreSetupPlan,
  SourceQualification,
  ThemeCheckResult,
  ThemeMapping,
  ParityAudit
} from "@shopify-web-replicator/shared";

import { InMemoryJobRepository, createReplicationOrchestrator } from "./index";

describe("createReplicationOrchestrator", () => {
  it("replicates a storefront to a terminal handoff with final validation and next actions", async () => {
    const repository = new InMemoryJobRepository();
    const orchestrator = createReplicationOrchestrator({
      repository,
      runtime: {
        themeWorkspacePath: "/tmp/theme-workspace",
        captureRootPath: "/tmp/captures",
        previewCommand: "shopify theme dev",
        destinationStores: [
          {
            id: "local-dev-store",
            label: "Local Dev Store",
            shopDomain: "local-dev-store.myshopify.com",
            adminTokenEnvVar: "SHOPIFY_LOCAL_DEV_TOKEN"
          }
        ]
      },
      qualificationService: {
        async qualify() {
          return {
            status: "supported",
            platform: "shopify",
            referenceHost: "example.com",
            resolvedUrl: "https://example.com/",
            qualifiedAt: "2026-03-20T12:00:15.000Z",
            summary: "Verified a supported public Shopify storefront source.",
            evidence: ["window.Shopify"],
            httpStatus: 200,
            isPasswordProtected: false
          } satisfies SourceQualification;
        }
      },
      routeInventoryService: {
        async build() {
          return {
            discoveredAt: "2026-03-20T12:00:20.000Z",
            referenceHost: "example.com",
            summary: "Discovered 3 routes (1 homepage, 1 collections, 1 products, 0 content pages).",
            routes: [
              { kind: "homepage", source: "root", url: "https://example.com/" },
              { kind: "collection_page", source: "navigation", url: "https://example.com/collections/all", handle: "all" },
              { kind: "product_page", source: "cta", url: "https://example.com/products/example-storefront", handle: "example-storefront" }
            ]
          } satisfies RouteInventory;
        }
      },
      captureService: {
        async capture() {
          return {
            sourceUrl: "https://example.com",
            resolvedUrl: "https://example.com/",
            referenceHost: "example.com",
            title: "Example Storefront",
            description: "A captured reference storefront.",
            capturedAt: "2026-03-20T12:00:30.000Z",
            captureBundlePath: "/tmp/captures/job_123/capture-bundle.json",
            desktopScreenshotPath: "/tmp/captures/job_123/desktop.jpg",
            mobileScreenshotPath: "/tmp/captures/job_123/mobile.jpg",
            textContent: "Example Storefront",
            headingOutline: ["Example Storefront"],
            navigationLinks: [{ label: "Shop", href: "https://example.com/collections/all" }],
            primaryCtas: [{ label: "Buy now", href: "https://example.com/products/example-storefront" }],
            imageAssets: [{ src: "https://example.com/cdn/hero.jpg", alt: "Example Storefront hero" }],
            styleTokens: {
              dominantColors: ["rgb(255, 255, 255)", "rgb(17, 24, 39)"],
              fontFamilies: ["Inter", "Georgia"]
            },
            routeHints: {
              productHandles: ["example-storefront"],
              collectionHandles: ["all"],
              cartPath: "/cart",
              checkoutPath: "/checkout"
            },
            routes: [
              {
                kind: "homepage",
                url: "https://example.com/",
                title: "Example Storefront",
                referenceHost: "example.com",
                headingOutline: ["Example Storefront"],
                navigationLinks: [{ label: "Shop", href: "https://example.com/collections/all" }],
                primaryCtas: [{ label: "Buy now", href: "https://example.com/products/example-storefront" }],
                imageAssets: [{ src: "https://example.com/cdn/hero.jpg", alt: "Example Storefront hero" }],
                styleTokens: {
                  dominantColors: ["rgb(255, 255, 255)", "rgb(17, 24, 39)"],
                  fontFamilies: ["Inter", "Georgia"]
                },
                captureBundlePath: "/tmp/captures/job_123/home/capture-bundle.json",
                desktopScreenshotPath: "/tmp/captures/job_123/home/desktop.jpg",
                mobileScreenshotPath: "/tmp/captures/job_123/home/mobile.jpg"
              }
            ]
          };
        }
      },
      storefrontModelBuilder: {
        async build() {
          return {
            modeledAt: "2026-03-20T12:00:45.000Z",
            referenceHost: "example.com",
            storeTitle: "Example Storefront",
            summary: "Built storefront model with 3 pages, 1 products, 1 collections, and 1 menus.",
            styleTokens: {
              dominantColors: ["rgb(255, 255, 255)", "rgb(17, 24, 39)"],
              fontFamilies: ["Inter", "Georgia"]
            },
            pages: [
              { kind: "homepage", url: "https://example.com/", title: "Example Storefront" },
              { kind: "collection_page", url: "https://example.com/collections/all", title: "All", handle: "all" },
              { kind: "product_page", url: "https://example.com/products/example-storefront", title: "Example Storefront", handle: "example-storefront" }
            ],
            products: [
              {
                handle: "example-storefront",
                title: "Example Storefront",
                merchandisingRole: "Primary offer for the generated storefront."
              }
            ],
            collections: [
              {
                handle: "all",
                title: "All",
                rule: "Manual collection for generated review.",
                featuredProductHandles: ["example-storefront"]
              }
            ],
            menus: [
              {
                handle: "main-menu",
                title: "Main menu",
                items: [{ title: "Shop", target: "/collections/all" }]
              }
            ],
            contentModels: [],
            unsupportedFeatures: []
          } satisfies StorefrontModel;
        }
      },
      analyzer: {
        async analyze() {
          return {
            sourceUrl: "https://example.com",
            referenceHost: "example.com",
            pageType: "landing_page",
            title: "Example Storefront",
            summary: "Prepared deterministic landing page analysis for Example Storefront.",
            analyzedAt: "2026-03-20T12:01:00.000Z",
            recommendedSections: ["hero", "rich_text", "cta"]
          } satisfies ReferenceAnalysis;
        }
      },
      mapper: {
        async map() {
          return {
            sourceUrl: "https://example.com",
            title: "Example Storefront",
            summary: "Mapped Example Storefront into the stable generated landing template.",
            mappedAt: "2026-03-20T12:02:00.000Z",
            templatePath: "templates/page.generated-reference.json",
            sectionPath: "sections/generated-reference.liquid",
            sections: [
              {
                id: "hero-1",
                type: "hero",
                heading: "Example Storefront",
                body: "Landing copy"
              }
            ]
          } satisfies ThemeMapping;
        }
      },
      generator: {
        async generate() {
          return {
            artifacts: [
              {
                kind: "section",
                path: "sections/generated-reference.liquid",
                status: "generated",
                description: "Primary generated landing section output",
                lastWrittenAt: "2026-03-20T12:03:00.000Z"
              },
              {
                kind: "template",
                path: "templates/page.generated-reference.json",
                status: "generated",
                description: "Generated JSON template that references the stable landing section",
                lastWrittenAt: "2026-03-20T12:03:00.000Z"
              }
            ],
            generation: {
              generatedAt: "2026-03-20T12:03:00.000Z",
              templatePath: "templates/page.generated-reference.json",
              sectionPath: "sections/generated-reference.liquid"
            }
          };
        }
      },
      assetSyncService: {
        async sync() {
          return {
            syncedAt: "2026-03-20T12:03:15.000Z",
            summary: "Synced 1 theme assets from the source storefront.",
            assets: [
              {
                sourceUrl: "https://example.com/cdn/hero.jpg",
                themePath: "assets/replicator-hero.jpg",
                status: "synced"
              }
            ]
          } satisfies AssetSyncResult;
        }
      },
      storeSetupGenerator: {
        async generate() {
          return {
            artifact: {
              kind: "config",
              path: "config/generated-store-setup.json",
              status: "generated",
              description: "Import-ready store setup bundle covering products, collections, menus, and structured content",
              lastWrittenAt: "2026-03-20T12:04:00.000Z"
            },
            storeSetup: {
              plannedAt: "2026-03-20T12:04:00.000Z",
              configPath: "config/generated-store-setup.json",
              importBundlePath: "config/generated-store-setup.json",
              summary: "Prepared import-ready store setup bundle for Example Storefront.",
              products: [
                {
                  handle: "example-storefront",
                  title: "Example Storefront",
                  merchandisingRole: "Primary offer for the generated storefront."
                }
              ],
              collections: [],
              menus: [],
              contentModels: []
            } satisfies StoreSetupPlan
          };
        }
      },
      commerceGenerator: {
        async generate() {
          return {
            artifact: {
              kind: "snippet",
              path: "snippets/generated-commerce-wiring.liquid",
              status: "generated",
              description: "Deterministic commerce wiring snippet covering cart entrypoints and native checkout handoff",
              lastWrittenAt: "2026-03-20T12:05:00.000Z"
            },
            commerce: {
              plannedAt: "2026-03-20T12:05:00.000Z",
              snippetPath: "snippets/generated-commerce-wiring.liquid",
              summary: "Prepared deterministic commerce wiring plan for Example Storefront with native Shopify cart and checkout handoff.",
              cartPath: "/cart",
              checkoutPath: "/checkout",
              entrypoints: [
                {
                  label: "Primary CTA",
                  target: "/products/example-storefront",
                  behavior: "Directs the operator to the primary product path before add-to-cart."
                }
              ],
              qaChecklist: ["Verify native checkout handoff."]
            } satisfies CommerceWiringPlan
          };
        }
      },
      adminReplicationService: {
        async replicate() {
          return {
            replicatedAt: "2026-03-20T12:05:30.000Z",
            destinationStoreId: "local-dev-store",
            shopDomain: "local-dev-store.myshopify.com",
            themeId: "gid://shopify/OnlineStoreTheme/123456789",
            themeName: "Replicator job_123",
            previewUrl: "https://local-dev-store.myshopify.com?preview_theme_id=123456789",
            summary: "Replicated generated storefront to destination theme Replicator job_123.",
            createdResources: [
              {
                kind: "theme",
                id: "gid://shopify/OnlineStoreTheme/123456789",
                handle: "Replicator job_123",
                action: "created"
              }
            ],
            updatedResources: [],
            warnings: [],
            rollbackManifest: {
              generatedAt: "2026-03-20T12:05:30.000Z",
              resources: [
                {
                  kind: "theme",
                  id: "gid://shopify/OnlineStoreTheme/123456789",
                  handle: "Replicator job_123"
                }
              ]
            }
          } satisfies AdminReplicationResult;
        },
        async rollback() {
          return;
        }
      },
      themeValidator: {
        async validate() {
          return {
            status: "passed",
            summary: "Final theme validation passed.",
            checkedAt: "2026-03-20T12:06:00.000Z",
            output: "No issues detected."
          } satisfies ThemeCheckResult;
        }
      },
      integrationGenerator: {
        async generate({ validation, adminReplication, parityAudit }) {
          expect(validation).toMatchObject({
            status: "passed",
            summary: "Final theme validation passed."
          });
          expect(adminReplication.previewUrl).toContain("preview_theme_id=123456789");
          expect(parityAudit.status).toBe("passed");

          return {
            artifact: {
              kind: "config",
              path: "config/generated-integration-report.json",
              status: "generated",
              description: "Deterministic integration report covering theme, store setup, and commerce consistency",
              lastWrittenAt: "2026-03-20T12:07:00.000Z"
            },
            integration: {
              checkedAt: "2026-03-20T12:07:00.000Z",
              reportPath: "config/generated-integration-report.json",
              status: "passed",
              summary: "All deterministic integration checks passed for Example Storefront.",
              checks: [
                {
                  id: "generated_artifacts",
                  status: "passed",
                  details: "Theme, store setup, and commerce artifacts are all generated."
                }
              ]
            }
          };
        }
      },
      parityAuditor: {
        async audit() {
          return {
            checkedAt: "2026-03-20T12:06:30.000Z",
            status: "passed",
            summary: "Parity audit completed for 1 routes.",
            routes: [
              {
                kind: "homepage",
                url: "https://example.com/",
                previewUrl: "https://local-dev-store.myshopify.com?preview_theme_id=123456789",
                status: "matched",
                visualSimilarity: 0.96,
                sourceTitle: "Example Storefront",
                destinationTitle: "Example Storefront",
                notes: []
              }
            ],
            warnings: []
          } satisfies ParityAudit;
        }
      }
    });

    const handoff = await orchestrator.replicateStorefront({
      referenceUrl: "https://example.com",
      destinationStore: "local-dev-store",
      notes: "Hero-first landing page"
    });

    expect(handoff.runtime).toEqual({
      themeWorkspacePath: "/tmp/theme-workspace",
      captureRootPath: "/tmp/captures",
      previewCommand: "shopify theme dev",
      destinationStores: [
        {
          id: "local-dev-store",
          label: "Local Dev Store",
          shopDomain: "local-dev-store.myshopify.com"
        }
      ]
    });
    expect(handoff.job).toMatchObject({
      status: "needs_review",
      currentStage: "review",
      intake: {
        destinationStore: "local-dev-store"
      },
      sourceQualification: {
        status: "supported",
        platform: "shopify"
      },
      capture: {
        title: "Example Storefront",
        referenceHost: "example.com"
      },
      routeInventory: {
        referenceHost: "example.com"
      },
      storefrontModel: {
        storeTitle: "Example Storefront"
      },
      assetSync: {
        assets: [
          expect.objectContaining({
            themePath: "assets/replicator-hero.jpg"
          })
        ]
      },
      adminReplication: {
        previewUrl: "https://local-dev-store.myshopify.com?preview_theme_id=123456789"
      },
      parityAudit: {
        status: "passed"
      },
      validation: {
        status: "passed",
        summary: "Final theme validation passed."
      },
      integration: {
        status: "passed",
        summary: "All deterministic integration checks passed for Example Storefront."
      }
    });
    expect(handoff.job.stages.map((stage) => stage.name)).toEqual([
      "intake",
      "source_qualification",
      "route_inventory",
      "capture",
      "storefront_model",
      "analysis",
      "mapping",
      "theme_generation",
      "asset_sync",
      "store_setup",
      "commerce_wiring",
      "admin_replication",
      "validation",
      "parity_audit",
      "integration_check",
      "review"
    ]);
    expect(handoff.job.stages.find((stage) => stage.name === "validation")).toMatchObject({
      status: "complete",
      summary: "Final theme validation passed."
    });
    expect(handoff.nextActions).toEqual([
      "Review the generated artifacts in the theme workspace.",
      "Open the unpublished destination theme preview and verify route parity, content wiring, and cart-to-checkout handoff.",
      "Resolve any failed validation or integration checks before publish."
    ]);
    await expect(orchestrator.getJob(handoff.job.id)).resolves.toMatchObject({
      id: handoff.job.id
    });
    await expect(orchestrator.listRecentJobs(1)).resolves.toEqual([
      expect.objectContaining({
        jobId: handoff.job.id
      })
    ]);
    expect(orchestrator.listDestinationStores()).toEqual([
      {
        id: "local-dev-store",
        label: "Local Dev Store",
        shopDomain: "local-dev-store.myshopify.com",
        adminTokenEnvVar: "SHOPIFY_LOCAL_DEV_TOKEN"
      }
    ]);
  });
});
