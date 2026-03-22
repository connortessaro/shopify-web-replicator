# Shopify Web Replicator

Shopify Web Replicator is a local MCP server that turns a reference storefront URL into a deterministic Shopify theme handoff. It is built for agent-driven workflows where you want a stable, repeatable Shopify output instead of an opaque scraper or a hosted black box.

The primary interface is the MCP server in `apps/mcp`. The API and web app are optional companion surfaces for local review and debugging.

## What you get

- A small MCP tool surface: `replicate_storefront`, `get_replication_job`, and `list_replication_jobs`
- Deterministic generated theme artifacts written into a local Shopify theme workspace
- Store setup, commerce wiring, and integration report artifacts for the selected page type
- Structured terminal output that ends in `needs_review` or `failed`
- Local-first runtime defaults with explicit preflight failures for missing prerequisites

## What this is not

- Not a hosted SaaS
- Not a visual site copier
- Not a live DOM scraper or screenshot pipeline
- Not Shopify Admin automation
- Not multi-page replication or checkout customization

If you want a stable local MCP workflow for Shopify handoff generation, this repo is ready to share and use. If you want browser-grade visual cloning, this is the wrong tool.

## Prerequisites

- Node.js `v22.22.0`
- pnpm `10.30.3`
- Shopify CLI installed globally with `npm install -g @shopify/cli@latest`
- A writable local checkout for `.data/` and `packages/theme-workspace`

## Quick start

1. Clone the repo.
2. Run `pnpm install --frozen-lockfile --ignore-scripts`.
3. Run `pnpm build`.
4. Run `pnpm theme:check`.
5. Start the MCP server with `node apps/mcp/dist/index.js`.
6. Configure your MCP client with the example in [docs/mcp-setup.md](docs/mcp-setup.md).

For local development, `pnpm dev` starts the shared package watches plus the API, web app, and MCP server.

## Example MCP call

```json
{
  "name": "replicate_storefront",
  "arguments": {
    "referenceUrl": "https://www.nike.com/",
    "pageType": "homepage",
    "notes": "Preserve the hero hierarchy and primary call to action."
  }
}
```

Typical result:

- `status: "needs_review"`
- `currentStage: "review"`
- generated artifact paths
- `themeWorkspacePath`
- `previewCommand: "shopify theme dev"`
- deterministic `nextActions`

## Operational guarantees

- The MCP server fails fast with structured runtime-preflight errors when Node does not support `node:sqlite`, Shopify CLI is missing, the DB directory is unwritable, or the theme workspace is unavailable.
- The verification bar is `pnpm build`, `pnpm test`, `pnpm typecheck`, and `pnpm theme:check`.
- The companion API binds to `127.0.0.1` by default and only allows localhost-style origins unless you explicitly override them.
- The MCP tool contract is intentionally small and stable.

## Runtime defaults

- `REPLICATOR_DB_PATH`
  Default: `.data/replicator.db`
- `THEME_WORKSPACE_PATH`
  Default: `packages/theme-workspace`
- `HOST`
  Default: `127.0.0.1` for the companion API
- `PORT`
  Default: `8787` for the companion API
- `REPLICATOR_ALLOWED_ORIGINS`
  Default: localhost and `127.0.0.1` origins for ports `5173`, `4173`, and `8787`
- `VITE_API_BASE_URL`
  Default: `http://127.0.0.1:8787` for the companion web app

See [.env.example](.env.example) for a working baseline.

## Generated artifacts

The deterministic pipeline writes these stable outputs:

- `sections/generated-reference.liquid`
- `sections/generated-homepage-reference.liquid`
- `sections/generated-product-reference.liquid`
- `sections/generated-collection-reference.liquid`
- `templates/page.generated-reference.json`
- `templates/index.generated-reference.json`
- `templates/product.generated-reference.json`
- `templates/collection.generated-reference.json`
- `config/generated-store-setup.json`
- `snippets/generated-commerce-wiring.liquid`
- `config/generated-integration-report.json`

## Optional companion surfaces

- `apps/api`: optional HTTP API backed by the same engine
- `apps/web`: optional local UI for intake, job review, and handoff

Use them when you want a browser-based review loop. Do not treat them as the primary product contract.

## Repository layout

- `apps/mcp`: stdio MCP server
- `apps/api`: optional companion API
- `apps/web`: optional companion web app
- `packages/engine`: deterministic replication engine
- `packages/shared`: shared contracts and pipeline types
- `packages/theme-workspace`: Shopify theme workspace that receives generated output

## More docs

- [docs/mcp-setup.md](docs/mcp-setup.md): client config, environment overrides, and example usage
- [docs/operator-runbook.md](docs/operator-runbook.md): review and handoff workflow after a run
- [docs/troubleshooting.md](docs/troubleshooting.md): common setup and runtime failures
- [CONTRIBUTING.md](CONTRIBUTING.md): contribution workflow and verification expectations
- [SECURITY.md](SECURITY.md): vulnerability reporting

## Contributing and license

The root repository is licensed under [LICENSE](LICENSE), except for [packages/theme-workspace/LICENSE.md](packages/theme-workspace/LICENSE.md), which keeps its own Shopify license.
