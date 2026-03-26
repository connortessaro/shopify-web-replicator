import type { ReferenceCapture, RouteInventory } from "@shopify-web-replicator/shared";
import type { PlaywrightDiscovery } from "@shopify-web-replicator/shared";

function routePathFromUrl(value: string): string {
  const url = new URL(value);
  return url.pathname === "" ? "/" : url.pathname;
}

function inferObservedFeatures(capture: ReferenceCapture, routeInventory: RouteInventory): string[] {
  const features = new Set<string>();

  if (routeInventory.routes.some((route) => route.kind === "product_page")) {
    features.add("catalog");
  }

  if (routeInventory.routes.some((route) => route.kind === "collection_page")) {
    features.add("collections");
  }

  if (capture.routeHints.cartPath) {
    features.add("cart");
  }

  if (capture.routeHints.checkoutPath) {
    features.add("checkout");
  }

  if (capture.primaryCtas.some((link) => /subscribe|contact|book|join/i.test(link.label))) {
    features.add("lead_capture");
  }

  if (capture.navigationLinks.some((link) => /account|login|sign in/i.test(link.label))) {
    features.add("customer_accounts");
  }

  if (capture.navigationLinks.some((link) => /search/i.test(link.label))) {
    features.add("search");
  }

  return [...features];
}

export class PlaywrightDiscoveryService {
  build(input: {
    capture: ReferenceCapture;
    routeInventory: RouteInventory;
  }): PlaywrightDiscovery {
    const { capture, routeInventory } = input;
    const routes: PlaywrightDiscovery["routes"] = routeInventory.routes.map((route) => ({
      path: route.kind === "homepage" ? "/" : routePathFromUrl(route.url),
      sourceUrl: route.url,
      kind:
        route.kind === "content_page" || route.kind === "landing_page"
          ? ("content_page" as const)
          : route.kind,
      confidence: route.kind === "content_page" ? ("medium" as const) : ("high" as const)
    }));

    if (capture.routeHints.cartPath) {
      routes.push({
        path: capture.routeHints.cartPath,
        sourceUrl: new URL(capture.routeHints.cartPath, capture.resolvedUrl).toString(),
        kind: "cart",
        confidence: "high"
      });
    }

    return {
      discoveredAt: capture.capturedAt,
      summary: `Observed ${routes.length} routes and ${capture.primaryCtas.length + capture.navigationLinks.length} interactive links from rendered storefront capture.`,
      screenshots: {
        desktopPath: capture.desktopScreenshotPath,
        mobilePath: capture.mobileScreenshotPath
      },
      routes,
      interactions: [
        ...capture.navigationLinks.map((link) => ({
          label: link.label,
          href: link.href,
          kind: "navigation" as const
        })),
        ...capture.primaryCtas.map((link) => ({
          label: link.label,
          href: link.href,
          kind: "cta" as const
        }))
      ],
      observedFeatures: inferObservedFeatures(capture, routeInventory),
      networkEndpoints: []
    };
  }
}
