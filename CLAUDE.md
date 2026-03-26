# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
pnpm install --frozen-lockfile --ignore-scripts

# Build all packages (order matters: shared → engine → api/web/mcp)
pnpm build

# Run all tests
pnpm test

# Type-check all packages
pnpm typecheck

# Lint Shopify theme files
pnpm theme:check

# Full verification bar (run before committing)
pnpm build && pnpm test && pnpm typecheck && pnpm theme:check

# Dev mode (starts all watchers and servers in parallel)
pnpm dev

# Run tests for a single package
pnpm --filter @shopify-web-replicator/engine test
pnpm --filter @shopify-web-replicator/api test
pnpm --filter @shopify-web-replicator/mcp test
pnpm --filter @shopify-web-replicator/shared test

# Run a single test file
pnpm --filter @shopify-web-replicator/engine exec vitest run src/orchestrator.test.ts
```

## Architecture

This is a pnpm monorepo. Build order is strict: `shared` must be built before `engine`, and `engine` before `api`/`mcp`.

### Package roles

- **`packages/shared`** — All shared types, Zod schemas, and the `createReplicationJob` factory. The `ReplicationJob` type and all pipeline stage/status enums live here. This is the single source of truth for the data contract.

- **`packages/engine`** — The deterministic replication engine. Contains `ReplicationOrchestrator` (the public API), `ReplicationPipeline` (step-by-step execution), and concrete service implementations (`DeterministicPageAnalyzer`, `DeterministicThemeMapper`, `ShopifyThemeGenerator`, `ShopifyStoreSetupGenerator`, `ShopifyCommerceWiringGenerator`, `ShopifyThemeValidator`, `ShopifyIntegrationReportGenerator`). All services depend on interfaces defined in `src/services/types.ts`, enabling injection of test doubles.

- **`apps/mcp`** — The primary product surface. A stdio MCP server exposing three tools: `replicate_site_to_theme`, `get_replication_job`, `list_replication_jobs`. Entry point is `apps/mcp/src/index.ts`. The server logic is in `server.ts`; runtime preflight checks (Node sqlite support, Shopify CLI presence, writable paths) live in `runtime-preflight.ts`.

- **`apps/api`** — Optional companion HTTP API (Hono on `@hono/node-server`). Binds to `127.0.0.1:8787` by default. Routes: `POST /api/jobs`, `GET /api/jobs/:jobId`, `GET /api/jobs`, `GET /api/runtime`. Note: `apps/api/src/` contains its own copies of the engine services (not imported from `packages/engine`) — this is intentional duplication for the standalone API surface.

- **`apps/web`** — Optional companion React/Vite frontend for local job review. Communicates with `apps/api`.

- **`packages/theme-workspace`** — The Shopify theme directory that receives all generated artifacts. Has its own Shopify license.

### Pipeline flow

`ReplicationOrchestrator.replicateStorefront()` → `ReplicationPipeline.process()` runs these stages in order:

1. `intake` (pre-completed on job creation)
2. `analysis` — `DeterministicPageAnalyzer`
3. `mapping` — `DeterministicThemeMapper`
4. `theme_generation` — `ShopifyThemeGenerator` (writes `.liquid` + `.json` to theme workspace)
5. `store_setup` — `ShopifyStoreSetupGenerator` (writes `config/generated-store-setup.json`)
6. `commerce_wiring` — `ShopifyCommerceWiringGenerator` (writes `snippets/generated-commerce-wiring.liquid`)
7. `validation` — `ShopifyThemeValidator` (runs `shopify theme check`)
8. `integration_check` — `ShopifyIntegrationReportGenerator` (writes `config/generated-integration-report.json`)
9. `review` — terminal `needs_review` state

Job state is persisted to SQLite (`.data/replicator.db`) after each stage via `SqliteJobRepository`.

### Key design constraints

- The `apps/api` services are duplicated from `packages/engine` — changes to engine service logic may need to be mirrored in `apps/api/src/services/`.
- All generated artifact paths are stable constants defined in `packages/shared/src/job.ts` (`stableThemeArtifacts`, `stableStoreSetupArtifact`, `stableCommerceArtifact`, `stableIntegrationArtifact`).
- The MCP server runs preflight checks on every tool call; failures surface as structured `RuntimePreflightError` with typed `issues`.
- Page type is auto-derived from URL path when not provided (`/` → `homepage`, `/products/*` → `product_page`, `/collections/*` → `collection_page`, else `landing_page`).

### Environment variables

| Variable | Default |
|---|---|
| `REPLICATOR_DB_PATH` | `.data/replicator.db` |
| `THEME_WORKSPACE_PATH` | `packages/theme-workspace` |
| `HOST` | `127.0.0.1` |
| `PORT` | `8787` |
| `REPLICATOR_ALLOWED_ORIGINS` | localhost/127.0.0.1 on ports 5173, 4173, 8787 |
| `VITE_API_BASE_URL` | `http://127.0.0.1:8787` |
