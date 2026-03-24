import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { ThemeCheckResult } from "@shopify-web-replicator/shared";

const execFileAsync = promisify(execFile);

export class ShopifyThemeValidator {
  constructor(private readonly themeWorkspacePath: string) {}

  async validate(): Promise<ThemeCheckResult> {
    try {
      const { stdout, stderr } = await execFileAsync("shopify", [
        "theme",
        "check",
        "--path",
        this.themeWorkspacePath
      ], { timeout: 60_000 });

      return {
        status: "passed",
        summary: "Theme check passed.",
        checkedAt: new Date().toISOString(),
        output: [stdout, stderr].filter(Boolean).join("\n")
      };
    } catch (error) {
      if (error instanceof Error && "killed" in error && (error as any).killed) {
        return {
          status: "failed",
          summary: "Theme validation timed out after 60 seconds.",
          checkedAt: new Date().toISOString()
        };
      }

      if (error instanceof Error) {
        return {
          status: "failed",
          summary: error.message,
          checkedAt: new Date().toISOString()
        };
      }

      return {
        status: "failed",
        summary: "Theme validation failed.",
        checkedAt: new Date().toISOString()
      };
    }
  }
}
