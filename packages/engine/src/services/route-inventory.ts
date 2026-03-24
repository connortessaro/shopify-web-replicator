import type { ReferenceCapture, RouteInventory, RouteInventoryRoute } from "@shopify-web-replicator/shared";

import type { StorefrontInspection } from "./storefront-inspector.js";
import { StorefrontInspector } from "./storefront-inspector.js";

type BuildRouteInventoryInput = {
  jobId?: string;
  referenceUrl: string;
  inspection?: StorefrontInspection;
};

type InspectorLike = Pick<StorefrontInspector, "inspect">;

function toCanonicalUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  return url.toString();
}

function toRouteHandle(pathname: string): string | undefined {
  const segments = pathname.split("/").filter(Boolean);
  return segments.at(-1);
}

function classifyRoute(url: URL): RouteInventoryRoute | undefined {
  if (url.pathname === "/" || url.pathname === "") {
    return {
      kind: "homepage",
      source: "root",
      url: toCanonicalUrl(url.toString())
    };
  }

  if (url.pathname === "/cart" || url.pathname === "/checkout") {
    return undefined;
  }

  if (url.pathname.startsWith("/products/")) {
    return {
      kind: "product_page",
      source: "cta",
      url: toCanonicalUrl(url.toString()),
      ...(toRouteHandle(url.pathname) ? { handle: toRouteHandle(url.pathname) } : {})
    };
  }

  if (url.pathname.startsWith("/collections/")) {
    return {
      kind: "collection_page",
      source: "navigation",
      url: toCanonicalUrl(url.toString()),
      ...(toRouteHandle(url.pathname) ? { handle: toRouteHandle(url.pathname) } : {})
    };
  }

  return {
    kind: "content_page",
    source: "navigation",
    url: toCanonicalUrl(url.toString()),
    ...(toRouteHandle(url.pathname) ? { handle: toRouteHandle(url.pathname) } : {})
  };
}

function summarizeInventory(routes: RouteInventoryRoute[]): string {
  const counts = routes.reduce(
    (acc, route) => {
      acc[route.kind] += 1;
      return acc;
    },
    {
      homepage: 0,
      product_page: 0,
      collection_page: 0,
      content_page: 0
    }
  );

  return `Discovered ${routes.length} routes (${counts.homepage} homepage, ${counts.collection_page} collections, ${counts.product_page} products, ${counts.content_page} content pages).`;
}

export class ShopifyRouteInventoryService {
  readonly #inspector?: InspectorLike;

  constructor(inspector?: InspectorLike) {
    this.#inspector = inspector;
  }

  async build({ jobId, referenceUrl, inspection }: BuildRouteInventoryInput): Promise<RouteInventory> {
    const rootInspection =
      inspection ??
      (await this.#inspector?.inspect({
        jobId: jobId ?? "route-inventory",
        referenceUrl
      }));

    if (!rootInspection) {
      throw new Error("Route inventory requires a storefront inspection.");
    }

    const rootUrl = new URL(rootInspection.resolvedUrl || referenceUrl);
    const seen = new Set<string>();
    const routes: RouteInventoryRoute[] = [];
    const limits = {
      product_page: 20,
      collection_page: 10,
      content_page: 10
    } as const;
    const counts = {
      product_page: 0,
      collection_page: 0,
      content_page: 0
    };

    const addRoute = (candidateUrl: string) => {
      const url = new URL(candidateUrl, rootUrl);

      if (url.hostname !== rootUrl.hostname) {
        return;
      }

      const route = classifyRoute(url);

      if (!route) {
        return;
      }

      const key = route.url;

      if (seen.has(key)) {
        return;
      }

      if (route.kind !== "homepage") {
        const limit = limits[route.kind];

        if (counts[route.kind] >= limit) {
          return;
        }

        counts[route.kind] += 1;
      }

      seen.add(key);
      routes.push(route);
    };

    addRoute(rootUrl.toString());

    for (const link of rootInspection.navigationLinks) {
      addRoute(link.href);
    }

    for (const link of rootInspection.primaryCtas) {
      addRoute(link.href);
    }

    return {
      discoveredAt: rootInspection.capturedAt,
      referenceHost: rootInspection.referenceHost,
      summary: summarizeInventory(routes),
      routes
    };
  }
}
