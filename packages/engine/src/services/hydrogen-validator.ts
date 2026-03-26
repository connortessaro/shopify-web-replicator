import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { join } from "node:path";

import type { BackendInferenceReport, HydrogenValidationResult } from "@shopify-web-replicator/shared";

export class HydrogenWorkspaceValidator {
  async validate(input: {
    workspacePath: string;
    backendInference: BackendInferenceReport;
  }): Promise<HydrogenValidationResult> {
    const requiredFiles = [
      "package.json",
      "README.md",
      "app/root.tsx",
      "app/routes/_index.tsx",
      "app/lib/generated-site.ts",
      ".replicator/hydrogen-generation.json"
    ];

    try {
      await Promise.all(
        requiredFiles.map((path) => access(join(input.workspacePath, path), fsConstants.R_OK))
      );
    } catch (error) {
      return {
        checkedAt: new Date().toISOString(),
        status: "failed",
        summary: error instanceof Error ? error.message : "Hydrogen workspace validation failed."
      };
    }

    const unresolved = input.backendInference.unresolvedCapabilities;

    if (unresolved.length > 0) {
      return {
        checkedAt: new Date().toISOString(),
        status: "warning",
        summary: `Hydrogen workspace files are present, but backend capabilities still need manual completion: ${unresolved.join(", ")}.`,
        output: "Validation is structural only. Private or low-confidence capabilities remain handoff items."
      };
    }

    return {
      checkedAt: new Date().toISOString(),
      status: "passed",
      summary: "Hydrogen workspace scaffolding completed and required generated files are present."
    };
  }
}
