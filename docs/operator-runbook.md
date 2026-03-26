# Operator Runbook

## Who this is for

Use this doc after a replication job has already been created and you want to review, QA, and hand off the generated output.

If you only need to install the MCP server or connect a client, start with [docs/mcp-setup.md](mcp-setup.md).

## Goal

Turn a reference URL into deterministic review output, then review the generated artifacts before any preview or publish step. The stable default operator flow is the Shopify theme pipeline. Hydrogen exists as an advanced / beta workflow with a more agent-centric review path.

## Before you start

If you are sharing this repo with someone new:

- Confirm `config/destination-stores.json` exists and has at least one valid destination.
- Confirm you can run `pnpm install` and `pnpm build` on the destination machine.
- Confirm `shopify theme check` succeeds locally before handing off generated output.

## Launch workflow

1. Install dependencies with `pnpm install --frozen-lockfile --ignore-scripts`.
2. Build the workspace with `pnpm build`.
3. Run `pnpm typecheck`.
4. Run `pnpm test`.
5. Run `pnpm theme:check` and confirm the workspace is clean.
6. Start the MCP server with `node apps/mcp/dist/index.js`.
7. Submit a reference URL with `replicate_site_to_theme` from your MCP client.
8. Review the returned `needs_review` payload, generated artifact paths, validation output, integration output, and `nextActions`.
9. Run `shopify theme dev` in the configured theme workspace.

## Review checklist

Confirm the run produced:

- the expected page type
- generated section and template artifacts
- a valid `config/generated-store-setup.json`
- a valid `snippets/generated-commerce-wiring.liquid`
- a valid `config/generated-integration-report.json`
- a terminal `needs_review` or `failed` result instead of a transport crash

Then verify:

- layout and content structure in `shopify theme dev`
- CTA behavior
- add-to-cart behavior
- native Shopify checkout handoff
- that the store setup plan still matches the generated theme output
- that the captured screenshots and route/style signals look consistent with the source

## Advanced Hydrogen review

Use this path when the job was created with `replicate_site_to_hydrogen` or `POST /api/hydrogen/jobs`.

1. Reopen the job through `get_replication_job` or the API.
2. Confirm the job reached `review` or a structured failure stage rather than a transport crash.
3. Inspect the Hydrogen workspace under `generated-sites/<targetId>`.
4. Review the pipeline outputs:
   - `playwright_discovery`
   - `figma_import`
   - `figma_design_context`
   - `backend_inference`
   - `workspace_validation`
5. Treat Hydrogen review as advanced / beta. The web UI is not yet the primary review surface for this workflow.

## Optional companion surfaces

- `pnpm --filter @shopify-web-replicator/api dev`
- `pnpm --filter @shopify-web-replicator/web dev`

Use these for local review and operator convenience. Do not treat them as the primary product contract.

## Secure defaults

- The companion API binds to `127.0.0.1` by default.
- The companion API only allows localhost-style origins unless `REPLICATOR_ALLOWED_ORIGINS` is explicitly set.
- If the runtime is missing `node:sqlite`, Shopify CLI, a writable database parent directory, or a writable theme workspace, the MCP server returns a structured preflight error before replication begins.

## Current limits

- The generator currently supports `landing_page`, `homepage`, `product_page`, and `collection_page`.
- The generator writes stable generated section and template outputs for the selected page type plus deterministic store setup, commerce wiring, and integration report artifacts.
- The pipeline now performs browser-backed source qualification and capture, including screenshots and route/style signals, but it is still not a full multi-page crawler.
- Store setup remains a planning output; products, collections, navigation, and structured content are not pushed to Shopify automatically in this slice.
- Commerce wiring remains a deterministic planning and QA output; no live checkout automation or custom checkout implementation is added in this slice.
- Publishing decisions remain manual after operator review.
- Hydrogen remains an advanced / beta workflow and is currently better reviewed through MCP/API job inspection plus the generated workspace on disk.

## Recovery

- If you need a fresh job database, delete `.data/replicator.db` and rerun the workflow.
- If `shopify theme check` fails, install or upgrade Shopify CLI with `npm install -g @shopify/cli@latest`.
- If the theme workspace contains stale output, rerun `pnpm build` before starting the MCP server again.
- If replication fails before a job reaches a terminal state, see [docs/troubleshooting.md](troubleshooting.md).
