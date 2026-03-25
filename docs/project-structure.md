# Project Structure

This document describes every directory and key file in the monorepo.

## Root

```
shopify-web-replicator/
├── apps/
│   ├── api/            # Optional companion HTTP API
│   ├── mcp/            # Primary MCP server (main product surface)
│   └── web/            # Optional companion web UI
├── packages/
│   ├── engine/         # Deterministic replication engine (shared core)
│   ├── shared/         # Shared contracts, types, and pipeline schema
│   └── theme-workspace/ # Shopify theme that receives generated output
├── docs/               # Operator and developer documentation
├── .env.example        # Baseline environment variable reference
├── .nvmrc              # Pinned Node.js version (22.22.0)
├── package.json        # Root workspace scripts and dev dependencies
├── pnpm-workspace.yaml # pnpm workspace definition
└── tsconfig.base.json  # Shared TypeScript compiler base config
```

## apps/mcp — Primary MCP Server

The `stdio` MCP server is the main product interface. Agents call it directly.

```
apps/mcp/
├── src/
│   ├── index.ts              # Entry point; starts the stdio transport
│   ├── server.ts             # MCP server definition and tool registration
│   ├── default-adapter.ts    # Wires the default orchestrator into MCP tools
│   ├── runtime.ts            # Runtime config resolution for the MCP process
│   ├── runtime-preflight.ts  # Fails fast when prerequisites are missing
│   ├── server.test.ts
│   ├── default-adapter.test.ts
│   └── stdio.test.ts
├── package.json
└── tsconfig.json
```

**Exposed MCP tools:**

| Tool | Description |
|---|---|
| `replicate_storefront` | Creates and runs a full replication job synchronously |
| `get_replication_job` | Returns the persisted snapshot for a given job ID |
| `list_replication_jobs` | Returns recent job summaries |

## apps/api — Companion HTTP API

An optional local REST API backed by the same engine. Useful for the companion web app and for scripted inspection.

