# Architecture

## Intent

This repo separates the operator-facing tooling from the Shopify theme output so the generated storefront stays Shopify-native while the orchestration logic remains easier to evolve. The current implementation is a deterministic Milestone 1 pipeline that proves the operator loop end to end without live crawling or multi-page generation.

## Boundaries

- `apps/web` owns the operator experience.
- `apps/api` owns job lifecycle, SQLite persistence, deterministic analysis, mapping, theme generation, and validation orchestration.
- `packages/shared` owns the contract between the web app and API.
- `packages/theme-workspace` owns the Liquid storefront output that will later be previewed or pushed with Shopify CLI.

## Current flow

1. An operator submits a reference URL and optional notes in the web app.
2. The web app can also load recent job summaries so operators can resume in-progress or review-ready work.
3. The web app calls the local API to create a replication job.
4. The API persists the job in SQLite and immediately starts the deterministic pipeline.
5. The analysis stage derives a typed landing-page summary from the URL and notes.
6. The mapping stage converts that summary into stable Shopify section and template intent.
7. Theme generation overwrites `sections/generated-reference.liquid` and `templates/page.generated-reference.json` inside `packages/theme-workspace`.
8. Theme validation runs `shopify theme check` against the workspace.
9. The operator dashboard polls until the job reaches `needs_review` or `failed`, then surfaces stage summaries, validation state, and a job-scoped handoff.
10. The handoff page loads runtime config from the API so the displayed workspace path and preview command match the real environment.

## Runtime defaults

- Job database path: `.data/replicator.db`
- Theme workspace path: `packages/theme-workspace`
- Both paths can be overridden with `REPLICATOR_DB_PATH` and `THEME_WORKSPACE_PATH`.

## Operator-facing API surface

- `POST /api/jobs` creates a job and queues the pipeline.
- `GET /api/jobs/:jobId` returns the full persisted job payload.
- `GET /api/jobs?limit=<n>` returns recent job summaries for intake and shortcut flows.
- `GET /api/runtime` returns the effective workspace path and preview command for handoff.
