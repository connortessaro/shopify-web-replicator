import { createHash } from "node:crypto";
import { mkdir, open, readFile, readdir, rm } from "node:fs/promises";
import { join, relative } from "node:path";

import type {
  AdminReplicationResult,
  DestinationStoreProfile,
  ReplicatedResource,
  StoreSetupCollectionPlan,
  StoreSetupContentModelPlan,
  StoreSetupMenuPlan,
  StoreSetupProductPlan,
  StorefrontModel
} from "@shopify-web-replicator/shared";

type ThemeWorkspaceFile = {
  path: string;
  bodyType: "TEXT" | "BASE64";
  value: string;
};

type ResourceMutationResult = ReplicatedResource;

type ShopifyAdminReplicationClient = {
  ensureReplicationTheme(input: {
    themeName: string;
    baseThemeId?: string;
    baseThemeRole?: string;
  }): Promise<{ themeId: string; themeName: string; action: "created" | "updated" }>;
  upsertThemeFiles(themeId: string, files: ThemeWorkspaceFile[]): Promise<void>;
  upsertProduct(product: StoreSetupProductPlan): Promise<ResourceMutationResult>;
  upsertCollection(
    collection: StoreSetupCollectionPlan,
    productIds: string[]
  ): Promise<ResourceMutationResult>;
  upsertMenu(menu: StoreSetupMenuPlan): Promise<ResourceMutationResult>;
  upsertPage(page: { handle: string; title: string; body: string }): Promise<ResourceMutationResult>;
  ensureContentModel(model: StoreSetupContentModelPlan): Promise<ResourceMutationResult>;
  rollback(resources: Array<{ kind: string; id: string }>): Promise<void>;
};

type DestinationLockManager = {
  acquire(destinationStoreId: string): Promise<void>;
  release(destinationStoreId: string): Promise<void>;
};

type ThemeWorkspaceReader = {
  listFiles(root: string): Promise<ThemeWorkspaceFile[]>;
};

type ShopifyAdminReplicationServiceOptions = {
  workspaceReader?: ThemeWorkspaceReader;
  clientFactory?: (input: {
    destinationStore: DestinationStoreProfile;
    token: string;
  }) => ShopifyAdminReplicationClient;
  lockManager?: DestinationLockManager;
};

type ReplicationInput = {
  jobId: string;
  destinationStore: DestinationStoreProfile;
  storefrontModel: StorefrontModel;
  themeWorkspacePath?: string;
};

function slugToTitle(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((segment) => `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`)
    .join(" ");
}

function themeIdToPreviewId(themeId: string): string {
  return themeId.split("/").at(-1) ?? themeId;
}

function inferTextFile(path: string): boolean {
  return /\.(liquid|json|js|ts|tsx|css|scss|txt|md|svg)$/i.test(path);
}

async function walkFiles(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => entry.name !== ".DS_Store")
      .map(async (entry) => {
        const fullPath = join(current, entry.name);
        return entry.isDirectory() ? walkFiles(root, fullPath) : [relative(root, fullPath)];
      })
  );

  return nested.flat().sort();
}

class ThemeWorkspaceReaderImpl implements ThemeWorkspaceReader {
  async listFiles(root: string): Promise<ThemeWorkspaceFile[]> {
    const files = await walkFiles(root);

    return Promise.all(
      files.map(async (path) => {
        const bytes = await readFile(join(root, path));
        return inferTextFile(path)
          ? {
              path,
              bodyType: "TEXT" as const,
              value: bytes.toString("utf8")
            }
          : {
              path,
              bodyType: "BASE64" as const,
              value: Buffer.from(bytes).toString("base64")
            };
      })
    );
  }
}

class FileDestinationLockManager implements DestinationLockManager {
  readonly #rootPath: string;

  constructor(rootPath = join(process.cwd(), ".data/locks")) {
    this.#rootPath = rootPath;
  }

