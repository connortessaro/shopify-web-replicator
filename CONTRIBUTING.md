# Contributing

Thanks for contributing to Shopify Web Replicator.

## Before you start

- Use Node.js `v22.22.0`.
- Use pnpm `10.30.3`.
- Install Shopify CLI with `npm install -g @shopify/cli@latest`.
- Read [README.md](README.md) and [docs/mcp-setup.md](docs/mcp-setup.md) before changing runtime behavior.

## Local setup

1. Clone the repo.
2. Run `pnpm install --frozen-lockfile --ignore-scripts`.
3. Run `pnpm build`.
4. Run `pnpm theme:check`.
5. Start the surfaces you need:
   `node apps/mcp/dist/index.js`
   `pnpm --filter @shopify-web-replicator/api dev`
   `pnpm --filter @shopify-web-replicator/web dev`

## What to change

- Keep the MCP tool surface small and explicit.
- Prefer deterministic behavior over hidden background automation.
- Treat `apps/mcp` as the stable interface.
- Treat `apps/api` and `apps/web` as optional companion surfaces.
- Do not broaden network exposure by default. The API should stay localhost-bound unless there is a strong reason to change that behavior.

## Verification

Run these commands from the repo root before opening a pull request:

- `pnpm build`
- `pnpm test`
- `pnpm typecheck`
- `pnpm theme:check`

If you changed runtime behavior, also run a manual MCP smoke check against a real public URL and confirm the server reaches a terminal `needs_review` or `failed` result without crashing.

## Pull requests

- Keep pull requests small and focused.
- Add or update tests for behavior changes.
- Update docs when you change setup, runtime defaults, or tool contracts.
- Explain any license-sensitive or security-sensitive changes in the PR description.

## License notes

Unless a file says otherwise, contributions are accepted under the repository root [LICENSE](LICENSE).

The contents of [packages/theme-workspace](packages/theme-workspace) keep their own Shopify license in [packages/theme-workspace/LICENSE.md](packages/theme-workspace/LICENSE.md). Do not replace or remove that separate license.