```
apps/api/
├── src/
│   ├── app.ts                        # Hono app with route definitions
│   ├── index.ts                      # Starts the HTTP server
│   ├── runtime.ts                    # Runtime config for the API process
│   ├── app.test.ts
│   ├── repository/
│   │   ├── in-memory-job-repository.ts   # In-memory repository (test use)
│   │   ├── sqlite-job-repository.ts      # SQLite-backed repository
│   │   └── sqlite-job-repository.test.ts
│   └── services/                     # Re-exports / adapters for engine services
│       ├── commerce-wiring-generator.ts
│       ├── integration-report-generator.ts
│       ├── page-analyzer.ts
│       ├── replication-pipeline.ts
│       ├── store-setup-generator.ts
│       ├── theme-generator.ts
│       ├── theme-mapper.ts
│       ├── theme-validator.ts
│       └── *.test.ts
├── package.json
└── tsconfig.json
```

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/jobs` | Create and run a replication job |
| `GET` | `/api/jobs/:jobId` | Retrieve a full persisted job |
| `GET` | `/api/jobs?limit=<n>` | List recent job summaries |
| `GET` | `/api/runtime` | Return effective theme workspace path and preview command |

## apps/web — Companion Web UI

A local React SPA for human review and debugging. Not the primary product surface.

```
apps/web/
├── index.html
├── src/
│   ├── main.tsx               # React entry point
│   ├── App.tsx                # App shell with sidebar navigation and routes
│   ├── styles.css             # All application styles (single flat CSS file)
│   ├── lib/
│   │   └── api-client.ts      # Typed fetch wrappers for the companion API
│   ├── routes/
│   │   ├── IntakePage.tsx     # Reference URL intake form and recent jobs list
│   │   ├── JobDetailPage.tsx  # Per-job pipeline stage and artifact viewer
│   │   ├── HandoffPage.tsx    # Final handoff view with runtime and next actions
│   │   └── *.test.tsx
│   └── test/
│       └── setup.ts           # Vitest + Testing Library setup
├── vite.config.ts
├── tsconfig.json
└── tsconfig.node.json
```

**Routes:**

| Path | Component | Description |
|---|---|---|
| `/` | `IntakePage` | Submit a new reference URL; browse recent jobs |
| `/jobs/:jobId` | `JobDetailPage` | Inspect pipeline stages, artifacts, and validation for a job |
| `/jobs/:jobId/handoff` | `HandoffPage` | Structured handoff view with runtime info and next actions |
| `/handoff` | `LatestHandoffPage` | Redirects to the most recent job's handoff view |

## packages/engine — Replication Engine

All replication logic lives here. The engine is consumed by both the MCP server and the companion API.

```
packages/engine/
├── src/
│   ├── index.ts                 # Public re-exports
│   ├── orchestrator.ts          # ReplicationOrchestrator — creates and runs jobs
│   ├── runtime.ts               # Default runtime config resolution
│   ├── repository/
│   │   ├── in-memory-job-repository.ts
│   │   └── sqlite-job-repository.ts
│   └── services/
│       ├── page-analyzer.ts             # Derives a typed ReferenceAnalysis from URL + page type
│       ├── theme-mapper.ts              # Converts analysis to Shopify section/template intent
│       ├── theme-generator.ts           # Writes generated-reference Liquid and JSON template files
│       ├── store-setup-generator.ts     # Writes generated-store-setup.json
│       ├── commerce-wiring-generator.ts # Writes generated-commerce-wiring.liquid
│       ├── theme-validator.ts           # Runs `shopify theme check` and captures results
│       ├── integration-report-generator.ts # Writes generated-integration-report.json
│       └── replication-pipeline.ts      # Orchestrates stages in order; persists each transition
├── package.json
└── tsconfig.json
```

**Pipeline stages (in order):**

| Stage | Responsibility |
|---|---|
| `intake` | Reference URL and page type are accepted and normalised |
| `analysis` | `DeterministicPageAnalyzer` derives a typed summary |
| `mapping` | `DeterministicThemeMapper` converts the analysis to section/template intent |
| `theme_generation` | `ShopifyThemeGenerator` writes the page-type Liquid section and JSON template |
| `store_setup` | `ShopifyStoreSetupGenerator` writes the store setup plan |
| `commerce_wiring` | `ShopifyCommerceWiringGenerator` writes the commerce wiring snippet |
| `validation` | `ShopifyThemeValidator` runs `shopify theme check` |
| `integration_check` | `ShopifyIntegrationReportGenerator` writes the integration report |
| `review` | Terminal human handoff stage on success |

## packages/shared — Shared Contracts

Zod schemas, TypeScript types, and pure helper functions consumed by all other packages.

```
packages/shared/
├── src/
│   ├── index.ts   # Re-exports everything
│   └── job.ts     # All domain types, enums, schemas, and createReplicationJob()
├── package.json
└── tsconfig.json
```

**Key exports:**

- `pipelineStages`, `pageTypes`, `artifactKinds`, `jobStatuses` — enum arrays
- `referenceIntakeSchema` — Zod schema for validating tool/API input
- `stableThemeArtifacts`, `stableStoreSetupArtifact`, `stableCommerceArtifact`, `stableIntegrationArtifact` — stable output path constants
- `ReplicationJob`, `ReplicationJobSummary`, `ReferenceAnalysis`, `ThemeMapping`, and all related interfaces
- `createReplicationJob()` — factory that creates a fresh job with pending stages

## packages/theme-workspace — Shopify Theme

A minimal Shopify theme skeleton that receives all generated output. Previewed with `shopify theme dev`.

```
packages/theme-workspace/
├── assets/
│   ├── critical.css
│   ├── icon-account.svg
│   ├── icon-cart.svg
│   └── shoppy-x-ray.svg
├── blocks/
│   ├── group.liquid
│   └── text.liquid
├── config/
│   ├── settings_data.json
│   ├── settings_schema.json
│   ├── generated-store-setup.json      # ← generated output
│   └── generated-integration-report.json # ← generated output
├── layout/
│   ├── theme.liquid
│   └── password.liquid
├── locales/
│   ├── en.default.json
│   └── en.default.schema.json
├── sections/
│   ├── header.liquid
│   ├── footer.liquid
│   ├── product.liquid
│   ├── collection.liquid
│   ├── custom-section.liquid
│   ├── generated-reference.liquid           # ← generated output (landing_page)
│   ├── generated-homepage-reference.liquid  # ← generated output (homepage)
│   ├── generated-product-reference.liquid   # ← generated output (product_page)
│   ├── generated-collection-reference.liquid # ← generated output (collection_page)
│   └── … (404, article, blog, cart, search, …)
├── snippets/
│   ├── css-variables.liquid
│   ├── image.liquid
│   ├── meta-tags.liquid
│   └── generated-commerce-wiring.liquid   # ← generated output
└── templates/
    ├── index.json
    ├── product.json
    ├── collection.json
    ├── page.json
    ├── index.generated-reference.json      # ← generated output (homepage)
    ├── product.generated-reference.json    # ← generated output (product_page)
    ├── collection.generated-reference.json # ← generated output (collection_page)
    ├── page.generated-reference.json       # ← generated output (landing_page)
    └── … (404, article, blog, cart, gift_card, search, …)
```

## docs — Documentation

```
docs/
├── architecture.md        # System boundaries, primary MCP flow, companion surfaces
├── design-context.md      # Design intent, UI palette, data model, conventions
├── mcp-setup.md           # MCP client config, environment overrides, example usage
├── operator-runbook.md    # Review and handoff workflow after a run
├── project-structure.md   # This file — annotated monorepo file tree
└── troubleshooting.md     # Common setup and runtime failures
```

## .github

```
.github/
├── workflows/
│   └── ci.yml                      # CI pipeline (build, test, typecheck, theme check)
├── ISSUE_TEMPLATE/
│   ├── bug_report.yml
│   └── feature_request.yml
└── pull_request_template.md
```

## Package dependency graph

```
packages/shared
    ↑
packages/engine ──────────────────┐
    ↑                             ↑
apps/mcp                      apps/api ← apps/web
```

`packages/shared` has no internal dependencies.
`packages/engine` depends on `packages/shared`.
`apps/mcp` and `apps/api` both depend on `packages/engine` and `packages/shared`.
`apps/web` depends only on `apps/api` at runtime via HTTP.
