import type {
  FigmaImportStage,
  FrontendSpec,
  PlaywrightDiscovery,
  ReferenceCapture
} from "@shopify-web-replicator/shared";

function routeComponentName(kind: PlaywrightDiscovery["routes"][number]["kind"]): string {
  switch (kind) {
    case "homepage":
      return "HomepageRoute";
    case "product_page":
      return "ProductRoute";
    case "collection_page":
      return "CollectionRoute";
    case "cart":
      return "CartRoute";
    default:
      return "ContentRoute";
  }
}

function inferComponents(discovery: PlaywrightDiscovery): string[] {
  const components = new Set<string>(["SiteLayout", "HeaderNav", "Footer"]);

  if (discovery.routes.some((route) => route.kind === "homepage")) {
    components.add("HeroSection");
  }

  if (discovery.routes.some((route) => route.kind === "product_page")) {
    components.add("ProductDetail");
    components.add("ProductGallery");
  }

  if (discovery.routes.some((route) => route.kind === "collection_page")) {
    components.add("CollectionGrid");
  }

  if (discovery.routes.some((route) => route.kind === "cart")) {
    components.add("CartSummary");
  }

  return [...components];
}

export class FrontendSpecBuilder {
  build(input: {
    capture: ReferenceCapture;
    discovery: PlaywrightDiscovery;
    figmaImport: FigmaImportStage;
  }): FrontendSpec {
    const { capture, discovery, figmaImport } = input;

    return {
      builtAt: new Date().toISOString(),
      summary: `Built a Hydrogen frontend spec from rendered capture signals and a ${figmaImport.status} Figma design context stage.`,
      components: [
        ...inferComponents(discovery),
        ...(figmaImport.designContextCode ? ["FigmaDesignContext"] : [])
      ],
      routes: discovery.routes.map((route) => ({
        path: route.path,
        kind: route.kind,
        component: routeComponentName(route.kind),
        sourceUrl: route.sourceUrl
      })),
      designTokens: {
        colors: capture.styleTokens.dominantColors,
        fonts: capture.styleTokens.fontFamilies
      }
    };
  }
}
