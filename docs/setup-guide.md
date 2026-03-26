---
title: "Setup Guide"
description: "Complete setup instructions for connecting Shopify Web Replicator MCP to Claude Desktop, OpenAI Codex, GitHub Copilot, Cursor, Windsurf, and other AI clients."
---

# Shopify Web Replicator MCP - Setup Guide

Complete setup instructions for connecting Shopify Web Replicator MCP to Claude Desktop, OpenAI Codex, GitHub Copilot, Cursor, Windsurf, and other AI clients.

---

## Choose Your Setup

| I want to... | Setup Method | Time |
|--------------|--------------|------|
| Use the local MCP server from CLI clients | `stdio` mode | ~5 min |
| Connect from GUI MCP clients like Codex | `Streamable HTTP` mode | ~5 min |
| Replicate storefronts into Hydrogen with live Figma import | `Streamable HTTP` + Figma bridge config | ~10 min |

### Important capability notes

| Capability | `stdio` mode | Streamable HTTP |
|------------|--------------|-----------------|
| `replicate_site_to_theme` | Yes | Yes |
| `replicate_site_to_hydrogen` | Yes | Yes |
| `get_replication_job` / `list_replication_jobs` | Yes | Yes |
| OpenAI Codex GUI setup | No | Yes |
| Browser-safe MCP transport | No | Yes |

Hydrogen replication is an advanced / beta workflow and requires a reachable Figma MCP bridge. The server will fail at `figma_import` if the bridge is unavailable.

---

## NPX / Local CLI setup

Best for Claude Code, local CLI workflows, and direct stdio MCP clients.

### Prerequisites

- Node.js 18+
- `pnpm`
- Shopify CLI if you plan to use the theme pipeline
- Optional for Hydrogen flow: Figma Desktop with MCP enabled, or another reachable Figma MCP endpoint

### Build

```bash
pnpm install
pnpm build
cp config/destination-stores.example.json config/destination-stores.json
```

### Claude Code example

```bash
claude mcp add shopify-web-replicator -s user -- node /absolute/path/to/shopify-web-replicator/apps/mcp/dist/index.js
```

### JSON config example

```json
{
  "mcpServers": {
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

---

## Streamable HTTP setup

Best for OpenAI Codex and any MCP client that supports streamable HTTP instead of stdio.

### Start the server

From the repo root:

```bash
pnpm --filter @shopify-web-replicator/mcp build
node apps/mcp/dist/http.js
```

Default endpoint:

```text
http://127.0.0.1:8788/mcp
```

### Streamable HTTP environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `MCP_HTTP_HOST` | `127.0.0.1` | Bind address |
| `MCP_HTTP_PORT` | `8788` | HTTP port |
| `MCP_HTTP_PATH` | `/mcp` | MCP endpoint path |
| `MCP_HTTP_ALLOWED_HOSTS` | localhost variants | Allowed `Host` values |
| `MCP_HTTP_ALLOWED_ORIGINS` | localhost variants | Allowed origins |

The HTTP server uses session-aware streamable MCP transport with `GET`, `POST`, and `DELETE` support.

### OpenAI Codex

In Codex:

1. Open `Settings`
2. Open `MCP servers`
3. Add a new MCP server
4. Use:

| Field | Value |
|-------|-------|
| Server name | `Shopify Web Replicator` |
| URL | `http://127.0.0.1:8788/mcp` |

If Codex prompts for transport, choose streamable HTTP.

### Cursor / Windsurf / other MCP clients

Use the same URL:

```json
{
  "mcpServers": {
    "shopify-web-replicator": {
      "url": "http://127.0.0.1:8788/mcp"
    }
  }
}
```

---

## Hydrogen replication with live Figma import

The Hydrogen pipeline adds these stages:

1. `source_qualification`
2. `playwright_discovery`
3. `figma_import`
4. `figma_design_context`
5. `frontend_spec`
6. `backend_inference`
7. `hydrogen_generation`
8. `workspace_validation`
9. `review`

### Required Figma bridge configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `FIGMA_MCP_URL` | `http://127.0.0.1:3845/mcp` | Figma MCP endpoint |
| `FIGMA_MCP_AUTH_HEADER_NAME` | unset | Optional auth header name |
| `FIGMA_MCP_AUTH_HEADER_VALUE` | unset | Optional auth header value |
| `FIGMA_MCP_PLAN_KEY` | unset | Optional plan key for `newFile` output |
| `FIGMA_MCP_OUTPUT_MODE` | `newFile` | `newFile` or `clipboard` |

### Local Figma Desktop bridge

Recommended local setup:

1. Open Figma Desktop
2. Enable the local MCP/Dev Mode bridge
3. Confirm the local endpoint responds at:

```text
http://127.0.0.1:3845/mcp
```

4. Start the streamable HTTP MCP server
5. Call `replicate_site_to_hydrogen`

If the Figma MCP bridge is not reachable, Hydrogen jobs fail at `figma_import` by design.

### Example Hydrogen request

```json
{
  "referenceUrl": "https://example-store.com",
  "targetId": "example-store",
  "targetLabel": "Example Store"
}
```

The server will generate a per-target Hydrogen workspace under:

```text
generated-sites/<targetId>
```

---

## Available tools

| Tool | Purpose |
|------|---------|
| `replicate_site_to_theme` | Existing deterministic Shopify theme pipeline |
| `replicate_site_to_hydrogen` | Async Hydrogen pipeline with Playwright discovery and live Figma bridge |
| `get_replication_job` | Load a persisted job |
| `list_replication_jobs` | List recent jobs |
| `list_destination_stores` | List configured destination store profiles |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `400 Bad Request` from `/mcp` on bare curl | Endpoint is live and expects MCP JSON-RPC | Use an MCP client, not a plain browser/curl request |
| Hydrogen job fails at `figma_import` | Figma MCP bridge unavailable or unauthenticated | Set `FIGMA_MCP_URL` correctly and ensure the Figma bridge is live |
| Streamable HTTP client cannot connect | Wrong host/port/path | Check `MCP_HTTP_HOST`, `MCP_HTTP_PORT`, and `MCP_HTTP_PATH` |
| Session errors on HTTP transport | Missing `MCP-Session-Id` on follow-up requests | Use a proper MCP client with streamable HTTP support |
| Theme pipeline fails preflight | Shopify CLI or theme workspace unavailable | Verify Shopify CLI and workspace permissions |

---

## Next steps

1. Start the streamable HTTP MCP server
2. Connect it from Codex or your MCP client of choice
3. Verify `list_destination_stores`
4. Run either:
   - `replicate_site_to_theme`
   - `replicate_site_to_hydrogen`
