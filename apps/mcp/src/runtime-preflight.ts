import { execFile } from "node:child_process";
import { access, mkdir, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname } from "node:path";
import { promisify } from "node:util";

import type { McpRuntimeConfig } from "./runtime.js";

const execFileAsync = promisify(execFile);

export type RuntimeCheckMode = "read" | "replicate";

export type RuntimePreflightIssueCode =
  | "database_directory_unwritable"
  | "engine_bootstrap_failed"
  | "shopify_cli_unavailable"
  | "sqlite_unavailable"
  | "theme_workspace_missing"
  | "theme_workspace_unwritable";

export type RuntimePreflightIssue = {
  code: RuntimePreflightIssueCode;
  message: string;
};

export class RuntimePreflightError extends Error {
  readonly issues: RuntimePreflightIssue[];

  constructor(issues: RuntimePreflightIssue[], message = "Runtime preflight failed.") {
    super(message);
    this.name = "RuntimePreflightError";
    this.issues = issues;
  }
}

async function checkSqliteSupport(): Promise<RuntimePreflightIssue | undefined> {
  try {
    await import("node:sqlite");
    return undefined;
  } catch {
    return {
      code: "sqlite_unavailable",
      message: "The current Node runtime does not support node:sqlite."
    };
  }
}

async function checkDatabaseDirectory(databasePath: string): Promise<RuntimePreflightIssue | undefined> {
  const directoryPath = dirname(databasePath);

  try {
    await mkdir(directoryPath, { recursive: true });
    await access(directoryPath, fsConstants.W_OK);
    return undefined;
  } catch {
    return {
      code: "database_directory_unwritable",
      message: `Database path parent directory is not writable: ${directoryPath}`
    };
  }
}

async function checkThemeWorkspace(themeWorkspacePath: string): Promise<RuntimePreflightIssue | undefined> {
  try {
    const workspaceStats = await stat(themeWorkspacePath);

    if (!workspaceStats.isDirectory()) {
      return {
        code: "theme_workspace_missing",
        message: `Theme workspace path does not exist: ${themeWorkspacePath}`
      };
    }

    await access(themeWorkspacePath, fsConstants.R_OK | fsConstants.W_OK);
    return undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        code: "theme_workspace_missing",
        message: `Theme workspace path does not exist: ${themeWorkspacePath}`
      };
    }

    return {
      code: "theme_workspace_unwritable",
      message: `Theme workspace path is not readable and writable: ${themeWorkspacePath}`
    };
  }
}

async function checkShopifyCli(): Promise<RuntimePreflightIssue | undefined> {
  try {
    await execFileAsync("shopify", ["version"]);
    return undefined;
  } catch {
    return {
      code: "shopify_cli_unavailable",
      message: "Shopify CLI is required for replication and theme validation."
    };
  }
}

export async function runRuntimePreflight(
  runtime: McpRuntimeConfig,
  mode: RuntimeCheckMode
): Promise<void> {
  const checks = [checkSqliteSupport(), checkDatabaseDirectory(runtime.databasePath)];

  if (mode === "replicate") {
    checks.push(checkThemeWorkspace(runtime.themeWorkspacePath), checkShopifyCli());
  }

  const issues = (await Promise.all(checks)).filter(
    (issue): issue is RuntimePreflightIssue => issue !== undefined
  );

  if (issues.length > 0) {
    throw new RuntimePreflightError(issues);
  }
}

export function toRuntimePreflightError(error: unknown): RuntimePreflightError {
  if (error instanceof RuntimePreflightError) {
    return error;
  }

  return new RuntimePreflightError([
    {
      code: "engine_bootstrap_failed",
      message: error instanceof Error ? error.message : "Failed to bootstrap the replication engine."
    }
  ]);
}

export type { McpRuntimeConfig } from "./runtime.js";
