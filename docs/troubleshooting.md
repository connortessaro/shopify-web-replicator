# Troubleshooting

## `The current Node runtime does not support node:sqlite`

Use Node `v22.22.0` from [.nvmrc](../.nvmrc), then rebuild:

1. `pnpm install --frozen-lockfile --ignore-scripts`
2. `pnpm build`

## `Shopify CLI is required for replication and theme validation`

Install or upgrade Shopify CLI:

`npm install -g @shopify/cli@latest`

Then re-run:

- `pnpm theme:check`
- your MCP call

## `Database path parent directory is not writable`

Point `REPLICATOR_DB_PATH` at a writable location or fix permissions on the parent directory.

Example:

`REPLICATOR_DB_PATH=.data/replicator.db`

## `Theme workspace path does not exist`

Use a valid theme workspace path or keep the default:

`THEME_WORKSPACE_PATH=packages/theme-workspace`

Then re-run `pnpm build` and start the MCP server again.

## API requests fail from another machine or browser tab

The companion API is intentionally localhost-bound and only allows localhost-style origins by default.

If you need to override that for a trusted local setup:

- set `HOST`
- set `REPLICATOR_ALLOWED_ORIGINS`
- treat that as an explicit security decision

## Tests show `SQLite is an experimental feature`

Node currently prints an experimental warning for `node:sqlite`. The warning is expected on the pinned runtime and does not indicate a failing test by itself.

## The generated output does not visually match the source site

That is expected with today’s deterministic pipeline.

Current sources of mismatch:

- Route structure is inferred (not full DOM replay): the generated theme uses a stable template, then injects captured content signals.
- Dynamic storefront behavior is sampled, not replayed: storefront JS may load additional content after capture.
- Device-viewport assumptions can shift layout substantially.
- Cookie/consent overlays can be captured as top-layer elements.
- Bot-protection/abuse challenge pages can be captured if the store enforces stricter browser fingerprints.

Mitigations:

1. Capture in a clean, unblocked environment (same machine/IP, no heavy local traffic shaping).
2. Re-run with the updated Playwright hardening path (reduced motion, stable viewport, image-load waiting, overlay suppression).
3. Use Chrome DevTools MCP for side-by-side route inspection:
   - start `chrome-devtools` with `codex mcp add chrome-devtools -- npx chrome-devtools-mcp@latest`
   - confirm the rendered source URL and status code
   - confirm first meaningful paint is not blocked by consent overlays
   - compare network waterfall for critical CSS/fonts/scripts
4. If still diverging, set `REPLICATOR_PLAYWRIGHT_HEADLESS=false` once and retake the capture to compare against a visible browser session.
5. If still diverging, capture a fresh route after explicit `pageType` is set in the intake UI/MCP so the theme generator uses the intended stable page template.
6. If the source is still not represented by captured structure or if anti-bot pages are returned, capture is currently only a best-effort signal and cannot guarantee byte-level visual parity.

## I only want the MCP server

That is the main supported path.

You can ignore:

- `apps/api`
- `apps/web`

Use [docs/mcp-setup.md](mcp-setup.md) and the built MCP server entrypoint.
