# Shopify Web Replicator

Shopify Web Replicator is a Liquid-first monorepo for turning a reference landing page into a deterministic Shopify theme handoff. The current Milestone 1 pipeline persists jobs locally, derives a predictable analysis and mapping from the intake URL and notes, and writes stable generated output into the Shopify theme workspace for operator review.

## Workspace layout

- `apps/web`: operator dashboard for reference intake, job status, and handoff
- `apps/api`: local API for durable jobs and deterministic analysis, mapping, and theme generation
- `packages/shared`: shared contracts and pipeline types used by the app and API
- `packages/theme-workspace`: Shopify theme workspace that receives generated output

## Scripts

- `pnpm dev`: build shared contracts, then start shared watch, API, and web app
- `pnpm build`: build shared contracts, API, and web app
- `pnpm typecheck`: run TypeScript checks across the app and packages
- `pnpm test`: run shared, API, and web tests in sequence
- `pnpm theme:check`: run Shopify theme validation on the local theme workspace

## Runtime configuration

- `REPLICATOR_DB_PATH`: overrides the SQLite job database path
  Default: `.data/replicator.db`
- `THEME_WORKSPACE_PATH`: overrides the Shopify theme workspace path
  Default: `packages/theme-workspace`

## Current Milestone 1 flow

- Intake creates a durable job record in SQLite.
- The API auto-runs a deterministic local pipeline through `analysis`, `mapping`, `theme_generation`, and `review`.
- Theme generation overwrites the stable outputs:
  `sections/generated-reference.liquid`
  `templates/page.generated-reference.json`
- The operator dashboard polls job state until the run reaches `needs_review` or `failed`.

## Theme handoff

The Shopify theme is kept separate from the generator logic. Generated sections, snippets, and templates should land in `packages/theme-workspace`, where they can be previewed locally with Shopify CLI and pushed to a store later.
