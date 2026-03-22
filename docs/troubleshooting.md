# Troubleshooting

## `The current Node runtime does not support node:sqlite`

Use Node `v22.22.0` from [.nvmrc](../.nvmrc), then rebuild:

1. `pnpm install --frozen-lockfile --ignore-scripts`
2. `pnpm build`

## `Shopify CLI is required for replication and theme validation`

Install or upgrade Shopify CLI:

`npm install -g @shopify/cli@latest`

Then re-run:

- `pnpm theme:check`
- your MCP call

## `Database path parent directory is not writable`

Point `REPLICATOR_DB_PATH` at a writable location or fix permissions on the parent directory.

Example:

`REPLICATOR_DB_PATH=.data/replicator.db`

## `Theme workspace path does not exist`

Use a valid theme workspace path or keep the default:

`THEME_WORKSPACE_PATH=packages/theme-workspace`

Then re-run `pnpm build` and start the MCP server again.

## API requests fail from another machine or browser tab

The companion API is intentionally localhost-bound and only allows localhost-style origins by default.

If you need to override that for a trusted local setup:

- set `HOST`
- set `REPLICATOR_ALLOWED_ORIGINS`
- treat that as an explicit security decision

## Tests show `SQLite is an experimental feature`

Node currently prints an experimental warning for `node:sqlite`. The warning is expected on the pinned runtime and does not indicate a failing test by itself.

## The generated output does not visually match the source site

That is an expected limit of the current product.

This repo produces deterministic Shopify handoff artifacts. It does not fetch live HTML, screenshots, assets, or structured catalog data from the source site.

## I only want the MCP server

That is the main supported path.

You can ignore:

- `apps/api`
- `apps/web`

Use [docs/mcp-setup.md](mcp-setup.md) and the built MCP server entrypoint.
