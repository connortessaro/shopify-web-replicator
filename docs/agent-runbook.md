# Agent Runbook

## Purpose

Use this doc when an MCP-capable agent is operating the repo rather than editing the codebase. It covers the practical workflow for the current tool surface, transport choices, and recovery paths.

Theme is the stable default workflow. Hydrogen is an advanced / beta workflow that depends on a live Figma bridge.

## Choose the transport

- Use stdio when the client launches local MCP servers directly.
- Use streamable HTTP when the client expects an MCP endpoint such as `/mcp`.
- Default streamable HTTP endpoint:
  - `http://127.0.0.1:8788/mcp`

## Available tools

- `replicate_site_to_theme`
- `replicate_site_to_hydrogen`
- `get_replication_job`
- `list_replication_jobs`
- `list_destination_stores`

## Stable theme workflow

1. Call `list_destination_stores`.
2. Choose a valid `destinationStore`.
3. Call `replicate_site_to_theme` with:
   - `referenceUrl`
   - `destinationStore`
   - optional `pageType`
   - optional `notes`
4. Inspect the returned handoff payload:
   - source qualification
   - capture artifact paths and screenshots
   - analysis and mapping
   - generation, validation, and integration
   - `nextActions`
5. If needed, reopen the job with `get_replication_job`.

## Advanced / beta Hydrogen workflow

Prerequisites:

- `FIGMA_MCP_URL` must point to a reachable Figma MCP bridge.
- The recommended local Figma endpoint is `http://127.0.0.1:3845/mcp`.

Workflow:

1. Call `replicate_site_to_hydrogen` with:
   - `referenceUrl`
   - `targetId`
   - optional `targetLabel`
   - optional `notes`
   - optional `seedRoutes`
2. Treat the initial response as job creation, not final review output.
3. Reopen the job with `get_replication_job` or `list_replication_jobs`.
4. Inspect these stages carefully:
   - `playwright_discovery`
   - `figma_import`
   - `figma_design_context`
   - `backend_inference`
   - `workspace_validation`
5. Review the generated workspace under `generated-sites/<targetId>`.

## Recovery and failure handling

- If theme creation fails, reopen the job and inspect `currentStage`, structured `error`, capture artifacts, and validation output.
- If Hydrogen fails at `figma_import`, verify `FIGMA_MCP_URL` and the live Figma session first.
- If an HTTP MCP client reports session issues, use a proper streamable HTTP MCP client and preserve `MCP-Session-Id` across follow-up requests.
- If you need historical context, use `list_replication_jobs` before creating a duplicate run.

## Operational stance

- Prefer `replicate_site_to_theme` unless the task explicitly requires Hydrogen.
- Do not describe Hydrogen as a mature web-UI-first review flow.
- Do not assume the Figma bridge is present without checking the configured endpoint or local desktop bridge state.
