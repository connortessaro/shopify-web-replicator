# Design Context

This document captures the product intent, UI design language, data model decisions, and Shopify theme conventions that shape this project.

## Product intent

Shopify Web Replicator is a **local, agent-driven MCP server** that turns a reference storefront URL into a deterministic Shopify theme handoff. Every design decision prioritises three properties:

1. **Determinism** — the same input always produces the same output so that agent workflows can rely on stable artifact paths and a predictable job schema.
2. **Local-first** — the server runs on the developer's machine with no hosted dependency; all storage is SQLite, all output is written to a local theme workspace.
3. **Structured handoff** — the pipeline terminates with a human review stage (`needs_review`) or a structured failure, never a silent error or opaque blob.

The MCP server in `apps/mcp` is the primary product surface. The companion API (`apps/api`) and web UI (`apps/web`) are optional review tools and are not part of the MCP contract.

## Pipeline design

The replication pipeline is a linear sequence of named stages. Each stage is persisted to SQLite before moving to the next, so a job snapshot at any point reflects exactly how far the pipeline progressed.

```
intake → analysis → mapping → theme_generation → store_setup
      → commerce_wiring → validation → integration_check → review
```

**Key decisions:**

- **Synchronous execution** — the entire pipeline runs synchronously inside a single `replicate_storefront` MCP tool call. There is no background worker or queue.
- **Fail-in-place** — a failing stage records a structured `JobError` and terminates the pipeline, but does not throw a transport-level error. The tool returns a fully formed job snapshot regardless of outcome.
- **Preflight before pipeline** — the MCP runtime validates Node.js SQLite support, Shopify CLI availability, DB directory writability, and theme workspace presence before accepting any tool call.
- **Validation after generation** — `shopify theme check` runs after all artifacts are written so its output reflects the final workspace state.
- **Integration check last** — the integration report is the terminal generated artifact; it summarises all previous stage outputs and verifies generated files on disk.

### Supported page types

| Value | Label |
|---|---|
| `landing_page` | Landing page |
| `homepage` | Homepage |
| `product_page` | Product page |
| `collection_page` | Collection page |

When no `pageType` is provided, `landing_page` is the default.

### Section blueprint types

The analysis and mapping stages produce a structured section plan using a fixed set of blueprint types:

| Blueprint | Purpose |
|---|---|
| `hero` | Full-width hero with heading and primary CTA |
| `cta` | Standalone call-to-action block |
| `rich_text` | Generic body copy section |
| `product_detail` | Product title, price, and add-to-cart wiring |
| `collection_grid` | Grid of collection or product cards |

## Data model

All types are defined in `packages/shared/src/job.ts` and exported from `packages/shared`.

### Job lifecycle

```
queued → in_progress → needs_review
                     ↘ failed
```

`completed` is defined in the schema but is not currently produced by the pipeline.

### ReplicationJob (top-level record)

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | `job_` + 12-char hex UUID fragment |
| `status` | `JobStatus` | `queued \| in_progress \| needs_review \| completed \| failed` |
| `currentStage` | `PipelineStage` | Most recent active stage |
| `intake` | `NormalizedReferenceIntake` | Validated and normalised input |
| `stages` | `JobStage[]` | One entry per pipeline stage with status, summary, and timestamps |
| `artifacts` | `GeneratedThemeArtifact[]` | One entry per generated file |
| `analysis` | `ReferenceAnalysis?` | Output of the analysis stage |
| `mapping` | `ThemeMapping?` | Output of the mapping stage |
| `generation` | `GenerationResult?` | Paths written by theme_generation |
| `storeSetup` | `StoreSetupPlan?` | Products, collections, menus, content models |
| `commerce` | `CommerceWiringPlan?` | Cart paths, checkout paths, entrypoints, QA checklist |
| `integration` | `IntegrationReport?` | Checks run by integration_check |
| `validation` | `ThemeCheckResult` | Output of `shopify theme check` |
| `error` | `JobError?` | Set when any stage fails |
| `createdAt` / `updatedAt` | ISO 8601 strings | |

### Stable artifact paths

These paths are constants in `packages/shared`. The engine always writes to the same locations so the theme workspace is idempotent.

| Kind | Path | Page type scope |
|---|---|---|
| `section` | `sections/generated-reference.liquid` | `landing_page` |
| `section` | `sections/generated-homepage-reference.liquid` | `homepage` |
| `section` | `sections/generated-product-reference.liquid` | `product_page` |
| `section` | `sections/generated-collection-reference.liquid` | `collection_page` |
| `template` | `templates/page.generated-reference.json` | `landing_page` |
| `template` | `templates/index.generated-reference.json` | `homepage` |
| `template` | `templates/product.generated-reference.json` | `product_page` |
| `template` | `templates/collection.generated-reference.json` | `collection_page` |
| `config` | `config/generated-store-setup.json` | All |
| `snippet` | `snippets/generated-commerce-wiring.liquid` | All |
| `config` | `config/generated-integration-report.json` | All |

