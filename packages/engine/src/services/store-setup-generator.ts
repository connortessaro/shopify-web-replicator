import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  pageTypeLabels,
  stableStoreSetupArtifact,
  type GeneratedThemeArtifact,
  type ReferenceAnalysis,
  type StoreSetupCollectionPlan,
  type StoreSetupContentModelPlan,
  type StoreSetupMenuPlan,
  type StoreSetupPlan,
  type StoreSetupProductPlan
} from "@shopify-web-replicator/shared";

type GenerateInput = {
  analysis: ReferenceAnalysis;
};

type StoreSetupGenerationResult = {
  artifact: GeneratedThemeArtifact;
  storeSetup: StoreSetupPlan;
};

function toHandle(value: string): string | undefined {
  const handle = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return handle || undefined;
}

function buildProducts(analysis: ReferenceAnalysis): StoreSetupProductPlan[] {
  const primaryHandle = toHandle(analysis.title) || toHandle(analysis.referenceHost) || "generated-reference";

  if (analysis.pageType === "homepage") {
    return [
      {
        handle: `${primaryHandle}-feature-1`,
        title: `${analysis.title} Feature One`,
        merchandisingRole: "Featured product for the generated homepage hero and CTA flow."
      },
      {
        handle: `${primaryHandle}-feature-2`,
        title: `${analysis.title} Feature Two`,
        merchandisingRole: "Secondary merchandising slot for homepage browsing and collection previews."
      }
    ];
  }

  if (analysis.pageType === "collection_page") {
    return [
      {
        handle: `${primaryHandle}-item-1`,
        title: `${analysis.title} Item One`,
        merchandisingRole: "Primary collection card for validating generated collection merchandising."
      },
      {
        handle: `${primaryHandle}-item-2`,
        title: `${analysis.title} Item Two`,
        merchandisingRole: "Supporting collection card for validating product density and browsing flow."
      },
      {
        handle: `${primaryHandle}-item-3`,
        title: `${analysis.title} Item Three`,
        merchandisingRole: "Additional collection card for deterministic merchandising coverage."
      }
    ];
  }

  return [
    {
      handle: primaryHandle,
      title: analysis.title,
      merchandisingRole:
        analysis.pageType === "product_page"
          ? "Primary offer for the generated product detail and add-to-cart flow."
          : "Primary offer for the generated storefront."
    }
  ];
}

function buildCollections(
  analysis: ReferenceAnalysis,
  products: StoreSetupProductPlan[]
): StoreSetupCollectionPlan[] {
  const baseHandle = toHandle(analysis.title) || toHandle(analysis.referenceHost) || "generated-reference";
  const featuredProductHandles = products.map((product) => product.handle);

  return [
    {
      handle: `${baseHandle}-featured`,
      title: `${analysis.title} Featured`,
      rule:
        analysis.pageType === "collection_page"
          ? "Primary collection for validating generated collection layout and browsing flow."
          : "Manual collection for the generated storefront review flow.",
      featuredProductHandles
    }
  ];
}

function buildMenus(
  analysis: ReferenceAnalysis,
  collections: StoreSetupCollectionPlan[],
  products: StoreSetupProductPlan[]
): StoreSetupMenuPlan[] {
  const featuredCollection = collections[0];
  const primaryProduct = products[0];
  const homeTarget = "/";

  return [
    {
      handle: "main-menu",
      title: "Main menu",
      items: [
        {
          title: "Home",
          target: homeTarget
        },
        {
          title: "Shop",
          target: featuredCollection ? `/collections/${featuredCollection.handle}` : "/collections/all"
        },
        {
          title: "Featured",
          target: primaryProduct ? `/products/${primaryProduct.handle}` : "/pages/generated-reference"
        }
      ]
    },
    {
      handle: "footer-menu",
      title: "Footer menu",
      items: [
        {
          title: "About",
          target: "/pages/about"
        },
        {
          title: "Contact",
          target: "/pages/contact"
        }
      ]
    }
  ];
}

function buildContentModels(analysis: ReferenceAnalysis): StoreSetupContentModelPlan[] {
  if (analysis.pageType === "product_page") {
    return [
      {
        name: "feature_callout",
        type: "metaobject",
        fields: ["eyebrow", "heading", "body"]
      },
      {
        name: "product_highlights",
        type: "metafield_definition",
        fields: ["icon", "label", "value"]
      }
    ];
  }

  if (analysis.pageType === "collection_page") {
    return [
      {
        name: "feature_callout",
        type: "metaobject",
        fields: ["eyebrow", "heading", "body"]
      },
      {
        name: "collection_story",
        type: "metafield_definition",
        fields: ["headline", "body", "media"]
      }
    ];
  }

  return [
    {
      name: "feature_callout",
      type: "metaobject",
      fields: ["eyebrow", "heading", "body"]
    },
    {
      name: analysis.pageType === "homepage" ? "homepage_story" : "landing_story",
      type: "metafield_definition",
      fields: ["headline", "body", "media"]
    }
  ];
}

function createStoreSetupPlan(analysis: ReferenceAnalysis): StoreSetupPlan {
  const products = buildProducts(analysis);
  const collections = buildCollections(analysis, products);
  const menus = buildMenus(analysis, collections, products);
  const contentModels = buildContentModels(analysis);

  return {
    plannedAt: new Date().toISOString(),
    configPath: stableStoreSetupArtifact.path,
    summary: `Prepared deterministic store setup plan for ${analysis.title} covering products, collections, menus, and structured content for the ${pageTypeLabels[analysis.pageType]}.`,
    products,
    collections,
    menus,
    contentModels
  };
}

export class ShopifyStoreSetupGenerator {
  readonly #themeWorkspacePath: string;

  constructor(themeWorkspacePath: string) {
    this.#themeWorkspacePath = themeWorkspacePath;
  }

  async generate({ analysis }: GenerateInput): Promise<StoreSetupGenerationResult> {
    const storeSetup = createStoreSetupPlan(analysis);
    const outputPath = join(this.#themeWorkspacePath, stableStoreSetupArtifact.path);

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(
      outputPath,
      `${JSON.stringify(
        {
          generatedBy: "Shopify Web Replicator",
          sourceUrl: analysis.sourceUrl,
          pageType: analysis.pageType,
          title: analysis.title,
          storeSetup
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    return {
      artifact: {
        kind: "config",
        path: stableStoreSetupArtifact.path,
        status: "generated",
        description: stableStoreSetupArtifact.description,
        lastWrittenAt: storeSetup.plannedAt
      },
      storeSetup
    };
  }
}
