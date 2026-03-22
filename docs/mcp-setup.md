# MCP Setup

## Purpose

This doc is the fastest path to getting the local MCP server working in an external client.

Use this doc if you want to:

- install the repo cleanly
- point an MCP client at the built server
- run a first replication job
- understand what a successful result looks like

## Supported runtime

- Node.js `v22.22.0`
- pnpm `10.30.3`
- Shopify CLI installed globally with `npm install -g @shopify/cli@latest`

## Build and launch

From the repo root:

1. `pnpm install --frozen-lockfile --ignore-scripts`
2. `pnpm build`
3. `node apps/mcp/dist/index.js`

For active development you can also run:

- `pnpm --filter @shopify-web-replicator/mcp dev`

For a clean launch rehearsal, use:

1. `pnpm install --frozen-lockfile --ignore-scripts`
2. `pnpm build`
3. `pnpm typecheck`
4. `pnpm test`
5. `pnpm theme:check`
6. `node apps/mcp/dist/index.js`

## Example client configuration

Use the built entrypoint in clients that support local stdio MCP servers:

```json
{
  "mcpServers": {
    "shopify-web-replicator": {
      "command": "node",
      "args": ["/absolute/path/to/shopify-web-replicator/apps/mcp/dist/index.js"],
      "env": {
        "REPLICATOR_DB_PATH": "/absolute/path/to/shopify-web-replicator/.data/replicator.db",
        "THEME_WORKSPACE_PATH": "/absolute/path/to/shopify-web-replicator/packages/theme-workspace"
      }
    }
  }
}
```

## First tool call

Call `replicate_storefront` with a valid public URL and an explicit page type:

```json
{
  "name": "replicate_storefront",
  "arguments": {
    "referenceUrl": "https://www.nike.com/",
    "pageType": "homepage",
    "notes": "Preserve the hero hierarchy and CTA emphasis."
  }
}
```

## Available tools

- `replicate_storefront`
  Input: `referenceUrl`, optional `pageType`, optional `notes`
- `get_replication_job`
  Input: `jobId`
- `list_replication_jobs`
  Input: optional `limit`

## What success looks like

A healthy run returns a terminal structured result with:

- `status: "needs_review"` or `status: "failed"`
- `currentStage`
- generated artifact metadata
- `themeWorkspacePath`
- `previewCommand`
- deterministic `nextActions`

Use `get_replication_job` or `list_replication_jobs` when you want to reopen a persisted run.

## Recommended workflow

1. Call `replicate_storefront`.
2. Review the returned artifact paths, validation state, integration state, and `nextActions`.
3. Run `shopify theme dev` against the configured workspace.
4. Re-run `pnpm theme:check` after any change to the workspace theme files.

## Environment overrides

- `REPLICATOR_DB_PATH`
  Overrides the SQLite database path.
  Default: `.data/replicator.db`
- `THEME_WORKSPACE_PATH`
  Overrides the Shopify theme workspace path.
  Default: `packages/theme-workspace`
- `HOST`
  Used by the companion API only.
  Default: `127.0.0.1`
- `PORT`
  Used by the companion API only.
- `REPLICATOR_ALLOWED_ORIGINS`
  Used by the companion API only.
  Default: localhost and `127.0.0.1` origins for ports `5173`, `4173`, and `8787`
- `VITE_API_BASE_URL`
  Used by the companion web app only.

## Runtime safeguards

- Replication preflight checks the Node runtime, Shopify CLI, the configured DB directory, and the theme workspace before the engine runs.
- Preflight failures come back as structured MCP tool errors instead of a transport crash.
- The companion API stays on localhost by default. If you override `HOST` or `REPLICATOR_ALLOWED_ORIGINS`, treat that as an explicit security decision.

## Current limits

- The engine is deterministic and local-only.
- It does not fetch live HTML, assets, or screenshots from the reference site.
- The generated store setup output is a plan artifact, not Shopify Admin automation.
- The companion API and web app are optional surfaces and are not required for the MCP workflow.

## Next docs

- [README.md](../README.md)
- [docs/operator-runbook.md](operator-runbook.md)
- [docs/troubleshooting.md](troubleshooting.md)