## Companion web UI design

The web UI (`apps/web`) is a single-page React application with all styles in one flat CSS file (`src/styles.css`). It uses no CSS framework or design system library.

### Colour palette

| Role | Value | Usage |
|---|---|---|
| Forest dark | `#113126` | Sidebar background (top), primary button background |
| Forest mid | `#214b3d` | Sidebar background (bottom) |
| Forest text muted | `#335144` | Lede text, label text, dt text |
| Cream | `#f7f5ea` | Sidebar foreground, body background base |
| Cream background | `#ebf0df` | Body background gradient end |
| Ink | `#10231a` | Body text colour |
| Lime active | `#d4f08c` | Active nav link background and border |
| Lime stage | `#dff4af` | Current-stage card background |
| Error red | `#a12c1e` | Error text |
| Error red dark | `#7d2016` | Error alert text |

The body background is a radial + linear gradient: a soft lime radial at the top-left on a cream-to-sage linear.

### Typography

- **Primary font**: IBM Plex Sans (system fallback: Segoe UI, sans-serif)
- **Monospace font**: IBM Plex Mono (system fallback: SFMono-Regular, monospace) — used for validation output
- **Base line-height**: 1.5
- **Eyebrow / kicker style**: uppercase, `letter-spacing: 0.14em`, `font-size: 0.78rem`

### Layout

- **App shell**: two-column CSS grid — fixed sidebar (`minmax(240px, 320px)`) + fluid main content
- **Sidebar**: dark forest gradient, flex column, justified between top brand block and bottom note
- **Panels**: rounded (`border-radius: 1.5rem`), translucent cream background, subtle drop shadow
- **Stage cards**: `border-radius: 1rem`, responsive auto-fit grid
- **Form inputs**: rounded (`border-radius: 1rem`), semi-transparent white
- **Buttons**: pill shape (`border-radius: 999px`), dark forest background
- **Responsive breakpoint**: collapses to single-column below `900px`

### Navigation

The sidebar contains two pill-shaped nav links:

| Label | Route |
|---|---|
| Reference intake | `/` |
| Theme handoff | `/handoff` |

Active links use the lime accent colour with dark ink text.

## Shopify theme workspace design

`packages/theme-workspace` is a minimal Shopify Online Store 2.0 theme skeleton based on the Shopify Skeleton theme (v0.1.0).

### Theme settings

Configured in `config/settings_schema.json`:

| Group | Settings |
|---|---|
| Typography | `type_primary_font` — font picker (default: Work Sans) |
| Layout | `max_page_width` — select (90 rem / 110 rem); `min_page_margin` — range (10–100 px) |
| Colors | `background_color`, `foreground_color`, `input_corner_radius` |

### Design conventions in generated Liquid

Generated sections follow these conventions:

- Each section has a top-level `<div data-section-id="{{ section.id }}">` wrapper.
- Commerce entrypoints use standard Shopify routes (`routes.cart_url`, `routes.root_url`).
- Product add-to-cart forms use `action="{{ routes.cart_add_url }}"` with `method="post"`.
- CSS variables are centralised in `snippets/css-variables.liquid` and injected via the theme layout.
- The `generated-commerce-wiring.liquid` snippet is rendered once in `layout/theme.liquid` to expose cart and checkout entrypoints globally.

### Runtime preview

After a job completes, the theme workspace is ready for:

```
shopify theme dev --path packages/theme-workspace
```

This is surfaced as `previewCommand` in the job's runtime handoff data.

## MCP contract design

The MCP tool surface is intentionally small and stable:

| Tool | Input | Output |
|---|---|---|
| `replicate_storefront` | `referenceUrl`, optional `pageType`, optional `notes` | Full `ReplicationHandoff` (job + runtime + next actions) |
| `get_replication_job` | `jobId` | Full `ReplicationJob` or not-found error |
| `list_replication_jobs` | optional `limit` | `ReplicationJobSummary[]` |

`nextActions` in the handoff are deterministic strings — they do not vary by run, only by terminal status (`needs_review` vs `failed`).

## Environment and runtime defaults

| Variable | Default | Description |
|---|---|---|
| `REPLICATOR_DB_PATH` | `.data/replicator.db` | SQLite database path |
| `THEME_WORKSPACE_PATH` | `packages/theme-workspace` | Theme workspace path |
| `HOST` | `127.0.0.1` | Companion API bind address |
| `PORT` | `8787` | Companion API port |
| `REPLICATOR_ALLOWED_ORIGINS` | localhost + 127.0.0.1 on ports 5173, 4173, 8787 | CORS allowed origins for the companion API |
| `VITE_API_BASE_URL` | `http://127.0.0.1:8787` | API base URL for the companion web app |

All overrides are documented in `.env.example`.
