import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { ReferenceAnalysis, StoreSetupPlan, ThemeMapping } from "@shopify-web-replicator/shared";

import { ShopifyCommerceWiringGenerator } from "./commerce-wiring-generator";

describe("ShopifyCommerceWiringGenerator", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
    tempDirectories.length = 0;
  });

  it("writes a deterministic commerce wiring snippet into the stable snippet path", async () => {
    const themeRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-theme-"));
    tempDirectories.push(themeRoot);

    const generator = new ShopifyCommerceWiringGenerator(themeRoot);
    const analysis: ReferenceAnalysis = {
      sourceUrl: "https://example.com/products/trail-pack",
      referenceHost: "example.com",
      pageType: "product_page",
      title: "Trail Pack",
      summary: "Prepared deterministic product page analysis for Trail Pack.",
      analyzedAt: "2026-03-20T12:00:00.000Z",
      recommendedSections: ["product_detail", "rich_text", "cta"]
    };
    const mapping: ThemeMapping = {
      sourceUrl: "https://example.com/products/trail-pack",
      title: "Trail Pack",
      summary: "Mapped Trail Pack into the stable generated product template.",
      mappedAt: "2026-03-20T12:01:00.000Z",
      templatePath: "templates/product.generated-reference.json",
      sectionPath: "sections/generated-product-reference.liquid",
      sections: [
        {
          id: "product-detail-1",
          type: "product_detail",
          heading: "Trail Pack",
          body: "Product detail copy"
        }
      ]
    };
    const storeSetup: StoreSetupPlan = {
      plannedAt: "2026-03-20T12:02:00.000Z",
      configPath: "config/generated-store-setup.json",
      summary: "Prepared deterministic store setup plan for Trail Pack.",
      products: [
        {
          handle: "trail-pack",
          title: "Trail Pack",
          merchandisingRole: "Primary offer for the generated product detail and add-to-cart flow."
        }
      ],
      collections: [
        {
          handle: "trail-pack-featured",
          title: "Trail Pack Featured",
          rule: "Manual collection for the generated storefront review flow.",
          featuredProductHandles: ["trail-pack"]
        }
      ],
      menus: [
        {
          handle: "main-menu",
          title: "Main menu",
          items: [
            {
              title: "Shop",
              target: "/collections/trail-pack-featured"
            }
          ]
        }
      ],
      contentModels: [
        {
          name: "feature_callout",
          type: "metaobject",
          fields: ["eyebrow", "heading", "body"]
        }
      ]
    };

    const result = await generator.generate({ analysis, mapping, storeSetup });

    expect(result.artifact).toEqual(
      expect.objectContaining({
        kind: "snippet",
        path: "snippets/generated-commerce-wiring.liquid",
        status: "generated"
      })
    );
    expect(result.commerce).toMatchObject({
      cartPath: "/cart",
      checkoutPath: "/checkout"
    });
    await expect(readFile(join(themeRoot, "snippets/generated-commerce-wiring.liquid"), "utf8")).resolves.toContain(
      "trail-pack"
    );
    await expect(readFile(join(themeRoot, "snippets/generated-commerce-wiring.liquid"), "utf8")).resolves.toContain(
      "/checkout"
    );
  });
});
