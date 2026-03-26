import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  RuntimePreflightError,
  runRuntimePreflight,
  toRuntimePreflightError
} from "./runtime-preflight";

vi.mock("node:sqlite", () => ({}));

describe("runRuntimePreflight", () => {
  const pathsToRemove: string[] = [];

  afterEach(async () => {
    await Promise.all(
      pathsToRemove.splice(0).map(async (path) => {
        await rm(path, { recursive: true, force: true });
      })
    );
  });

  it("does not require theme workspace for read mode", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "replicator-mcp-runtime-"));
    pathsToRemove.push(tempRoot);
    const runtime = {
      databasePath: join(tempRoot, ".data", "replicator.db"),
      themeWorkspacePath: join(tempRoot, "missing-theme")
    };

    await expect(runRuntimePreflight(runtime, "read")).resolves.toBeUndefined();
  });

  it("includes theme workspace issue in replicate mode when theme path is missing", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "replicator-mcp-runtime-"));
    pathsToRemove.push(tempRoot);
    const runtime = {
      databasePath: join(tempRoot, ".data", "replicator.db"),
      themeWorkspacePath: join(tempRoot, "missing-theme")
    };
    let error: unknown;

    try {
      await runRuntimePreflight(runtime, "replicate");
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).toBeInstanceOf(RuntimePreflightError);
    expect(
      (error as RuntimePreflightError).issues.some((issue) => issue.code === "theme_workspace_missing")
    ).toBe(true);
  });

  it("wraps unknown runtime exceptions with a bootstrap failure", () => {
    const wrapped = toRuntimePreflightError(new Error("engine failed to load"));

    expect(wrapped).toBeInstanceOf(RuntimePreflightError);
    expect(wrapped.issues).toEqual([
      {
        code: "engine_bootstrap_failed",
        message: "engine failed to load"
      }
    ]);
  });

  it("preserves existing RuntimePreflightError instances", () => {
    const original = new RuntimePreflightError([
      {
        code: "theme_workspace_missing",
        message: "Theme workspace path does not exist: /tmp/theme"
      }
    ]);
    const wrapped = toRuntimePreflightError(original);

    expect(wrapped).toBe(original);
    expect(wrapped.issues).toEqual([
      {
        code: "theme_workspace_missing",
        message: "Theme workspace path does not exist: /tmp/theme"
      }
    ]);
  });
});
