# Operator Runbook

## Goal

Use the local operator console to turn a reference URL into deterministic Shopify theme output, a store setup plan, and a commerce wiring plan, then review all three in the theme workspace before any store preview or publish step.

## Local workflow

1. Start the stack with `pnpm dev`.
2. Open the web app and submit the reference URL, page type, and any prioritization notes.
3. Wait for the job detail page to reach `needs_review` or `failed`.
4. If you leave the page, reopen the job from the Recent Jobs section on the intake screen.
5. Open the job-scoped handoff page and review:
   - generated artifact paths
   - store setup plan scope for products, collections, menus, and structured content
   - commerce wiring scope for cart entrypoints and native checkout handoff
   - validation summary and raw output
   - workspace path and preview command
6. Run `shopify theme dev` in the configured theme workspace.
7. Verify the generated theme for layout parity, content structure, planned merchandising setup, CTA behavior, add-to-cart behavior, and native Shopify checkout handoff.
8. Use the generated `config/generated-store-setup.json` plan as the operator checklist for store-side setup before any publish step.
9. Use the generated `snippets/generated-commerce-wiring.liquid` plan and UI summary to confirm cart and checkout behavior before any publish step.

## Current limits

- The generator currently supports `landing_page`, `homepage`, `product_page`, and `collection_page`.
- The generator writes the stable generated section and template outputs for the selected page type plus deterministic store setup and commerce wiring artifacts.
- The pipeline does not fetch live DOM structure, screenshots, product data, or collection data.
- Store setup remains a planning output; products, collections, navigation, and structured content are not pushed to Shopify automatically in this slice.
- Commerce wiring remains a deterministic planning and QA output; no live checkout automation or custom checkout implementation is added in this slice.
- Publishing decisions remain manual after operator review.
