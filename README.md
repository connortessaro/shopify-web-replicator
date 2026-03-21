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
- The operator dashboard shows recent jobs so work can be resumed without manually tracking job IDs.
- The API auto-runs a deterministic local pipeline through `analysis`, `mapping`, `theme_generation`, and `review`.
- Theme generation overwrites the stable outputs:
  `sections/generated-reference.liquid`
  `templates/page.generated-reference.json`
- The operator dashboard polls job state until the run reaches `needs_review` or `failed`, then exposes a job-scoped handoff view.

## Operator endpoints

- `POST /api/jobs`: create a replication job and start the deterministic pipeline
- `GET /api/jobs/:jobId`: load the full job record, including stages, artifacts, validation, analysis, and mapping
- `GET /api/jobs?limit=<n>`: load recent job summaries for the intake and handoff flows
- `GET /api/runtime`: load the effective theme workspace path and preview command used by the handoff view

## Theme handoff

The Shopify theme is kept separate from the generator logic. Generated sections, snippets, and templates land in the configured theme workspace, where they can be previewed locally with Shopify CLI and pushed to a store later.

## Operator runbook

1. Start the repo locally with `pnpm dev`.
2. Open the web app, submit a reference URL, and watch the job detail page advance through the deterministic stages.
3. Use the Recent Jobs panel to reopen the job or jump directly to `/jobs/:jobId/handoff`.
4. Review the generated artifacts and validation output in the handoff view.
5. Run `shopify theme dev` inside the configured theme workspace and verify layout parity, content wiring, CTA behavior, and cart-to-checkout handoff.

## Known Milestone 1 limits

- The pipeline is deterministic and local-only; it does not live-crawl or screenshot the reference site.
- The current analysis assumes a landing-page-style reference and writes only the stable generated section and template outputs.
- Store setup automation, multi-page replication, and checkout customization are not part of this slice.
