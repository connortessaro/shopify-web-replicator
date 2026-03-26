import type {
  BackendCapability,
  BackendInferenceReport,
  PlaywrightDiscovery,
  ReferenceCapture
} from "@shopify-web-replicator/shared";

function capability(
  name: BackendCapability["name"],
  confidence: BackendCapability["confidence"],
  rationale: string
): BackendCapability {
  return { name, confidence, rationale };
}

export class BackendInferenceService {
  infer(input: {
    capture: ReferenceCapture;
    discovery: PlaywrightDiscovery;
  }): BackendInferenceReport {
    const { capture, discovery } = input;
    const capabilities: BackendCapability[] = [];

    capabilities.push(
      capability(
        "content",
        "high",
        "Rendered content, headings, imagery, and layout tokens are directly observable from the captured storefront."
      )
    );
    capabilities.push(
      capability(
        "catalog",
        discovery.routes.some((route) => route.kind === "product_page" || route.kind === "collection_page")
          ? "high"
          : "medium",
        "Product and collection routes were inferred from public storefront navigation and CTA structure."
      )
    );
    capabilities.push(
      capability(
        "cart",
        capture.routeHints.cartPath ? "high" : "medium",
        "Cart behavior is inferred from route hints and visible CTA flows."
      )
    );
    capabilities.push(
      capability(
        "checkout",
        capture.routeHints.checkoutPath ? "high" : "medium",
        "Checkout handoff is inferred from observable cart or checkout route hints, not from payment completion."
      )
    );
    capabilities.push(
      capability(
        "search",
        discovery.observedFeatures.includes("search") ? "medium" : "unsupported",
        "Search capability depends on whether search UI or routes were visible in public navigation."
      )
    );
    capabilities.push(
      capability(
        "forms",
        discovery.observedFeatures.includes("lead_capture") ? "medium" : "low",
        "Forms can be reproduced in Hydrogen, but submissions and private integrations require explicit backend wiring."
      )
    );
    capabilities.push(
      capability(
        "customer_accounts",
        discovery.observedFeatures.includes("customer_accounts") ? "low" : "unsupported",
        "Customer account flows usually depend on private auth state that is not recoverable from public browsing alone."
      )
    );
    capabilities.push(
      capability(
        "subscriptions",
        capture.primaryCtas.some((link) => /subscribe/i.test(link.label)) ? "low" : "unsupported",
        "Subscription flows often depend on private integrations, billing apps, or checkout extensions."
      )
    );
    capabilities.push(
      capability(
        "custom_integrations",
        "unsupported",
        "Private APIs, webhooks, CMS internals, and admin workflows are intentionally surfaced as handoff-only gaps."
      )
    );

    const unresolvedCapabilities = capabilities
      .filter((entry) => entry.confidence === "low" || entry.confidence === "unsupported")
      .map((entry) => entry.name);

    return {
      inferredAt: new Date().toISOString(),
      summary: `Classified ${capabilities.length} backend capability areas from public storefront observation.`,
      capabilities,
      unresolvedCapabilities
    };
  }
}
