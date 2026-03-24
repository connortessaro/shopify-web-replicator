import type {
  ReferenceCapture,
  RouteInventory,
  StoreSetupCollectionPlan,
  StoreSetupMenuPlan,
  StoreSetupProductPlan,
  StorefrontModel,
  StorefrontModelPage
} from "@shopify-web-replicator/shared";

type BuildStorefrontModelInput = {
  referenceUrl: string;
  routeInventory: RouteInventory;
  capture: ReferenceCapture;
};

function toRelativeTarget(href: string): string {
  try {
    const url = new URL(href);
    return `${url.pathname}${url.search}`;
  } catch {
    return href;
  }
}

function uniqueByHandle<T extends { handle: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.handle)) {
      return false;
    }

    seen.add(item.handle);
    return true;
  });
}

function findRouteTitle(capture: ReferenceCapture, url: string): string | undefined {
  return capture.routes?.find((route) => route.url === url)?.title;
}

export class StorefrontModelBuilder {
  async build({ routeInventory, capture }: BuildStorefrontModelInput): Promise<StorefrontModel> {
    const pages: StorefrontModelPage[] = routeInventory.routes.map((route) => ({
      kind: route.kind,
      url: route.url,
      ...(route.handle ? { handle: route.handle } : {}),
      title:
        findRouteTitle(capture, route.url) ??
        (route.handle
          ? route.handle
              .split("-")
              .map((segment) => `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`)
              .join(" ")
          : capture.title)
    }));

    const products: StoreSetupProductPlan[] = uniqueByHandle(
      routeInventory.routes
        .filter((route): route is typeof routeInventory.routes[number] & { handle: string } => {
          return route.kind === "product_page" && typeof route.handle === "string";
        })
        .map((route) => ({
          handle: route.handle,
          title: findRouteTitle(capture, route.url) ?? route.handle,
          merchandisingRole: "Primary offer for the generated storefront."
        }))
    );

    const collections: StoreSetupCollectionPlan[] = uniqueByHandle(
      routeInventory.routes
        .filter((route): route is typeof routeInventory.routes[number] & { handle: string } => {
          return route.kind === "collection_page" && typeof route.handle === "string";
        })
        .map((route) => ({
          handle: route.handle,
          title: findRouteTitle(capture, route.url) ?? route.handle,
          rule: "Manual collection for generated review.",
          featuredProductHandles: products.slice(0, 8).map((product) => product.handle)
        }))
    );

    const menus: StoreSetupMenuPlan[] =
      capture.navigationLinks.length > 0
        ? [
            {
              handle: "main-menu",
              title: "Main menu",
              items: capture.navigationLinks.map((link) => ({
                title: link.label,
                target: toRelativeTarget(link.href)
              }))
            }
          ]
        : [];

    return {
      modeledAt: capture.capturedAt,
      referenceHost: routeInventory.referenceHost,
      storeTitle: capture.title,
      summary: `Built storefront model with ${pages.length} pages, ${products.length} products, ${collections.length} collections, and ${menus.length} menus.`,
      styleTokens: capture.styleTokens,
      pages,
      products,
      collections,
      menus,
      contentModels: [],
      unsupportedFeatures: []
    };
  }
}
