# Operator Runbook

## Goal

Use the local operator console to turn a reference URL into deterministic Shopify theme output, then review that output in the theme workspace before any store preview or publish step.

## Local workflow

1. Start the stack with `pnpm dev`.
2. Open the web app and submit the reference URL, page type, and any prioritization notes.
3. Wait for the job detail page to reach `needs_review` or `failed`.
4. If you leave the page, reopen the job from the Recent Jobs section on the intake screen.
5. Open the job-scoped handoff page and review:
   - generated artifact paths
   - validation summary and raw output
   - workspace path and preview command
6. Run `shopify theme dev` in the configured theme workspace.
7. Verify the generated theme for layout parity, content structure, CTA behavior, and native Shopify checkout handoff.

## Current limits

- The generator currently supports `landing_page`, `homepage`, `product_page`, and `collection_page`.
- The generator only writes the stable generated section and template outputs for the selected page type.
- The pipeline does not fetch live DOM structure, screenshots, product data, or collection data.
- Publishing decisions remain manual after operator review.
