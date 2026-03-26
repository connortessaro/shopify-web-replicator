# MCP Setup

## Purpose

This repo ships a local MCP server so agent clients can call the replication engine directly over either stdio or streamable HTTP.

## Quick onboarding

- Duplicate the destination-store template:
  - `cp config/destination-stores.example.json config/destination-stores.json`
- Run local dependency install and build:
  - `pnpm install`
  - `pnpm build`
- Launch MCP after the build:
  - `node apps/mcp/dist/index.js`

For GUI MCP clients such as Codex, you can instead launch the streamable HTTP entrypoint:

- `node apps/mcp/dist/http.js`

## Build and launch

From the repo root:

1. `pnpm install`
2. `pnpm build`
3. Launch the server with:
   `node apps/mcp/dist/index.js`

The browser-backed source qualification and capture flow requires a local Playwright runtime. If Chromium is unavailable, replication fails structurally at `source_qualification` instead of falling back silently.

For active development you can also run:

- `pnpm --filter @shopify-web-replicator/mcp dev`

## Streamable HTTP launch

From the repo root:

1. `pnpm --filter @shopify-web-replicator/mcp build`
2. Launch the HTTP entrypoint with:
   `node apps/mcp/dist/http.js`
3. Connect your MCP client to:
   `http://127.0.0.1:8788/mcp`

The HTTP server uses session-aware streamable HTTP MCP transport. A bare `curl` may return `400 Bad Request` because the endpoint expects MCP JSON-RPC and valid session handling.

## Optional debug companion: Chrome DevTools MCP

When capture mismatches show up, register this companion MCP server to inspect the rendered DOM and network timeline:

```bash
codex mcp add chrome-devtools -- npx chrome-devtools-mcp@latest
```

Capture triage checklist:

1. In your MCP config, register both servers:
   - `shopify-web-replicator`
 - `chrome-devtools`

   ```bash
   codex mcp add shopify-web-replicator -- node /absolute/path/to/shopify-web-replicator/apps/mcp/dist/index.js
   codex mcp add chrome-devtools -- npx chrome-devtools-mcp@latest
   ```

2. Run the replicator and capture to disk (this writes `desktop.jpg`, `mobile.jpg`, and `capture-bundle.json`).
3. In Chrome DevTools MCP, open both the source and generated route URLs and verify:
  - final URL after redirects
  - response status codes
  - whether a bot challenge/captcha was returned
  - whether consent/popover DOM blocks the viewport
- If the screenshot payload appears blank/placeholder, compare the `desktop.jpg` and `mobile.jpg` files directly in the same directory and confirm overlay suppression or bot-protection markers in HTML.

## Optional companion: Figma MCP

If you want design-context handoff from Figma files to MCP-aware coding agents, you can add the remote Figma MCP server as well.

For Codex, the documented registration command is:

```bash
codex mcp add figma --url https://mcp.figma.com/mcp
```

After authentication, you can use both servers in the same session (`shopify-web-replicator` + `figma`) for one-click replication plus design context.

If you prefer a static config path, you can add this in `mcp.json`:

```json
{
  "mcpServers": {
    "figma": {
      "url": "https://mcp.figma.com/mcp",
      "type": "http"
    }
  }
}
```

For desktop environments that use local MCP transport, Figma also documents a local endpoint alternative at `http://127.0.0.1:3845/mcp` when the Figma desktop/Dev Mode MCP integration is enabled.

### Why captures differ from the source

- **Viewport differences**: if your automation and operator preview use different widths/heights, responsive sections will reorganize.
- **Rendering races**: animations, lazy-loaded images, and client-side swaps can still be pending at snapshot time.
- **Consent and overlays**: cookie banners and popovers can hide real content at capture time.
- **Bot challenge surfaces**: Cloudflare/anti-bot pages can return a technically-OK HTML response that is not the storefront you want.
- **CSS/asset timing**: blocked third-party scripts or slow font loads can alter perceived layout.

## Environment overrides

- `REPLICATOR_DB_PATH`
  Overrides the SQLite database path.
  Default: `.data/replicator.db`
- `THEME_WORKSPACE_PATH`
  Overrides the Shopify theme workspace path.
  Default: `packages/theme-workspace`
- `REPLICATOR_CAPTURE_ROOT`
  Overrides the on-disk root used for capture bundles and screenshots.
  Default: `.data/captures`
- `REPLICATOR_DESTINATION_STORES_PATH`
  Overrides the local destination store profile JSON path.
  Default: `config/destination-stores.json`
- `REPLICATOR_HYDROGEN_ROOT`
  Overrides the root used for generated Hydrogen workspaces.
  Default: `generated-sites`
