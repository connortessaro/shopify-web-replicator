import { describe, expect, it } from "vitest";

import type {
  CommerceWiringPlan,
  ReferenceAnalysis,
  StoreSetupPlan,
  ThemeCheckResult,
  ThemeMapping
} from "@shopify-web-replicator/shared";

import { InMemoryJobRepository, createReplicationOrchestrator } from "./index";

describe("createReplicationOrchestrator", () => {
  it("replicates a storefront to a terminal handoff with final validation and next actions", async () => {
    const repository = new InMemoryJobRepository();
    const orchestrator = createReplicationOrchestrator({
      repository,
      runtime: {
        themeWorkspacePath: "/tmp/theme-workspace",
        previewCommand: "shopify theme dev"
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
      storeSetupGenerator: {
        async generate() {
          return {
            artifact: {
              kind: "config",
              path: "config/generated-store-setup.json",
              status: "generated",
              description: "Deterministic store setup plan covering products, collections, menus, and structured content",
              lastWrittenAt: "2026-03-20T12:04:00.000Z"
            },
            storeSetup: {
              plannedAt: "2026-03-20T12:04:00.000Z",
              configPath: "config/generated-store-setup.json",
              summary: "Prepared deterministic store setup plan for Example Storefront.",
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
        async generate({ validation }) {
          expect(validation).toMatchObject({
            status: "passed",
            summary: "Final theme validation passed."
          });

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
      }
    });

    const handoff = await orchestrator.replicateStorefront({
      referenceUrl: "https://example.com",
      notes: "Hero-first landing page"
    });

    expect(handoff.runtime).toEqual({
      themeWorkspacePath: "/tmp/theme-workspace",
      previewCommand: "shopify theme dev"
    });
    expect(handoff.job).toMatchObject({
      status: "needs_review",
      currentStage: "review",
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
      "analysis",
      "mapping",
      "theme_generation",
      "store_setup",
      "commerce_wiring",
      "validation",
      "integration_check",
      "review"
    ]);
    expect(handoff.job.stages.find((stage) => stage.name === "validation")).toMatchObject({
      status: "complete",
      summary: "Final theme validation passed."
    });
    expect(handoff.nextActions).toEqual([
      "Review the generated artifacts in the theme workspace.",
      "Run the preview command and verify layout, content wiring, and cart-to-checkout handoff.",
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
  });
});