  async acquire(destinationStoreId: string): Promise<void> {
    await mkdir(this.#rootPath, { recursive: true });
    const lockFile = join(this.#rootPath, `${destinationStoreId}.lock`);
    const handle = await open(lockFile, "wx");
    await handle.close();
  }

  async release(destinationStoreId: string): Promise<void> {
    await rm(join(this.#rootPath, `${destinationStoreId}.lock`), { force: true });
  }
}

class ShopifyAdminGraphqlClient implements ShopifyAdminReplicationClient {
  readonly #shopDomain: string;
  readonly #token: string;
  readonly #apiVersion: string;

  constructor(destinationStore: DestinationStoreProfile, token: string) {
    this.#shopDomain = destinationStore.shopDomain;
    this.#token = token;
    this.#apiVersion = destinationStore.apiVersion ?? "2025-10";
  }

  async #graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const response = await fetch(`https://${this.#shopDomain}/admin/api/${this.#apiVersion}/graphql.json`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-shopify-access-token": this.#token
      },
      body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
      throw new Error(`Shopify Admin request failed with ${response.status}.`);
    }

    const payload = (await response.json()) as {
      data?: T;
      errors?: Array<{ message?: string }>;
    };

    if (payload.errors?.length) {
      throw new Error(payload.errors.map((error) => error.message).filter(Boolean).join("; "));
    }

    if (!payload.data) {
      throw new Error("Shopify Admin request returned no data.");
    }

    return payload.data;
  }

  #assertUserErrors(errors: Array<{ message: string }> | undefined, label: string): void {
    if (!errors?.length) {
      return;
    }

    throw new Error(`${label} failed: ${errors.map((error) => error.message).join("; ")}`);
  }

  async ensureReplicationTheme(input: {
    themeName: string;
    baseThemeId?: string;
    baseThemeRole?: string;
  }): Promise<{ themeId: string; themeName: string; action: "created" | "updated" }> {
    const existing = await this.#graphql<{
      themes: { nodes: Array<{ id: string; name: string }> };
    }>(
      `query ExistingTheme($names: [String!]) {
        themes(names: $names, first: 1) {
          nodes {
            id
            name
          }
        }
      }`,
      { names: [input.themeName] }
    );

    if (existing.themes.nodes[0]) {
      return {
        themeId: existing.themes.nodes[0].id,
        themeName: existing.themes.nodes[0].name,
        action: "updated"
      };
    }

