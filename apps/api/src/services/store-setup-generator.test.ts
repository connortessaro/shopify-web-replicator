import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { ReferenceAnalysis, ThemeMapping } from "@shopify-web-replicator/shared";

import { ShopifyStoreSetupGenerator } from "./store-setup-generator";

describe("ShopifyStoreSetupGenerator", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
    tempDirectories.length = 0;
  });

  it("writes an import-ready store setup bundle into the stable config path", async () => {
    const themeRoot = await mkdtemp(join(tmpdir(), "shopify-web-replicator-theme-"));
    tempDirectories.push(themeRoot);

    const generator = new ShopifyStoreSetupGenerator(themeRoot);
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

    const result = await generator.generate({ analysis, mapping });

    expect(result.artifact).toEqual(
      expect.objectContaining({
        kind: "config",
        path: "config/generated-store-setup.json",
        status: "generated"
      })
    );
    expect(result.storeSetup.products).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          handle: "trail-pack",
          title: "Trail Pack"
        })
      ])
    );
    expect(result.storeSetup.collections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          handle: "trail-pack-featured"
        })
      ])
    );
    await expect(readFile(join(themeRoot, "config/generated-store-setup.json"), "utf8")).resolves.toContain(
      "\"trail-pack\""
    );
    await expect(readFile(join(themeRoot, "config/generated-store-setup.json"), "utf8")).resolves.toContain(
      "\"main-menu\""
    );
    await expect(readFile(join(themeRoot, "config/generated-store-setup.json"), "utf8")).resolves.toContain(
      "\"importBundle\""
    );
    expect((result.storeSetup as { importBundlePath?: string }).importBundlePath).toBe(
      "config/generated-store-setup.json"
    );
  });
});
