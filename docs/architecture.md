# Architecture

## Intent

This repo separates the operator-facing tooling from the Shopify theme output so the generated storefront stays Shopify-native while the generation logic remains easier to evolve.

## Boundaries

- `apps/web` owns the operator experience.
- `apps/api` owns job lifecycle, intake validation, and future parsing/generation orchestration.
- `packages/shared` owns the contract between the web app and API.
- `packages/theme-workspace` owns the Liquid storefront output that will later be previewed or pushed with Shopify CLI.

## Initial flow

1. An operator submits a reference URL and optional notes in the web app.
2. The web app calls the local API to create a replication job.
3. The API creates an in-memory job record shaped like the future pipeline.
4. The operator views job status and handoff guidance in the web app.
5. Generated theme artifacts will later be written into the Shopify theme workspace.

