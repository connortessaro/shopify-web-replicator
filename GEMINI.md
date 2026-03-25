# GEMINI.md

## Project Context
Shopify Web Replicator is a monorepo containing a replication engine, an MCP server, a companion API, and a React frontend. It automates the replication of Shopify storefronts into a local theme workspace.

## Critical Mandates
- **Build Order:** You MUST build packages in the following order: `packages/shared` → `packages/engine` → `apps/api` | `apps/web` | `apps/mcp`.
- **Logic Duplication:** `apps/api/src/services/` contains intentional duplicates of services in `packages/engine`. When modifying engine logic, you MUST check if the corresponding service in `apps/api` needs mirroring.
- **Stable Artifacts:** Never change the filenames of generated artifacts defined as constants in `packages/shared/src/job.ts`.
- **Preflight Checks:** The MCP server (`apps/mcp`) runs preflight checks on every tool call. Ensure any new dependencies or system requirements are added to `runtime-preflight.ts`.

## Development Workflows

### Build & Verify
- **Full Verification:** `pnpm build && pnpm test && pnpm typecheck && pnpm theme:check`
- **Install:** `pnpm install --frozen-lockfile --ignore-scripts`
- **Build All:** `pnpm build`
- **Type-check:** `pnpm typecheck`
- **Theme Linting:** `pnpm theme:check`

### Testing
- **Run All Tests:** `pnpm test`
- **Package Specific:** `pnpm --filter <package-name> test` (e.g., `@shopify-web-replicator/engine`)
- **Single File:** `pnpm --filter <package-name> exec vitest run <path-to-test>`

### Local Execution
- **Dev Mode:** `pnpm dev` (starts watchers and servers in parallel)
- **Database:** SQLite is used, located at `.data/replicator.db` by default.

## Architectural Patterns
- **Services:** All services depend on interfaces in `src/services/types.ts` to allow for easy testing with doubles.
- **Persistence:** `SqliteJobRepository` handles job state persistence after each pipeline stage.
- **Pipeline:** Deterministic sequence: `intake` → `analysis` → `mapping` → `theme_generation` → `store_setup` → `commerce_wiring` → `validation` → `integration_check` → `review`.

## Environment Variables
| Variable | Default | Purpose |
|---|---|---|
| `REPLICATOR_DB_PATH` | `.data/replicator.db` | SQLite database path |
| `THEME_WORKSPACE_PATH` | `packages/theme-workspace` | Target Shopify theme directory |
| `REPLICATOR_CAPTURE_ROOT` | `.data/captures` | Playwright capture storage |
| `PORT` | `8787` | API server port |
