# Shopify Web Replicator

Shopify Web Replicator is a local MCP server for agents like Codex and Claude. An agent calls a one-shot replication tool, the local engine runs a deterministic Shopify replication pipeline to a terminal state, and the result comes back as a typed handoff payload plus stable theme artifacts written into a local Shopify theme workspace.

The primary public interface is the MCP server in `apps/mcp`. The API and web app are optional companion surfaces for manual review, local debugging, and operator handoff.

This repo is ready to share as a public local tool. The stable contract is the deterministic MCP workflow, not visual parity with a live source site.

## Prerequisites

- Node.js `v22.22.0`
- pnpm `10.30.3`
- Shopify CLI installed globally with `npm install -g @shopify/cli@latest`
- A writable local checkout for `.data/` and `packages/theme-workspace`

## Workspace layout

- `apps/mcp`: stdio MCP server for agent-driven replication
- `apps/api`: optional HTTP API backed by the same replication engine
- `apps/web`: optional operator UI for intake, job review, and handoff
- `packages/engine`: shared deterministic replication engine used by MCP and API
- `packages/shared`: shared contracts and pipeline types
- `packages/theme-workspace`: Shopify theme workspace that receives generated output

## Scripts

- `pnpm dev`: build shared and engine packages, then start shared watch, engine watch, API, web app, and MCP server watch
- `pnpm build`: build shared, engine, API, web, and MCP packages
- `pnpm typecheck`: run TypeScript checks across all apps and packages
- `pnpm test`: run shared, engine, API, web, and MCP tests in sequence
- `pnpm theme:check`: run Shopify theme validation on the local theme workspace

## Quick start

1. Install dependencies with `pnpm install --frozen-lockfile --ignore-scripts`.
2. Build the workspace with `pnpm build`.
3. Validate the theme workspace with `pnpm theme:check`.
4. Launch the MCP server with `node apps/mcp/dist/index.js`.
5. Optionally launch the companion surfaces with `pnpm --filter @shopify-web-replicator/api dev` and `pnpm --filter @shopify-web-replicator/web dev`.
6. Wire the built MCP entrypoint into your client using the config in [docs/mcp-setup.md](docs/mcp-setup.md).

For local development, `pnpm dev` starts the shared package watches plus the API, web app, and MCP server.

## Production-ready behavior

- The MCP server fails fast with structured runtime-preflight errors when Node does not support `node:sqlite`, Shopify CLI is missing, the DB directory is unwritable, or the theme workspace is unavailable.
- The end-to-end verification bar is `pnpm build`, `pnpm test`, `pnpm typecheck`, and `pnpm theme:check`.
- The companion API binds to `127.0.0.1` by default and only allows localhost-style origins unless you explicitly override them.
- The MCP tool surface is intentionally small and stable: `replicate_storefront`, `get_replication_job`, and `list_replication_jobs`.

## Runtime configuration

- `REPLICATOR_DB_PATH`
  Default: `.data/replicator.db`
- `THEME_WORKSPACE_PATH`
  Default: `packages/theme-workspace`
- `HOST`
  Default: `127.0.0.1` for the companion API.
- `PORT`
  Default: `8787` for the companion API.
- `REPLICATOR_ALLOWED_ORIGINS`
  Default: localhost and `127.0.0.1` origins for ports `5173`, `4173`, and `8787`.
- `VITE_API_BASE_URL`
  Default: `http://127.0.0.1:8787` for the companion web app.

These variables affect the MCP server, the API, and the companion web handoff flow because they all use the same engine package. See [.env.example](.env.example) for a working baseline.

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

The API uses the same `packages/engine` orchestrator as the MCP server. It is optional and mainly useful for the included web app or custom local tooling.

## Local MCP setup

See [docs/mcp-setup.md](docs/mcp-setup.md) for stdio launch details, example client configuration, and environment overrides.

## Companion operator flow

The web app remains useful for manual review, but it is not the primary contract:

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
- The API and web app are optional companion surfaces, not the primary contract.

## Contributing and license

- See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, verification, and pull request expectations.
- See [SECURITY.md](SECURITY.md) for vulnerability reporting.
- The root repository is licensed under [LICENSE](LICENSE), except for [packages/theme-workspace/LICENSE.md](packages/theme-workspace/LICENSE.md), which keeps its own Shopify license.
