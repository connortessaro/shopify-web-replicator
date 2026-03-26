# Architecture

## Intent

This repo is built around a standalone MCP server that agents can call directly. The MCP server, companion API, and companion web app all share the same engine so the product can improve behind one domain model while supporting two replication tracks:

- a stable theme-generation pipeline
- an advanced / beta Hydrogen-generation pipeline with a live Figma bridge

## Boundaries

- `apps/mcp` owns the agent-facing MCP server, MCP tool registration, and both stdio and streamable HTTP entrypoints.
- `packages/engine` owns runtime config, destination store discovery, SQLite persistence, browser-backed source qualification, rendered reference capture, orchestration, analysis, mapping, generation, store setup planning, commerce wiring, validation, and integration reporting.
- `apps/api` owns the companion HTTP surface and delegates job creation and execution to the engine.
- `apps/web` owns the companion human review surface and consumes the API.
- `packages/shared` owns the contract shared across MCP, API, web, and engine.
- `packages/theme-workspace` owns the Shopify-native output that gets previewed with Shopify CLI.

## Theme MCP flow

1. An MCP client connects to `apps/mcp` over stdio or streamable HTTP.
2. The client optionally calls `list_destination_stores`, then calls `replicate_site_to_theme` with `referenceUrl`, `destinationStore`, optional `pageType`, and optional `notes`.
3. `apps/mcp` delegates to `packages/engine`.
4. The engine creates a durable SQLite job and runs the deterministic pipeline synchronously for the tool call.
5. `source_qualification` uses Playwright-backed inspection to verify that the source is a public Shopify storefront, detect password protection, and capture the resolved URL and HTTP status before more work is done.
6. `capture` reuses the browser inspection to derive reusable reference signals such as headings, navigation links, primary CTAs, image assets, text content, style tokens, route hints, and writes a disk-backed capture bundle with desktop/mobile screenshots.
7. `analysis` derives a typed summary from the qualified source, captured signals, explicit page type, and notes.
8. `mapping` converts that analysis into Shopify-native section and template intent.
9. `theme_generation` writes the stable page-type-specific Liquid section and JSON template outputs.
10. `store_setup` writes the stable deterministic store setup plan.
11. `commerce_wiring` writes the stable deterministic commerce snippet.
12. `validation` runs after all generated artifacts are written so the result reflects the final workspace.
13. `integration_check` writes the stable deterministic integration report and verifies generated artifacts on disk, commerce entrypoints, section snippet rendering, checkout handoff markup, and final validation state.
14. `review` becomes the terminal human handoff stage when the run succeeds; failures remain structured job results instead of transport failures.
15. The tool result returns the full job snapshot, destination store metadata, artifact metadata, runtime handoff info, and deterministic next actions.

## Hydrogen MCP flow

1. An MCP client connects to `apps/mcp` over stdio or streamable HTTP and calls `replicate_site_to_hydrogen`.
2. `apps/mcp` delegates to `packages/engine`.
3. The engine creates a durable Hydrogen job and runs the pipeline asynchronously.
4. The Hydrogen pipeline stages are:
   - `source_qualification`
   - `playwright_discovery`
   - `figma_import`
   - `figma_design_context`
   - `frontend_spec`
   - `backend_inference`
   - `hydrogen_generation`
   - `workspace_validation`
   - `review`
5. `figma_import` and `figma_design_context` use a live Figma MCP bridge, typically `http://127.0.0.1:3845/mcp`.
6. The generated Hydrogen workspace is written under `generated-sites/<targetId>` by default.
7. The job is reopened through `get_replication_job`, `list_replication_jobs`, or the companion API rather than a single long-lived tool response.

## Companion surfaces

### HTTP API

- `POST /api/jobs` creates a durable job through the shared engine contract.
- `POST /api/hydrogen/jobs` creates a durable Hydrogen job summary through the shared engine contract.
- `GET /api/jobs/:jobId` returns the full persisted job payload.
- `GET /api/jobs?limit=<n>` returns recent job summaries.
- `GET /api/runtime` returns the effective theme workspace path, capture root path, preview command, and configured destination stores.
- `GET /api/destination-stores` returns the configured destination store profiles directly for MCP and UI discovery.

### Web UI

- Provides optional manual intake.
- Polls persisted jobs until they reach `needs_review` or `failed`.
- Requires a configured destination store at intake time.
- Surfaces source qualification, reference capture, generated artifacts, validation, integration, and runtime handoff data for operator QA.

## Runtime defaults

- Job database path: `.data/replicator.db`
- Theme workspace path: `packages/theme-workspace`
- Hydrogen workspace root: `generated-sites`
- Capture root path: `.data/captures`
- Preview command: `shopify theme dev`
- Destination store config path: `config/destination-stores.json`
- Figma MCP endpoint: `http://127.0.0.1:3845/mcp`

Overrides:

- `REPLICATOR_DB_PATH`
- `THEME_WORKSPACE_PATH`
- `REPLICATOR_HYDROGEN_ROOT`
- `REPLICATOR_CAPTURE_ROOT`
- `REPLICATOR_DESTINATION_STORES_PATH`
- `FIGMA_MCP_URL`
- `FIGMA_MCP_AUTH_HEADER_NAME`
- `FIGMA_MCP_AUTH_HEADER_VALUE`
- `FIGMA_MCP_PLAN_KEY`
- `FIGMA_MCP_OUTPUT_MODE`
- `MCP_HTTP_HOST`
- `MCP_HTTP_PORT`
- `MCP_HTTP_PATH`

The destination store config is a local JSON array of objects shaped like:

```json
[
  {
    "id": "local-dev-store",
    "label": "Local Dev Store",
    "shopDomain": "local-dev-store.myshopify.com",
    "themeNamePrefix": "Replicator"
  }
]
```

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

## Supported deterministic page types

- `landing_page`
- `homepage`
- `product_page`
- `collection_page`

## Current capture boundary

- Source qualification and capture use a local Playwright browser session and currently support public Shopify storefront detection only.
- The capture bundle is persisted on disk under the configured capture root instead of inside SQLite blobs.
- The captured snapshot now includes screenshots, style tokens, and route hints, but it is still scoped to deterministic single-route analysis rather than full multi-page parity.
- The operator web UI remains strongest on the theme workflow. Hydrogen review is currently better supported through MCP/API job inspection and the generated workspace on disk.
