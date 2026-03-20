# Theme Workspace

This directory is the Shopify theme output target for the Shopify Web Replicator project. It was initialized from Shopify's Skeleton theme and is meant to receive generated Liquid, JSON templates, snippets, and theme assets before any manual QA or store preview.

## Internal handoff

- Preview locally with `shopify theme dev --path packages/theme-workspace`
- Run checks with `shopify theme check --path packages/theme-workspace`
- Keep generated output paths stable so the operator UI and API can reference them reliably

## Placeholder generated files

- `sections/generated-reference.liquid`
- `templates/page.generated-reference.json`

These files are the first stable targets for generated storefront output. Later pipeline stages can replace their contents or add new generated sections and templates alongside them.

## Theme shape

```text
assets/      shared CSS, JS, images, fonts
blocks/      reusable theme blocks
config/      theme settings and defaults
layout/      global layout wrappers
locales/     translation files
sections/    main Liquid section outputs
snippets/    reusable Liquid fragments
templates/   JSON or Liquid page templates
```

## Upstream base

The workspace was initialized with Shopify CLI from the public Skeleton theme:

- https://github.com/Shopify/skeleton-theme
- https://shopify.dev/docs/storefronts/themes/architecture