    const baseThemeId =
      input.baseThemeId ??
      (
        await this.#graphql<{
          themes: { nodes: Array<{ id: string }> };
        }>(
          `query BaseTheme($roles: [ThemeRole!]) {
            themes(roles: $roles, first: 1) {
              nodes {
                id
              }
            }
          }`,
          { roles: [input.baseThemeRole ?? "MAIN"] }
        )
      ).themes.nodes[0]?.id;

    if (!baseThemeId) {
      throw new Error("Could not resolve a base theme to duplicate.");
    }

    const created = await this.#graphql<{
      themeDuplicate: {
        newTheme?: { id: string; name: string };
        userErrors: Array<{ message: string }>;
      };
    }>(
      `mutation DuplicateTheme($id: ID!, $name: String) {
        themeDuplicate(id: $id, name: $name) {
          newTheme {
            id
            name
          }
          userErrors {
            message
          }
        }
      }`,
      {
        id: baseThemeId,
        name: input.themeName
      }
    );
    this.#assertUserErrors(created.themeDuplicate.userErrors, "themeDuplicate");

    if (!created.themeDuplicate.newTheme) {
      throw new Error("Theme duplication did not return a theme.");
    }

    return {
      themeId: created.themeDuplicate.newTheme.id,
      themeName: created.themeDuplicate.newTheme.name,
      action: "created"
    };
  }

  async upsertThemeFiles(themeId: string, files: ThemeWorkspaceFile[]): Promise<void> {
    for (let index = 0; index < files.length; index += 50) {
      const batch = files.slice(index, index + 50).map((file) => ({
        filename: file.path,
        body: {
          type: file.bodyType,
          value: file.value
        }
      }));
      const result = await this.#graphql<{
        themeFilesUpsert: {
          userErrors: Array<{ message: string }>;
        };
      }>(
        `mutation ThemeFilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
          themeFilesUpsert(themeId: $themeId, files: $files) {
            userErrors {
              message
            }
          }
        }`,
        {
          themeId,
          files: batch
        }
      );
      this.#assertUserErrors(result.themeFilesUpsert.userErrors, "themeFilesUpsert");
    }
  }

  async upsertProduct(product: StoreSetupProductPlan): Promise<ResourceMutationResult> {
    const existing = await this.#graphql<{
      products: { nodes: Array<{ id: string; handle: string }> };
    }>(
      `query ProductByHandle($query: String!) {
        products(first: 1, query: $query) {
          nodes {
            id
            handle
          }
        }
      }`,
      { query: `handle:${product.handle}` }
    );

    if (existing.products.nodes[0]) {
      const updated = await this.#graphql<{
        productUpdate: {
          product?: { id: string; handle: string };
          userErrors: Array<{ message: string }>;
        };
      }>(
        `mutation UpdateProduct($product: ProductUpdateInput!) {
          productUpdate(product: $product) {
            product {
              id
              handle
            }
            userErrors {
              message
            }
          }
        }`,
        {
          product: {
            id: existing.products.nodes[0].id,
            title: product.title,
            handle: product.handle,
            status: "DRAFT",
            templateSuffix: "generated-reference"
          }
        }
      );
      this.#assertUserErrors(updated.productUpdate.userErrors, "productUpdate");
      return {
        kind: "product",
        id: updated.productUpdate.product?.id ?? existing.products.nodes[0].id,
        handle: product.handle,
        action: "updated"
      };
    }

    const created = await this.#graphql<{
      productCreate: {
        product?: { id: string; handle: string };
        userErrors: Array<{ message: string }>;
      };
    }>(
      `mutation CreateProduct($product: ProductCreateInput) {
        productCreate(product: $product) {
          product {
            id
            handle
          }
          userErrors {
            message
          }
        }
      }`,
      {
        product: {
          title: product.title,
          handle: product.handle,
          status: "DRAFT",
          templateSuffix: "generated-reference"
        }
      }
    );
    this.#assertUserErrors(created.productCreate.userErrors, "productCreate");

    if (!created.productCreate.product) {
      throw new Error("productCreate returned no product.");
    }

    return {
      kind: "product",
      id: created.productCreate.product.id,
      handle: product.handle,
      action: "created"
    };
  }

  async upsertCollection(collection: StoreSetupCollectionPlan, productIds: string[]): Promise<ResourceMutationResult> {
    const existing = await this.#graphql<{
      collectionByIdentifier?: { id: string; handle: string };
    }>(
      `query CollectionByHandle($identifier: CollectionIdentifierInput!) {
        collectionByIdentifier(identifier: $identifier) {
          id
          handle
        }
      }`,
      {
        identifier: {
          handle: collection.handle
        }
      }
    );

    if (existing.collectionByIdentifier) {
      const updated = await this.#graphql<{
        collectionUpdate: {
          collection?: { id: string; handle: string };
          userErrors: Array<{ message: string }>;
        };
      }>(
        `mutation UpdateCollection($input: CollectionInput!) {
          collectionUpdate(input: $input) {
            collection {
              id
              handle
            }
            userErrors {
              message
            }
          }
        }`,
        {
          input: {
            id: existing.collectionByIdentifier.id,
            title: collection.title,
            handle: collection.handle,
            templateSuffix: "generated-reference"
          }
        }
      );
      this.#assertUserErrors(updated.collectionUpdate.userErrors, "collectionUpdate");

      if (productIds.length > 0) {
        const addProducts = await this.#graphql<{
          collectionAddProducts: {
            userErrors: Array<{ message: string }>;
          };
        }>(
          `mutation AddCollectionProducts($id: ID!, $productIds: [ID!]!) {
            collectionAddProducts(id: $id, productIds: $productIds) {
              userErrors {
                message
              }
            }
          }`,
          {
            id: existing.collectionByIdentifier.id,
            productIds
          }
        );
        this.#assertUserErrors(addProducts.collectionAddProducts.userErrors, "collectionAddProducts");
      }

      return {
        kind: "collection",
        id: updated.collectionUpdate.collection?.id ?? existing.collectionByIdentifier.id,
        handle: collection.handle,
        action: "updated"
      };
    }

    const created = await this.#graphql<{
      collectionCreate: {
        collection?: { id: string; handle: string };
        userErrors: Array<{ message: string }>;
      };
    }>(
      `mutation CreateCollection($input: CollectionInput!) {
        collectionCreate(input: $input) {
          collection {
            id
            handle
          }
          userErrors {
            message
          }
        }
      }`,
      {
        input: {
          title: collection.title,
          handle: collection.handle,
          templateSuffix: "generated-reference",
          ...(productIds.length > 0 ? { products: productIds } : {})
        }
      }
    );
    this.#assertUserErrors(created.collectionCreate.userErrors, "collectionCreate");

    if (!created.collectionCreate.collection) {
      throw new Error("collectionCreate returned no collection.");
    }

    return {
      kind: "collection",
      id: created.collectionCreate.collection.id,
      handle: collection.handle,
      action: "created"
    };
  }

  async upsertMenu(menu: StoreSetupMenuPlan): Promise<ResourceMutationResult> {
    const existing = await this.#graphql<{
      menus: { nodes: Array<{ id: string; handle: string }> };
    }>(
      `query MenuByHandle($query: String!) {
        menus(first: 1, query: $query) {
          nodes {
            id
            handle
          }
        }
      }`,
      {
        query: `handle:${menu.handle}`
      }
    );

    const items = menu.items.map((item) => ({
      title: item.title,
      type: "HTTP",
      url: item.target,
      items: []
    }));

    if (existing.menus.nodes[0]) {
      const updated = await this.#graphql<{
        menuUpdate: {
          menu?: { id: string; handle: string };
          userErrors: Array<{ message: string }>;
        };
      }>(
        `mutation UpdateMenu($id: ID!, $title: String!, $handle: String, $items: [MenuItemUpdateInput!]!) {
          menuUpdate(id: $id, title: $title, handle: $handle, items: $items) {
            menu {
              id
              handle
            }
            userErrors {
              message
            }
          }
        }`,
        {
          id: existing.menus.nodes[0].id,
          title: menu.title,
          handle: menu.handle,
          items
        }
      );
      this.#assertUserErrors(updated.menuUpdate.userErrors, "menuUpdate");
      return {
        kind: "menu",
        id: updated.menuUpdate.menu?.id ?? existing.menus.nodes[0].id,
        handle: menu.handle,
        action: "updated"
      };
    }

    const created = await this.#graphql<{
      menuCreate: {
        menu?: { id: string; handle: string };
        userErrors: Array<{ message: string }>;
      };
    }>(
      `mutation CreateMenu($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) {
        menuCreate(title: $title, handle: $handle, items: $items) {
          menu {
            id
            handle
          }
          userErrors {
            message
          }
        }
      }`,
      {
        title: menu.title,
        handle: menu.handle,
        items
      }
    );
    this.#assertUserErrors(created.menuCreate.userErrors, "menuCreate");

    if (!created.menuCreate.menu) {
      throw new Error("menuCreate returned no menu.");
    }

    return {
      kind: "menu",
      id: created.menuCreate.menu.id,
      handle: menu.handle,
      action: "created"
    };
  }

  async upsertPage(page: { handle: string; title: string; body: string }): Promise<ResourceMutationResult> {
    const existing = await this.#graphql<{
      pages: { nodes: Array<{ id: string; handle: string }> };
    }>(
      `query PageByHandle($query: String!) {
        pages(first: 1, query: $query) {
          nodes {
            id
            handle
          }
        }
      }`,
      { query: `handle:${page.handle}` }
    );

    if (existing.pages.nodes[0]) {
      const updated = await this.#graphql<{
        pageUpdate: {
          page?: { id: string; handle: string };
          userErrors: Array<{ message: string }>;
        };
      }>(
        `mutation UpdatePage($id: ID!, $page: PageUpdateInput!) {
          pageUpdate(id: $id, page: $page) {
            page {
              id
              handle
            }
            userErrors {
              message
            }
          }
        }`,
        {
          id: existing.pages.nodes[0].id,
          page: {
            title: page.title,
            handle: page.handle,
            body: page.body,
            templateSuffix: "generated-reference"
          }
        }
      );
      this.#assertUserErrors(updated.pageUpdate.userErrors, "pageUpdate");
      return {
        kind: "page",
        id: updated.pageUpdate.page?.id ?? existing.pages.nodes[0].id,
        handle: page.handle,
        action: "updated"
      };
    }

    const created = await this.#graphql<{
      pageCreate: {
        page?: { id: string; handle: string };
        userErrors: Array<{ message: string }>;
      };
    }>(
      `mutation CreatePage($page: PageCreateInput!) {
        pageCreate(page: $page) {
          page {
            id
            handle
          }
          userErrors {
            message
          }
        }
      }`,
      {
        page: {
          title: page.title,
          handle: page.handle,
          body: page.body,
          templateSuffix: "generated-reference",
          isPublished: false
        }
      }
    );
    this.#assertUserErrors(created.pageCreate.userErrors, "pageCreate");

    if (!created.pageCreate.page) {
      throw new Error("pageCreate returned no page.");
    }

    return {
      kind: "page",
      id: created.pageCreate.page.id,
      handle: page.handle,
      action: "created"
    };
  }

  async ensureContentModel(model: StoreSetupContentModelPlan): Promise<ResourceMutationResult> {
    if (model.type === "metaobject") {
      const type = `replicator_${model.name}`;
      const existing = await this.#graphql<{
        metaobjectDefinitionByType?: { id: string; type: string };
      }>(
        `query DefinitionByType($type: String!) {
          metaobjectDefinitionByType(type: $type) {
            id
            type
          }
        }`,
        { type }
      );

      if (existing.metaobjectDefinitionByType) {
        return {
          kind: "metaobject_definition",
          id: existing.metaobjectDefinitionByType.id,
          handle: model.name,
          action: "updated"
        };
      }

      const created = await this.#graphql<{
        metaobjectDefinitionCreate: {
          metaobjectDefinition?: { id: string; type: string };
          userErrors: Array<{ message: string }>;
        };
      }>(
        `mutation CreateMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {
          metaobjectDefinitionCreate(definition: $definition) {
            metaobjectDefinition {
              id
              type
            }
            userErrors {
              message
            }
          }
        }`,
        {
          definition: {
            name: slugToTitle(model.name),
            type,
            fieldDefinitions: model.fields.map((field) => ({
              key: field,
              name: slugToTitle(field),
              type: "single_line_text_field"
            }))
          }
        }
      );
      this.#assertUserErrors(created.metaobjectDefinitionCreate.userErrors, "metaobjectDefinitionCreate");

      if (!created.metaobjectDefinitionCreate.metaobjectDefinition) {
        throw new Error("metaobjectDefinitionCreate returned no definition.");
      }

      return {
        kind: "metaobject_definition",
        id: created.metaobjectDefinitionCreate.metaobjectDefinition.id,
        handle: model.name,
        action: "created"
      };
    }

    const identifier = {
      ownerType: "SHOP",
      namespace: "replicator",
      key: model.name
    };
    const existing = await this.#graphql<{
      metafieldDefinition?: { id: string };
    }>(
      `query MetafieldDefinition($identifier: MetafieldDefinitionIdentifierInput) {
        metafieldDefinition(identifier: $identifier) {
          id
        }
      }`,
      { identifier }
    );

    if (existing.metafieldDefinition) {
      return {
        kind: "metafield_definition",
        id: existing.metafieldDefinition.id,
        handle: model.name,
        action: "updated"
      };
    }

    const created = await this.#graphql<{
      metafieldDefinitionCreate: {
        createdDefinition?: { id: string };
        userErrors: Array<{ message: string }>;
      };
    }>(
      `mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
        metafieldDefinitionCreate(definition: $definition) {
          createdDefinition {
            id
          }
          userErrors {
            message
          }
        }
      }`,
      {
        definition: {
          name: slugToTitle(model.name),
          namespace: "replicator",
          key: model.name,
          ownerType: "SHOP",
          type: "json"
        }
      }
    );
    this.#assertUserErrors(created.metafieldDefinitionCreate.userErrors, "metafieldDefinitionCreate");

    if (!created.metafieldDefinitionCreate.createdDefinition) {
      throw new Error("metafieldDefinitionCreate returned no definition.");
    }

    return {
      kind: "metafield_definition",
      id: created.metafieldDefinitionCreate.createdDefinition.id,
      handle: model.name,
      action: "created"
    };
  }

  async rollback(resources: Array<{ kind: string; id: string }>): Promise<void> {
    for (const resource of resources.slice().reverse()) {
      const mutation =
        resource.kind === "theme"
          ? `mutation DeleteTheme($id: ID!) { themeDelete(id: $id) { deletedThemeId userErrors { message } } }`
          : resource.kind === "product"
            ? `mutation DeleteProduct($input: ProductDeleteInput!) { productDelete(input: $input) { deletedProductId userErrors { message } } }`
            : resource.kind === "collection"
              ? `mutation DeleteCollection($input: CollectionDeleteInput!) { collectionDelete(input: $input) { deletedCollectionId userErrors { message } } }`
              : resource.kind === "menu"
                ? `mutation DeleteMenu($id: ID!) { menuDelete(id: $id) { deletedMenuId userErrors { message } } }`
                : resource.kind === "page"
                  ? `mutation DeletePage($id: ID!) { pageDelete(id: $id) { deletedPageId userErrors { message } } }`
                  : resource.kind === "metaobject_definition"
                    ? `mutation DeleteMetaobjectDefinition($id: ID!) { metaobjectDefinitionDelete(id: $id) { deletedId userErrors { message } } }`
                    : `mutation DeleteMetafieldDefinition($id: ID!, $deleteAllAssociatedMetafields: Boolean!) { metafieldDefinitionDelete(id: $id, deleteAllAssociatedMetafields: $deleteAllAssociatedMetafields) { deletedDefinitionId userErrors { message } } }`;

      const variables =
        resource.kind === "product"
          ? { input: { id: resource.id }, synchronous: true }
          : resource.kind === "collection"
            ? { input: { id: resource.id } }
            : resource.kind === "metafield_definition"
              ? { id: resource.id, deleteAllAssociatedMetafields: true }
              : { id: resource.id };

      await this.#graphql(mutation, variables);
    }
  }
}

