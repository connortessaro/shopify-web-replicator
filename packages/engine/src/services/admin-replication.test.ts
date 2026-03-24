import { describe, expect, it, vi } from "vitest";

import { ShopifyAdminReplicationService } from "./admin-replication.js";

describe("ShopifyAdminReplicationService", () => {
  it("duplicates a destination theme, uploads files, upserts store resources, and builds a rollback manifest", async () => {
    process.env.SHOPIFY_TEST_ADMIN_TOKEN = "test-token";

    const service = new ShopifyAdminReplicationService({
      workspaceReader: {
        async listFiles() {
          return [
            { path: "sections/generated-reference.liquid", bodyType: "text", value: "<section>Example</section>" },
            { path: "templates/page.generated-reference.json", bodyType: "text", value: "{\"sections\":{},\"order\":[]}" }
          ];
        }
      },
      clientFactory: () => ({
        async ensureReplicationTheme() {
          return {
            themeId: "gid://shopify/OnlineStoreTheme/123456789",
            themeName: "Replicator job_123",
            action: "created"
          };
        },
        async upsertThemeFiles() {
          return;
        },
        async upsertProduct(product) {
          return { kind: "product", id: "gid://shopify/Product/1", handle: product.handle, action: "created" };
        },
        async upsertCollection(collection) {
          return {
            kind: "collection",
            id: "gid://shopify/Collection/2",
            handle: collection.handle,
            action: "created"
          };
        },
        async upsertMenu(menu) {
          return { kind: "menu", id: "gid://shopify/Menu/3", handle: menu.handle, action: "updated" };
        },
        async upsertPage(page) {
          return { kind: "page", id: "gid://shopify/Page/4", handle: page.handle, action: "created" };
        },
        async ensureContentModel(model) {
          return {
            kind: model.type === "metaobject" ? "metaobject_definition" : "metafield_definition",
            id: "gid://shopify/MetaobjectDefinition/5",
            handle: model.name,
            action: "created"
          };
        }
      }),
      lockManager: {
        acquire: vi.fn().mockResolvedValue(undefined),
        release: vi.fn().mockResolvedValue(undefined)
      }
    });

    const result = await service.replicate({
      jobId: "job_123",
      destinationStore: {
        id: "local-dev-store",
        label: "Local Dev Store",
        shopDomain: "local-dev-store.myshopify.com",
        themeNamePrefix: "Replicator",
        adminTokenEnvVar: "SHOPIFY_TEST_ADMIN_TOKEN"
      },
      storefrontModel: {
        modeledAt: "2026-03-21T18:01:00.000Z",
        referenceHost: "example.com",
        storeTitle: "Example Store",
        summary: "Built storefront model.",
        styleTokens: {
          dominantColors: ["rgb(255, 255, 255)"],
          fontFamilies: ["Inter"]
        },
        pages: [
          { kind: "content_page", url: "https://example.com/pages/about", handle: "about", title: "About" }
        ],
        products: [
          {
            handle: "trail-pack",
            title: "Trail Pack",
            merchandisingRole: "Primary offer for the generated storefront."
          }
        ],
        collections: [
          {
            handle: "shop",
            title: "Shop",
            rule: "Manual collection for generated review.",
            featuredProductHandles: ["trail-pack"]
          }
        ],
        menus: [
          {
            handle: "main-menu",
            title: "Main menu",
            items: [{ title: "Shop", target: "/collections/shop" }]
          }
        ],
        contentModels: [
          {
            name: "feature_callout",
            type: "metaobject",
            fields: ["heading", "body"]
          }
        ],
        unsupportedFeatures: []
      }
    });

    expect(result.previewUrl).toBe("https://local-dev-store.myshopify.com?preview_theme_id=123456789");
    expect(result.createdResources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "theme", action: "created" }),
        expect.objectContaining({ kind: "product", handle: "trail-pack", action: "created" }),
        expect.objectContaining({ kind: "collection", handle: "shop", action: "created" }),
        expect.objectContaining({ kind: "page", handle: "about", action: "created" })
      ])
    );
    expect(result.updatedResources).toEqual([
      expect.objectContaining({ kind: "menu", handle: "main-menu", action: "updated" })
    ]);
    expect(result.rollbackManifest.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "theme", id: "gid://shopify/OnlineStoreTheme/123456789" }),
        expect.objectContaining({ kind: "product", id: "gid://shopify/Product/1" })
      ])
    );
  });
});
