import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type {
  CommerceWiringPlan,
  ReferenceAnalysis,
  StoreSetupPlan,
  ThemeMapping
} from "@shopify-web-replicator/shared";

import { ShopifyIntegrationReportGenerator } from "./integration-report-generator";

describe("ShopifyIntegrationReportGenerator", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
    tempDirectories.length = 0;
  });

  it("writes a deterministic integration report when theme, store setup, and commerce artifacts line up", async () => {
    const themeRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-theme-"));
    tempDirectories.push(themeRoot);

    await mkdir(join(themeRoot, "sections"), { recursive: true });
    await mkdir(join(themeRoot, "templates"), { recursive: true });
    await mkdir(join(themeRoot, "config"), { recursive: true });
    await mkdir(join(themeRoot, "snippets"), { recursive: true });
    await writeFile(
      join(themeRoot, "sections/generated-reference.liquid"),
      `{% render 'generated-commerce-wiring', page_type: 'landing_page' %}\n`,
      "utf8"
    );
    await writeFile(join(themeRoot, "templates/page.generated-reference.json"), "{\n  \"sections\": {}\n}\n", "utf8");
    await writeFile(join(themeRoot, "config/generated-store-setup.json"), "{\n  \"storeSetup\": true\n}\n", "utf8");
    await writeFile(
      join(themeRoot, "snippets/generated-commerce-wiring.liquid"),
      "<div data-checkout-url=\"/checkout\"></div>\n",
      "utf8"
    );

    const generator = new ShopifyIntegrationReportGenerator(themeRoot);
    const analysis: ReferenceAnalysis = {
      sourceUrl: "https://example.com",
      referenceHost: "example.com",
      pageType: "landing_page",
      title: "Example Storefront",
      summary: "Prepared deterministic landing page analysis for Example Storefront.",
      analyzedAt: "2026-03-20T12:00:00.000Z",
      recommendedSections: ["hero", "rich_text", "cta"]
    };
    const mapping: ThemeMapping = {
      sourceUrl: "https://example.com",
      title: "Example Storefront",
      summary: "Mapped Example Storefront into the stable generated landing template.",
      mappedAt: "2026-03-20T12:01:00.000Z",
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
    };
    const storeSetup: StoreSetupPlan = {
      plannedAt: "2026-03-20T12:02:00.000Z",
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
      collections: [
        {
          handle: "example-storefront-featured",
          title: "Example Storefront Featured",
          rule: "Manual collection for the generated storefront review flow.",
          featuredProductHandles: ["example-storefront"]
        }
      ],
      menus: [],
      contentModels: []
    };
    const commerce: CommerceWiringPlan = {
      plannedAt: "2026-03-20T12:03:00.000Z",
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
      qaChecklist: ["Verify native cart and checkout handoff."]
    };

    const result = await generator.generate({
      analysis,
      mapping,
      generation: {
        generatedAt: "2026-03-20T12:01:00.000Z",
        templatePath: "templates/page.generated-reference.json",
        sectionPath: "sections/generated-reference.liquid"
      },
      storeSetup,
      commerce,
      artifacts: [
        {
          kind: "section",
          path: "sections/generated-reference.liquid",
          status: "generated",
          description: "Primary generated landing section output"
        },
        {
          kind: "template",
          path: "templates/page.generated-reference.json",
          status: "generated",
          description: "Generated JSON template that references the stable landing section"
        },
        {
          kind: "config",
          path: "config/generated-store-setup.json",
          status: "generated",
          description: "Import-ready store setup bundle covering products, collections, menus, and structured content"
        },
        {
          kind: "snippet",
          path: "snippets/generated-commerce-wiring.liquid",
          status: "generated",
          description: "Deterministic commerce wiring snippet covering cart entrypoints and native checkout handoff"
        }
      ],
      validation: {
        status: "passed",
        summary: "Theme check passed."
      }
    });

    expect(result.integration).toMatchObject({
      status: "passed",
      summary: "All deterministic integration checks passed for Example Storefront."
    });
    await expect(readFile(join(themeRoot, "config/generated-integration-report.json"), "utf8")).resolves.toContain(
      "\"generated_artifacts\""
    );
  });

  it("fails integration when the generated commerce snippet is missing on disk", async () => {
    const themeRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-theme-"));
    tempDirectories.push(themeRoot);

    await mkdir(join(themeRoot, "sections"), { recursive: true });
    await mkdir(join(themeRoot, "templates"), { recursive: true });
    await mkdir(join(themeRoot, "config"), { recursive: true });
    await writeFile(
      join(themeRoot, "sections/generated-reference.liquid"),
      `{% render 'generated-commerce-wiring', page_type: 'landing_page' %}\n`,
      "utf8"
    );
    await writeFile(join(themeRoot, "templates/page.generated-reference.json"), "{\n  \"sections\": {}\n}\n", "utf8");
    await writeFile(join(themeRoot, "config/generated-store-setup.json"), "{\n  \"storeSetup\": true\n}\n", "utf8");

    const generator = new ShopifyIntegrationReportGenerator(themeRoot);
    const analysis: ReferenceAnalysis = {
      sourceUrl: "https://example.com",
      referenceHost: "example.com",
      pageType: "landing_page",
      title: "Example Storefront",
      summary: "Prepared deterministic landing page analysis for Example Storefront.",
      analyzedAt: "2026-03-20T12:00:00.000Z",
      recommendedSections: ["hero", "rich_text", "cta"]
    };
    const mapping: ThemeMapping = {
      sourceUrl: "https://example.com",
      title: "Example Storefront",
      summary: "Mapped Example Storefront into the stable generated landing template.",
      mappedAt: "2026-03-20T12:01:00.000Z",
      templatePath: "templates/page.generated-reference.json",
      sectionPath: "sections/generated-reference.liquid",
      sections: []
    };
    const storeSetup: StoreSetupPlan = {
      plannedAt: "2026-03-20T12:02:00.000Z",
      configPath: "config/generated-store-setup.json",
      importBundlePath: "config/generated-store-setup.json",
      summary: "Prepared import-ready store setup bundle for Example Storefront.",
      products: [],
      collections: [],
      menus: [],
      contentModels: []
    };
    const commerce: CommerceWiringPlan = {
      plannedAt: "2026-03-20T12:03:00.000Z",
      snippetPath: "snippets/generated-commerce-wiring.liquid",
      summary: "Prepared deterministic commerce wiring plan for Example Storefront with native Shopify cart and checkout handoff.",
      cartPath: "/cart",
      checkoutPath: "/checkout",
      entrypoints: [
        {
          label: "Cart review",
          target: "/cart",
          behavior: "Verifies native Shopify cart to checkout handoff."
        }
      ],
      qaChecklist: []
    };

    const result = await generator.generate({
      analysis,
      mapping,
      generation: {
        generatedAt: "2026-03-20T12:01:00.000Z",
        templatePath: "templates/page.generated-reference.json",
        sectionPath: "sections/generated-reference.liquid"
      },
      storeSetup,
      commerce,
      artifacts: [
        {
          kind: "section",
          path: "sections/generated-reference.liquid",
          status: "generated",
          description: "Primary generated landing section output"
        },
        {
          kind: "template",
          path: "templates/page.generated-reference.json",
          status: "generated",
          description: "Generated JSON template that references the stable landing section"
        },
        {
          kind: "config",
          path: "config/generated-store-setup.json",
          status: "generated",
          description: "Import-ready store setup bundle covering products, collections, menus, and structured content"
        },
        {
          kind: "snippet",
          path: "snippets/generated-commerce-wiring.liquid",
          status: "generated",
          description: "Deterministic commerce wiring snippet covering cart entrypoints and native checkout handoff"
        }
      ],
      validation: {
        status: "passed",
        summary: "Theme check passed."
      }
    });

    expect(result.integration.status).toBe("failed");
    expect(result.integration.checks).toContainEqual(
      expect.objectContaining({
        id: "generated_artifacts",
        status: "failed"
      })
    );
  });
});
