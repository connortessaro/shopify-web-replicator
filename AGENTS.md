# Team Guide for `shopify-web-replicator`

This guide is intentionally practical. It is meant for people who will be reading or contributing quickly, with enough structure to be clear without adding ceremony.

## Scope and Workflow

- Repository root: `/Users/tessaro/shopify-web-replicator`
- The repo is a monorepo with these primary surfaces:
  - `apps/mcp` (agent-facing MCP server)
  - `apps/api` (HTTP companion service)
  - `apps/web` (operator review UI)
  - `packages/engine` (core pipeline and orchestration)
  - `packages/shared` (shared contracts and schemas)
  - `packages/theme-workspace` (deterministic theme outputs)

## What to do first

1. Read `README.md` and `docs/architecture.md` for flow context.
2. Use `docs/mcp-setup.md` for MCP wiring and environment values.
3. Use `docs/operator-runbook.md` for human review and handoff flow.
4. Use `docs/agent-runbook.md` for agent workflow, tool ordering, and recovery.
5. Keep docs edits minimal and keep generated theme artifacts changes intentional.

## Required MCPs for this repo

- `shopify-web-replicator` (local MCP server from this repo)
- Figma MCP (`codex mcp add figma --url https://mcp.figma.com/mcp`)
- Figma Dev MCP tools (`mcp__figma__*` in this environment)
- Chrome DevTools MCP (`codex mcp add chrome-devtools -- npx chrome-devtools-mcp@latest`)
- Shopify Dev MCP tools (`mcp__shopify_dev_mcp__*` in this environment)
- Playwright browser toolset (for capture diagnostics and verification)

The local MCP server supports both stdio and streamable HTTP. Use streamable HTTP for GUI MCP clients that need `/mcp`, and stdio for local CLI-style clients.

Current MCP tool surface:

- `replicate_site_to_theme`
- `replicate_site_to_hydrogen`
- `get_replication_job`
- `list_replication_jobs`
- `list_destination_stores`

## Required skills for this repo

- `test-driven-development` for safe contract and pipeline evolution
- `agent-systems` for orchestrating capture → design handoff → generation → backend planning
- `frontend-and-design` when working on Figma-backed frontend reconstruction
- `webapp-testing` for parity validation and regression checks
- `systematic-debugging` for layout/capture mismatch triage
- `developer-operations` for MCP/runtime service reliability work

## Runbook for local changes

- `pnpm install` (or `pnpm install --frozen-lockfile --ignore-scripts` when you need strict mode)
- `pnpm --filter @shopify-web-replicator/engine test`
- `pnpm --filter @shopify-web-replicator/api test`
- `pnpm --filter @shopify-web-replicator/web test`
- `pnpm --filter @shopify-web-replicator/shared test`
- `pnpm build`
- `pnpm typecheck`

If you touched anything under `packages/theme-workspace`, run:
- `pnpm theme:check`

## Sharing and contribution style

- Keep API/MCP behavior stable unless there is a test-backed reason to change it.
- Prefer small, reviewable diffs. If a doc cleanup is all that changed, keep it that way.
- Add edge-case tests for failures and malformed input when touching `apps/api`, `apps/web`, or shared contracts.
- For non-critical copy and wording updates, avoid rewriting broad structure; keep intent and behavior stable.
- Don’t commit secrets, keys, or environment files with credentials.

## Local runtime defaults

- `THEME_WORKSPACE_PATH` (default: `packages/theme-workspace`)
- `REPLICATOR_HYDROGEN_ROOT` (default: `generated-sites`)
- `REPLICATOR_DB_PATH` (default: `.data/replicator.db`)
- `REPLICATOR_CAPTURE_ROOT` (default: `.data/captures`)
- `REPLICATOR_DESTINATION_STORES_PATH` (default: `config/destination-stores.json`)
- `FIGMA_MCP_URL` (default: `http://127.0.0.1:3845/mcp`)
- `MCP_HTTP_PATH` (default: `/mcp`)

## Safety defaults

- Keep localhost assumptions for companion services unless a task explicitly asks for external exposure.
- API defaults are conservative for CORS and local-only origins; use explicit overrides for non-local tooling.

## Workflow stance

- Theme is the stable default workflow.
- Hydrogen is an advanced / beta workflow that depends on the Figma bridge and is currently more MCP/API-first than web-UI-first.
- For operational agent behavior, use `docs/agent-runbook.md` instead of expanding this file into a full runbook.
