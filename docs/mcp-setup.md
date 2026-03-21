# MCP Setup

## Purpose

This repo ships a local stdio MCP server so agent clients can call the deterministic Shopify replication engine directly.

## Build and launch

From the repo root:

1. `pnpm install`
2. `pnpm build`
3. Launch the server with:
   `node apps/mcp/dist/index.js`

For active development you can also run:

- `pnpm --filter @shopify-web-replicator/mcp dev`

## Environment overrides

- `REPLICATOR_DB_PATH`
  Overrides the SQLite database path.
  Default: `.data/replicator.db`
- `THEME_WORKSPACE_PATH`
  Overrides the Shopify theme workspace path.
  Default: `packages/theme-workspace`

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

## Available tools

- `replicate_storefront`
  Input: `referenceUrl`, optional `pageType`, optional `notes`
- `get_replication_job`
  Input: `jobId`
- `list_replication_jobs`
  Input: optional `limit`

## Recommended workflow

1. Call `replicate_storefront` for the default one-shot flow.
2. Review the returned artifact paths, validation state, integration state, and `nextActions`.
3. Run `shopify theme dev` against the configured workspace.
4. Use `get_replication_job` or `list_replication_jobs` when you need to reopen a persisted run.

## Current limits

- The engine is deterministic and local-only.
- It does not yet fetch live HTML, assets, or screenshots from the reference site.
- The generated store setup output is a plan artifact, not Shopify Admin automation.
