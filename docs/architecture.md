# Architecture

## Intent

This repo is built around a standalone MCP server that agents can call directly. The MCP server, companion API, and companion web app all share the same deterministic replication engine so the product can improve behind one domain model and one pipeline.

## Boundaries

- `apps/mcp` owns the primary agent-facing stdio server and MCP tool registration.
- `packages/engine` owns runtime config, SQLite persistence, orchestration, analysis, mapping, generation, store setup planning, commerce wiring, validation, and integration reporting.
- `apps/api` owns the companion HTTP surface and delegates job creation and execution to the engine.
- `apps/web` owns the companion human review surface and consumes the API.
- `packages/shared` owns the contract shared across MCP, API, web, and engine.
- `packages/theme-workspace` owns the Shopify-native output that gets previewed with Shopify CLI.

## Primary MCP flow

1. An MCP client spawns `apps/mcp` over stdio.
2. The client calls `replicate_storefront` with `referenceUrl`, optional `pageType`, and optional `notes`.
3. `apps/mcp` delegates to `packages/engine`.
4. The engine creates a durable SQLite job and runs the deterministic pipeline synchronously for the tool call.
5. `analysis` derives a typed summary from the reference URL, explicit page type, and notes.
6. `mapping` converts that analysis into Shopify-native section and template intent.
7. `theme_generation` writes the stable page-type-specific Liquid section and JSON template outputs.
8. `store_setup` writes the stable deterministic store setup plan.
9. `commerce_wiring` writes the stable deterministic commerce snippet.
10. `validation` runs after all generated artifacts are written so the result reflects the final workspace.
11. `integration_check` writes the stable deterministic integration report and verifies generated artifacts on disk, commerce entrypoints, section snippet rendering, checkout handoff markup, and final validation state.
12. `review` becomes the terminal human handoff stage when the run succeeds; failures remain structured job results instead of transport failures.
13. The tool result returns the full job snapshot, artifact metadata, runtime handoff info, and deterministic next actions.

## Companion surfaces

### HTTP API

- `POST /api/jobs` creates a durable job through the shared engine contract.
- `GET /api/jobs/:jobId` returns the full persisted job payload.
- `GET /api/jobs?limit=<n>` returns recent job summaries.
- `GET /api/runtime` returns the effective theme workspace path and preview command.

### Web UI

- Provides optional manual intake.
- Polls persisted jobs until they reach `needs_review` or `failed`.
- Surfaces generated artifacts, validation, integration, and runtime handoff data for operator QA.

## Runtime defaults

- Job database path: `.data/replicator.db`
- Theme workspace path: `packages/theme-workspace`
- Preview command: `shopify theme dev`

Overrides:

- `REPLICATOR_DB_PATH`
- `THEME_WORKSPACE_PATH`

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
