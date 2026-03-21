# Shopify Web Replicator

Shopify Web Replicator is a standalone MCP server for agents like Codex and Claude. An agent calls a one-shot replication tool, the local engine runs a deterministic Shopify replication pipeline to a terminal state, and the result comes back as a typed handoff payload plus stable theme artifacts written into a local Shopify theme workspace.

The repo still includes a local API and a web review surface, but they are companion interfaces. The primary product surface is the MCP server in `apps/mcp`.

## Workspace layout

- `apps/mcp`: stdio MCP server for agent-driven replication
- `apps/api`: companion HTTP API backed by the same replication engine
- `apps/web`: companion operator UI for intake, job review, and handoff
- `packages/engine`: shared deterministic replication engine used by MCP and API
- `packages/shared`: shared contracts and pipeline types
- `packages/theme-workspace`: Shopify theme workspace that receives generated output

## Scripts

- `pnpm dev`: build shared and engine packages, then start shared watch, engine watch, API, web app, and MCP server watch
- `pnpm build`: build shared, engine, API, web, and MCP packages
- `pnpm typecheck`: run TypeScript checks across all apps and packages
- `pnpm test`: run shared, engine, API, web, and MCP tests in sequence
- `pnpm theme:check`: run Shopify theme validation on the local theme workspace

## Runtime configuration

- `REPLICATOR_DB_PATH`
  Default: `.data/replicator.db`
- `THEME_WORKSPACE_PATH`
  Default: `packages/theme-workspace`

These variables affect the MCP server, the API, and the companion web handoff flow because they all use the same engine package.

## MCP tool surface

- `replicate_storefront`
  Runs the deterministic pipeline end to end in one tool call and returns the terminal handoff payload.
- `get_replication_job`
  Loads a persisted job by id.
- `list_replication_jobs`
  Lists recent persisted jobs, newest first.

The one-shot tool returns:

- job identity and lifecycle state
- typed analysis, mapping, generation, store setup, commerce, validation, and integration snapshots
- generated artifact metadata and timestamps
- runtime handoff info: theme workspace path and preview command
- deterministic next actions for operator review

## Current flow

1. An agent or companion UI submits a reference URL, optional page type, and optional notes.
2. The engine persists a durable SQLite job record.
3. The deterministic pipeline runs through `analysis`, `mapping`, `theme_generation`, `store_setup`, `commerce_wiring`, `validation`, `integration_check`, and `review`.
4. Theme generation overwrites the stable page-type-specific section and template outputs in the theme workspace.
5. Store setup planning writes `config/generated-store-setup.json`.
6. Commerce wiring writes `snippets/generated-commerce-wiring.liquid`.
7. Final validation runs against the fully generated workspace.
8. Integration checks write `config/generated-integration-report.json` and verify generated files on disk, commerce entrypoints, section snippet rendering, checkout handoff markup, and final validation status.
9. The final result is either `needs_review` or `failed`.

## Stable generated outputs

- `sections/generated-reference.liquid`
- `sections/generated-homepage-reference.liquid`
- `sections/generated-product-reference.liquid`
- `sections/generated-collection-reference.liquid`
- `templates/page.generated-reference.json`
- `templates/index.generated-reference.json`
- `templates/product.generated-reference.json`
- `templates/collection.generated-reference.json`
- `config/generated-store-setup.json`
- `snippets/generated-commerce-wiring.liquid`
- `config/generated-integration-report.json`

## Companion HTTP API

- `POST /api/jobs`
- `GET /api/jobs/:jobId`
- `GET /api/jobs?limit=<n>`
- `GET /api/runtime`

The API uses the same `packages/engine` orchestrator as the MCP server.

## Local MCP setup

See `docs/mcp-setup.md` for stdio launch details, example client configuration, and environment overrides.

## Companion operator flow

The web app remains useful for manual review:

1. Start the repo with `pnpm dev`.
2. Submit a job in the web UI or create one through MCP.
3. Open the job detail or handoff view.
4. Review generated artifacts, validation output, integration output, and next steps.
5. Run `shopify theme dev` in the configured workspace and verify layout, content, commerce wiring, and cart-to-checkout handoff.

## Current limits

- The pipeline is deterministic and local-only.
- It does not yet live-crawl, screenshot, or parse full source HTML.
- Store setup output is still a generated plan, not Shopify Admin automation.
- Commerce wiring is deterministic and native-route-based, not live checkout automation.
- Multi-page replication and checkout customization are out of scope for this slice.
