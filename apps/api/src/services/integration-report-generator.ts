import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import {
  stableCommerceArtifact,
  stableIntegrationArtifact,
  type CommerceWiringPlan,
  type GeneratedThemeArtifact,
  type GenerationResult,
  type IntegrationCheck,
  type IntegrationReport,
  type ReferenceAnalysis,
  type StoreSetupPlan,
  type ThemeCheckResult,
  type ThemeMapping
} from "@shopify-web-replicator/shared";

type GenerateInput = {
  analysis: ReferenceAnalysis;
  mapping: ThemeMapping;
  generation: GenerationResult;
  storeSetup: StoreSetupPlan;
  commerce: CommerceWiringPlan;
  artifacts: GeneratedThemeArtifact[];
  validation: ThemeCheckResult;
};

type IntegrationReportGenerationResult = {
  artifact: GeneratedThemeArtifact;
  integration: IntegrationReport;
};

function buildGeneratedArtifactsCheck(
  generation: GenerationResult,
  storeSetup: StoreSetupPlan,
  commerce: CommerceWiringPlan,
  artifacts: GeneratedThemeArtifact[]
): IntegrationCheck {
  const requiredArtifactPaths = [
    generation.sectionPath,
    generation.templatePath,
    storeSetup.configPath,
    commerce.snippetPath
  ];
  const missingArtifacts = requiredArtifactPaths.filter((path) => {
    const artifact = artifacts.find((entry) => entry.path === path);
    return artifact?.status !== "generated";
  });

  if (missingArtifacts.length > 0) {
    return {
      id: "generated_artifacts",
      status: "failed",
      details: `Expected generated artifacts are missing or not marked generated: ${missingArtifacts.join(", ")}.`
    };
  }

  return {
    id: "generated_artifacts",
    status: "passed",
    details: "Theme, store setup, and commerce artifacts are all generated."
  };
}

function buildEntrypointCheck(storeSetup: StoreSetupPlan, commerce: CommerceWiringPlan): IntegrationCheck {
  const productHandles = new Set(storeSetup.products.map((product) => product.handle));
  const collectionHandles = new Set(storeSetup.collections.map((collection) => collection.handle));
  const invalidTargets = commerce.entrypoints
    .map((entrypoint) => entrypoint.target)
    .filter((target) => {
      if (target === "/cart" || target === "/checkout") {
        return false;
      }

      if (target.startsWith("/products/")) {
        return !productHandles.has(target.replace("/products/", ""));
      }

      if (target.startsWith("/collections/")) {
        return !collectionHandles.has(target.replace("/collections/", ""));
      }

      return true;
    });

  if (invalidTargets.length > 0) {
    return {
      id: "commerce_entrypoints",
      status: "failed",
      details: `Commerce entrypoints do not resolve against the deterministic store setup plan: ${invalidTargets.join(", ")}.`
    };
  }

  return {
    id: "commerce_entrypoints",
    status: "passed",
    details: "Commerce entrypoints resolve against generated products, collections, or native Shopify cart and checkout paths."
  };
}

function buildCommerceSnippetCheck(sectionMarkup: string): IntegrationCheck {
  const snippetName = basename(stableCommerceArtifact.path, ".liquid");
  const snippetRenderPattern = new RegExp(`render\\s+['"]${snippetName}['"]`);

  if (!snippetRenderPattern.test(sectionMarkup)) {
    return {
      id: "commerce_snippet_reference",
      status: "failed",
      details: "Generated section is missing the commerce snippet render."
    };
  }

  return {
    id: "commerce_snippet_reference",
    status: "passed",
    details: "Generated section renders the deterministic commerce wiring snippet."
  };
}

function buildValidationCheck(validation: ThemeCheckResult): IntegrationCheck {
  if (validation.status !== "passed") {
    return {
      id: "theme_validation",
      status: "failed",
      details: `Theme validation did not pass: ${validation.summary}`
    };
  }

  return {
    id: "theme_validation",
    status: "passed",
    details: validation.summary
  };
}

export class ShopifyIntegrationReportGenerator {
  readonly #themeWorkspacePath: string;

  constructor(themeWorkspacePath: string) {
    this.#themeWorkspacePath = themeWorkspacePath;
  }

  async generate({
    analysis,
    mapping,
    generation,
    storeSetup,
    commerce,
    artifacts,
    validation
  }: GenerateInput): Promise<IntegrationReportGenerationResult> {
    const checkedAt = new Date().toISOString();
    const sectionMarkup = await readFile(join(this.#themeWorkspacePath, generation.sectionPath), "utf8");
    const checks = [
      buildGeneratedArtifactsCheck(generation, storeSetup, commerce, artifacts),
      buildEntrypointCheck(storeSetup, commerce),
      buildCommerceSnippetCheck(sectionMarkup),
      buildValidationCheck(validation)
    ];
    const status = checks.every((check) => check.status === "passed") ? "passed" : "failed";
    const integration: IntegrationReport = {
      checkedAt,
      reportPath: stableIntegrationArtifact.path,
      status,
      summary:
        status === "passed"
          ? `All deterministic integration checks passed for ${analysis.title}.`
          : `Integration checks failed for ${analysis.title}.`,
      checks
    };
    const outputPath = join(this.#themeWorkspacePath, stableIntegrationArtifact.path);

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(
      outputPath,
      `${JSON.stringify(
        {
          generated_by: "Shopify Web Replicator",
          checked_at: checkedAt,
          source_url: analysis.sourceUrl,
          page_type: analysis.pageType,
          title: analysis.title,
          summary: integration.summary,
          mapping_summary: mapping.summary,
          section_path: generation.sectionPath,
          template_path: generation.templatePath,
          store_setup_config_path: storeSetup.configPath,
          commerce_snippet_path: commerce.snippetPath,
          generated_artifacts: artifacts.map((artifact) => ({
            kind: artifact.kind,
            path: artifact.path,
            status: artifact.status,
            description: artifact.description,
            last_written_at: artifact.lastWrittenAt
          })),
          commerce_entrypoints: commerce.entrypoints,
          validation,
          checks
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    return {
      artifact: {
        kind: "config",
        path: stableIntegrationArtifact.path,
        status: "generated",
        description: stableIntegrationArtifact.description,
        lastWrittenAt: checkedAt
      },
      integration
    };
  }
}
