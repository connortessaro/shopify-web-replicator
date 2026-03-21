# Shopify Web Replicator

Shopify Web Replicator is a Liquid-first monorepo for turning a reference storefront page into a deterministic Shopify theme handoff. The current pipeline persists jobs locally, derives a predictable analysis and mapping from the intake URL, page type, and notes, and writes stable generated theme output plus deterministic store setup and commerce wiring plans into the Shopify theme workspace for operator review.

## Workspace layout

- `apps/web`: operator dashboard for reference intake, job status, and handoff
- `apps/api`: local API for durable jobs and deterministic analysis, mapping, theme generation, store setup planning, and commerce wiring
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

## Current flow

- Intake creates a durable job record in SQLite.
- Intake accepts explicit page types for `landing_page`, `homepage`, `product_page`, and `collection_page`.
- The operator dashboard shows recent jobs so work can be resumed without manually tracking job IDs.
- The API auto-runs a deterministic local pipeline through `analysis`, `mapping`, `theme_generation`, `store_setup`, `commerce_wiring`, `integration_check`, and `review`.
- Theme generation overwrites stable page-type-specific outputs, including:
  `sections/generated-reference.liquid`
  `sections/generated-homepage-reference.liquid`
  `sections/generated-product-reference.liquid`
  `sections/generated-collection-reference.liquid`
- Matching alternate templates are generated in:
  `templates/page.generated-reference.json`
  `templates/index.generated-reference.json`
  `templates/product.generated-reference.json`
  `templates/collection.generated-reference.json`
- Store setup planning writes the stable artifact:
  `config/generated-store-setup.json`
- Commerce wiring writes the stable artifact:
  `snippets/generated-commerce-wiring.liquid`
- Integration checks write the stable artifact:
  `config/generated-integration-report.json`
- The job payload now carries typed store setup, commerce wiring, and integration report plans so the operator can confirm the generated files remain internally consistent before preview.
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
2. Open the web app, choose the reference page type, submit the reference URL, and watch the job detail page advance through the deterministic stages.
3. Use the Recent Jobs panel to reopen the job or jump directly to `/jobs/:jobId/handoff`.
4. Review the generated artifacts, validation output, store setup plan, commerce wiring plan, and integration report in the handoff view.
5. Run `shopify theme dev` inside the configured theme workspace and verify layout parity, content wiring, planned products and collections, CTA behavior, add-to-cart behavior, and cart-to-checkout handoff.

## Current limits

- The pipeline is deterministic and local-only; it does not live-crawl or screenshot the reference site.
- The current analysis requires one of the supported page types and writes only the stable generated section, template, store setup plan, commerce snippet, and integration report outputs for that type.
- Store setup is still planning output, not Shopify Admin automation or import execution.
- Commerce wiring is deterministic and native-route-based; it does not automate live checkout flows or Shopify Admin configuration.
- Multi-page replication and checkout customization are not part of this slice.
