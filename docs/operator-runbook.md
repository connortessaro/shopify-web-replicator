# Operator Runbook

## Goal

Use the local MCP server to turn a reference URL into deterministic Shopify theme output, a store setup plan, a commerce wiring plan, and an integration report, then review the generated theme workspace before any store preview or publish step. The API and web app are optional companion surfaces, not the primary contract.

## Launch workflow

1. Install dependencies with `pnpm install --frozen-lockfile --ignore-scripts`.
2. Build the workspace with `pnpm build`.
3. Run `pnpm typecheck`.
4. Run `pnpm test`.
5. Run `pnpm theme:check` and confirm the workspace is clean.
6. Start the MCP server with `node apps/mcp/dist/index.js`.
7. Submit a reference URL with `replicate_storefront` from your MCP client.
8. Review the returned `needs_review` payload, generated artifact paths, validation output, integration output, and `nextActions`.
9. Run `shopify theme dev` in the configured theme workspace.
10. Verify the generated theme for layout parity, content structure, planned merchandising setup, CTA behavior, add-to-cart behavior, and native Shopify checkout handoff.
11. Use the generated `config/generated-store-setup.json` plan as the operator checklist for store-side setup before any publish step.
12. Use the generated `snippets/generated-commerce-wiring.liquid` plan and the MCP handoff payload to confirm cart and checkout behavior before any publish step.
13. Use the generated `config/generated-integration-report.json` report to confirm the theme, store setup, and commerce outputs still line up before preview or publish.

## Optional companion surfaces

- `pnpm --filter @shopify-web-replicator/api dev`
- `pnpm --filter @shopify-web-replicator/web dev`
- Use these for local review and operator convenience.
- Do not treat them as part of the MCP contract.

## Secure defaults

- The companion API binds to `127.0.0.1` by default.
- The companion API only allows localhost-style origins unless `REPLICATOR_ALLOWED_ORIGINS` is explicitly set.
- If the runtime is missing `node:sqlite`, Shopify CLI, a writable database parent directory, or a writable theme workspace, the MCP server returns a structured preflight error before replication begins.

## Current limits

- The generator currently supports `landing_page`, `homepage`, `product_page`, and `collection_page`.
- The generator writes the stable generated section and template outputs for the selected page type plus deterministic store setup, commerce wiring, and integration report artifacts.
- The pipeline does not fetch live DOM structure, screenshots, product data, or collection data.
- Store setup remains a planning output; products, collections, navigation, and structured content are not pushed to Shopify automatically in this slice.
- Commerce wiring remains a deterministic planning and QA output; no live checkout automation or custom checkout implementation is added in this slice.
- Publishing decisions remain manual after operator review.

## Recovery

- If you need a fresh job database, delete `.data/replicator.db` and rerun the workflow.
- If `shopify theme check` fails, install or upgrade Shopify CLI with `npm install -g @shopify/cli@latest`.
- If the theme workspace contains stale output, rerun `pnpm build` before starting the MCP server again.
