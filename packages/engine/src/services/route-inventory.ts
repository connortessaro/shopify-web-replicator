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

function withHandle(route: Omit<RouteInventoryRoute, "handle">, pathname: string): RouteInventoryRoute {
  const handle = toRouteHandle(pathname);
  return handle ? { ...route, handle } : route;
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
    return withHandle(
      { kind: "product_page", source: "cta", url: toCanonicalUrl(url.toString()) },
      url.pathname
    );
  }

  if (url.pathname.startsWith("/collections/")) {
    return withHandle(
      { kind: "collection_page", source: "navigation", url: toCanonicalUrl(url.toString()) },
      url.pathname
    );
  }

  return withHandle(
    { kind: "content_page", source: "navigation", url: toCanonicalUrl(url.toString()) },
    url.pathname
  );
}

function summarizeInventory(routes: RouteInventoryRoute[]): string {
  const counts: Record<string, number> = {
    homepage: 0,
    product_page: 0,
    collection_page: 0,
    content_page: 0
  };

  for (const route of routes) {
    counts[route.kind] = (counts[route.kind] ?? 0) + 1;
  }

  return `Discovered ${routes.length} routes (${counts.homepage} homepage, ${counts.collection_page} collections, ${counts.product_page} products, ${counts.content_page} content pages).`;
}

export class ShopifyRouteInventoryService {
  readonly #inspector: InspectorLike | undefined;

  constructor(inspector?: InspectorLike) {
    this.#inspector = inspector;
  }

  async build({ jobId, referenceUrl, inspection }: BuildRouteInventoryInput): Promise<RouteInventory> {
    const rootInspection =
      inspection ??
      (this.#inspector
        ? await this.#inspector.inspect({ jobId: jobId ?? "route-inventory", referenceUrl })
        : undefined);

    if (!rootInspection) {
      throw new Error("Route inventory requires a storefront inspection.");
    }

    const rootUrl = new URL(rootInspection.resolvedUrl || referenceUrl);
    const seen = new Set<string>();
    const routes: RouteInventoryRoute[] = [];
    const limits: Record<string, number> = {
      product_page: 20,
      collection_page: 10,
      content_page: 10
    };
    const counts: Record<string, number> = {
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
        const limit = limits[route.kind] ?? 10;

        if ((counts[route.kind] ?? 0) >= limit) {
          return;
        }

        counts[route.kind] = (counts[route.kind] ?? 0) + 1;
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