export class ShopifyAdminReplicationService {
  readonly #workspaceReader: ThemeWorkspaceReader;
  readonly #clientFactory: ShopifyAdminReplicationServiceOptions["clientFactory"];
  readonly #lockManager: DestinationLockManager;

  constructor(options: ShopifyAdminReplicationServiceOptions = {}) {
    this.#workspaceReader = options.workspaceReader ?? new ThemeWorkspaceReaderImpl();
    this.#clientFactory =
      options.clientFactory ??
      (({ destinationStore, token }) => new ShopifyAdminGraphqlClient(destinationStore, token));
    this.#lockManager = options.lockManager ?? new FileDestinationLockManager();
  }

  async replicate({
    jobId,
    destinationStore,
    storefrontModel,
    themeWorkspacePath = join(process.cwd(), "packages/theme-workspace")
  }: ReplicationInput): Promise<AdminReplicationResult> {
    if (!destinationStore.adminTokenEnvVar) {
      throw new Error(`Destination store ${destinationStore.id} is missing adminTokenEnvVar.`);
    }

    const token = process.env[destinationStore.adminTokenEnvVar];

    if (!token) {
      throw new Error(`Missing Admin API token in ${destinationStore.adminTokenEnvVar}.`);
    }

    await this.#lockManager.acquire(destinationStore.id);

    try {
      const client = this.#clientFactory({ destinationStore, token });
      const themeName = `${destinationStore.themeNamePrefix ?? "Replicator"} ${jobId}`;
      const theme = await client.ensureReplicationTheme({
        themeName,
        ...(destinationStore.baseThemeId ? { baseThemeId: destinationStore.baseThemeId } : {}),
        ...(destinationStore.baseThemeRole ? { baseThemeRole: destinationStore.baseThemeRole } : {})
      });
      const files = await this.#workspaceReader.listFiles(themeWorkspacePath);
      await client.upsertThemeFiles(theme.themeId, files);

      const createdResources: ReplicatedResource[] = [];
      const updatedResources: ReplicatedResource[] = [];

      const themeResource = {
        kind: "theme" as const,
        id: theme.themeId,
        handle: theme.themeName,
        action: theme.action
      };

      if (theme.action === "created") {
        createdResources.push(themeResource);
      } else {
        updatedResources.push(themeResource);
      }

      const productResults = await Promise.all(
        storefrontModel.products.map(async (product) => client.upsertProduct(product))
      );
      const productIds = productResults.map((result) => result.id);

      for (const result of productResults) {
        (result.action === "created" ? createdResources : updatedResources).push(result);
      }

      for (const collection of storefrontModel.collections) {
        const result = await client.upsertCollection(collection, productIds);
        (result.action === "created" ? createdResources : updatedResources).push(result);
      }

      for (const page of storefrontModel.pages.filter((page) => page.kind === "content_page" && page.handle)) {
        const result = await client.upsertPage({
          handle: page.handle,
          title: page.title,
          body: `<h1>${page.title}</h1><p>Replicated from ${page.url}</p>`
        });
        (result.action === "created" ? createdResources : updatedResources).push(result);
      }

      for (const menu of storefrontModel.menus) {
        const result = await client.upsertMenu(menu);
        (result.action === "created" ? createdResources : updatedResources).push(result);
      }

      for (const model of storefrontModel.contentModels) {
        const result = await client.ensureContentModel(model);
        (result.action === "created" ? createdResources : updatedResources).push(result);
      }

      const replicatedAt = new Date().toISOString();

      return {
        replicatedAt,
        destinationStoreId: destinationStore.id,
        shopDomain: destinationStore.shopDomain,
        themeId: theme.themeId,
        themeName: theme.themeName,
        previewUrl: `https://${destinationStore.shopDomain}?preview_theme_id=${themeIdToPreviewId(theme.themeId)}`,
        summary: `Replicated generated storefront to destination theme ${theme.themeName}.`,
        createdResources,
        updatedResources,
        warnings: [...storefrontModel.unsupportedFeatures],
        rollbackManifest: {
          generatedAt: replicatedAt,
          resources: createdResources.map((resource) => ({
            kind: resource.kind,
            id: resource.id,
            ...(resource.handle ? { handle: resource.handle } : {})
          }))
        }
      };
    } finally {
      await this.#lockManager.release(destinationStore.id);
    }
  }

  async rollback(input: {
    destinationStore: DestinationStoreProfile;
    rollbackManifest: AdminReplicationResult["rollbackManifest"];
  }): Promise<void> {
    if (!input.destinationStore.adminTokenEnvVar) {
      throw new Error(`Destination store ${input.destinationStore.id} is missing adminTokenEnvVar.`);
    }

    const token = process.env[input.destinationStore.adminTokenEnvVar];

    if (!token) {
      throw new Error(`Missing Admin API token in ${input.destinationStore.adminTokenEnvVar}.`);
    }

    const client = this.#clientFactory({
      destinationStore: input.destinationStore,
      token
    });
    await client.rollback(input.rollbackManifest.resources);
  }
}

export function createAssetFilename(sourceUrl: string): string {
  const hash = createHash("sha1").update(sourceUrl).digest("hex").slice(0, 12);
  const pathname = new URL(sourceUrl).pathname;
  const extension = pathname.split(".").at(-1)?.toLowerCase();
  return extension && extension.length <= 5 ? `assets/replicator-${hash}.${extension}` : `assets/replicator-${hash}.bin`;
}
