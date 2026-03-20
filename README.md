# Shopify Web Replicator

Shopify Web Replicator is a Liquid-first monorepo for inspecting reference storefronts, mapping them into Shopify theme structures, and preparing generated theme output for merchant handoff.

## Workspace layout

- `apps/web`: operator dashboard for reference intake, job status, and handoff
- `apps/api`: local API for jobs, parsing, and future generation flows
- `packages/shared`: shared contracts and pipeline types used by the app and API
- `packages/theme-workspace`: Shopify theme workspace that receives generated output

## Scripts

- `pnpm dev`: build shared contracts, then start shared watch, API, and web app
- `pnpm build`: build shared contracts, API, and web app
- `pnpm typecheck`: run TypeScript checks across the app and packages
- `pnpm test`: run shared, API, and web tests in sequence
- `pnpm theme:check`: run Shopify theme validation on the local theme workspace

## Theme handoff

The Shopify theme is kept separate from the generator logic. Generated sections, snippets, and templates should land in `packages/theme-workspace`, where they can be previewed locally with Shopify CLI and pushed to a store later.

