# MCP Setup

## Purpose

This repo ships a local stdio MCP server so agent clients can call the deterministic Shopify replication engine directly.

## Build and launch

From the repo root:

1. `pnpm install`
2. `pnpm build`
3. Launch the server with:
   `node apps/mcp/dist/index.js`

The browser-backed source qualification and capture flow requires a local Playwright runtime. If Chromium is unavailable, replication fails structurally at `source_qualification` instead of falling back silently.

For active development you can also run:

- `pnpm --filter @shopify-web-replicator/mcp dev`

## Environment overrides

- `REPLICATOR_DB_PATH`
  Overrides the SQLite database path.
  Default: `.data/replicator.db`
- `THEME_WORKSPACE_PATH`
  Overrides the Shopify theme workspace path.
  Default: `packages/theme-workspace`
- `REPLICATOR_CAPTURE_ROOT`
  Overrides the on-disk root used for capture bundles and screenshots.
  Default: `.data/captures`
- `REPLICATOR_DESTINATION_STORES_PATH`
  Overrides the local destination store profile JSON path.
  Default: `config/destination-stores.json`

If you do not set `REPLICATOR_DESTINATION_STORES_PATH`, create `config/destination-stores.json` from [`config/destination-stores.example.json`](/Users/tessaro/shopify-web-replicator/.worktrees/reference-capture/config/destination-stores.example.json).

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
        "THEME_WORKSPACE_PATH": "/absolute/path/to/shopify-web-replicator/packages/theme-workspace",
        "REPLICATOR_CAPTURE_ROOT": "/absolute/path/to/shopify-web-replicator/.data/captures",
        "REPLICATOR_DESTINATION_STORES_PATH": "/absolute/path/to/shopify-web-replicator/config/destination-stores.json"
      }
    }
  }
}
```

## Available tools

- `replicate_storefront`
  Input: `referenceUrl`, `destinationStore`, optional `pageType`, optional `notes`
- `get_replication_job`
  Input: `jobId`
- `list_replication_jobs`
  Input: optional `limit`
- `list_destination_stores`
  Input: none

## Recommended workflow

1. Call `list_destination_stores` and choose a valid destination store id.
2. Call `replicate_storefront` for the default one-shot flow.
3. Review the returned source qualification, capture bundle path, screenshot paths, extracted route/style signals, validation state, integration state, and `nextActions`.
4. Run `shopify theme dev` against the configured workspace.
5. Use `get_replication_job` or `list_replication_jobs` when you need to reopen a persisted run.

## Current limits

- The engine is local-only and currently supports public Shopify storefronts that can be qualified in a browser session.
- It now uses browser-backed capture for a single route and stores screenshots plus capture bundles on disk, but it is not yet a full multi-page storefront crawler.
- The generated store setup output is a plan artifact, not Shopify Admin automation.
