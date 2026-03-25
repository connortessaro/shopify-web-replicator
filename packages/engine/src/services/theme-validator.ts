import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { ThemeCheckResult } from "@shopify-web-replicator/shared";

const execFileAsync = promisify(execFile);

const THEME_CHECK_TIMEOUT_MS = 60_000;

export class ShopifyThemeValidator {
  constructor(private readonly themeWorkspacePath: string) {}

  async validate(): Promise<ThemeCheckResult> {
    try {
<<<<<<< HEAD
      const { stdout, stderr } = await execFileAsync("shopify", [
        "theme",
        "check",
        "--path",
        this.themeWorkspacePath
      ], { timeout: 60_000 });
=======
      const { stdout, stderr } = await execFileAsync(
        "shopify",
        ["theme", "check", "--path", this.themeWorkspacePath],
        { timeout: THEME_CHECK_TIMEOUT_MS }
      );
>>>>>>> 0ff837ae2df3782ab4b72a9b6d93d92b7f7d8110

      return {
        status: "passed",
        summary: "Theme check passed.",
        checkedAt: new Date().toISOString(),
        output: [stdout, stderr].filter(Boolean).join("\n")
      };
    } catch (error) {
<<<<<<< HEAD
      if (error instanceof Error && "killed" in error && (error as any).killed) {
        return {
          status: "failed",
          summary: "Theme validation timed out after 60 seconds.",
=======
      if (error instanceof Error && (error as NodeJS.ErrnoException & { killed?: boolean }).killed) {
        return {
          status: "failed",
          summary: `Theme validation timed out after ${THEME_CHECK_TIMEOUT_MS / 1000} seconds. Check Shopify CLI authentication and network connectivity.`,
>>>>>>> 0ff837ae2df3782ab4b72a9b6d93d92b7f7d8110
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