- `REPLICATOR_PLAYWRIGHT_HEADLESS`
  Set to `false` to run a visible browser during capture for harder anti-bot surfaces.
  Default: `true`
- `REPLICATOR_PLAYWRIGHT_CHANNEL`
  Optional browser channel for Playwright launch (for example `chrome`).
- `REPLICATOR_CAPTURE_USER_AGENT`
  Overrides the default user agent used during capture.
- `REPLICATOR_CAPTURE_LOCALE`
  Overrides capture locale (defaults to `en-US`).
- `REPLICATOR_CAPTURE_TIMEZONE`
  Overrides capture timezone (defaults to `America/New_York`).
- `REPLICATOR_CAPTURE_COLOR_SCHEME`
  Override with `light` or `dark` to force captured rendering context.
- `MCP_HTTP_HOST`
  Streamable HTTP bind host.
  Default: `127.0.0.1`
- `MCP_HTTP_PORT`
  Streamable HTTP bind port.
  Default: `8788`
- `MCP_HTTP_PATH`
  Streamable HTTP MCP endpoint path.
  Default: `/mcp`
- `FIGMA_MCP_URL`
  Live Figma MCP endpoint used by the Hydrogen workflow.
  Default: `http://127.0.0.1:3845/mcp`
- `FIGMA_MCP_AUTH_HEADER_NAME`
  Optional Figma MCP auth header name.
- `FIGMA_MCP_AUTH_HEADER_VALUE`
  Optional Figma MCP auth header value.
- `FIGMA_MCP_PLAN_KEY`
  Optional plan key for Figma `newFile` output.
- `FIGMA_MCP_OUTPUT_MODE`
  Figma output mode for the Hydrogen flow.
  Default: `newFile`

If you do not set `REPLICATOR_DESTINATION_STORES_PATH`, create `config/destination-stores.json` from [`config/destination-stores.example.json`](../config/destination-stores.example.json).

## Example client configuration

Use the built entrypoint in clients that support local stdio MCP servers:

```json
{
  "mcpServers": {
    "figma": {
      "url": "https://mcp.figma.com/mcp",
      "type": "http"
    },
    "shopify-web-replicator": {
      "command": "node",
      "args": ["/absolute/path/to/shopify-web-replicator/apps/mcp/dist/index.js"],
      "env": {
        "REPLICATOR_DB_PATH": "/absolute/path/to/shopify-web-replicator/.data/replicator.db",
        "THEME_WORKSPACE_PATH": "/absolute/path/to/shopify-web-replicator/packages/theme-workspace",
        "REPLICATOR_CAPTURE_ROOT": "/absolute/path/to/shopify-web-replicator/.data/captures",
        "REPLICATOR_DESTINATION_STORES_PATH": "/absolute/path/to/shopify-web-replicator/config/destination-stores.json"
      }
    }
  }
}
```

For streamable HTTP clients, use the HTTP endpoint instead:

```json
{
  "mcpServers": {
    "shopify-web-replicator": {
      "url": "http://127.0.0.1:8788/mcp"
    }
  }
}
```

## Available tools

- `replicate_site_to_theme`
  Input: `referenceUrl`, `destinationStore`, optional `pageType`, optional `notes`
- `replicate_site_to_hydrogen`
  Input: `referenceUrl`, `targetId`, optional `targetLabel`, optional `notes`, optional `seedRoutes`
- `get_replication_job`
  Input: `jobId`
- `list_replication_jobs`
  Input: optional `limit`
- `list_destination_stores`
  Input: none

## Recommended workflow

1. Call `list_destination_stores` and choose a valid destination store id.
2. Call `replicate_site_to_theme` for the default one-shot flow.
3. Review the returned source qualification, capture bundle path, screenshot paths, extracted route/style signals, validation state, integration state, and `nextActions`.
4. Run `shopify theme dev` against the configured workspace.
5. Use `get_replication_job` or `list_replication_jobs` when you need to reopen a persisted run.

Advanced / beta Hydrogen workflow:

1. Confirm the Figma bridge is reachable at `FIGMA_MCP_URL`.
2. Call `replicate_site_to_hydrogen`.
3. Reopen the job with `get_replication_job` or `list_replication_jobs`.
4. Review the generated Hydrogen workspace under `generated-sites/<targetId>`.

## Current limits

- The engine is local-only and currently supports public Shopify storefronts that can be qualified in a browser session.
- It now uses browser-backed capture for a single route and stores screenshots plus capture bundles on disk, but it is not yet a full multi-page storefront crawler.
- The generated store setup output is a plan artifact, not Shopify Admin automation.
- The Hydrogen + Figma path is an advanced / beta workflow and is currently better supported through MCP/API inspection than the operator UI.
