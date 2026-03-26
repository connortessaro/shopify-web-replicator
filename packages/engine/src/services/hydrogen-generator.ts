import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type {
  BackendInferenceReport,
  FrontendSpec,
  HydrogenGenerationResult,
  HydrogenReplicationJob,
  PlaywrightDiscovery
} from "@shopify-web-replicator/shared";
import { sanitizeTargetId } from "@shopify-web-replicator/shared";

function renderPackageJson(targetId: string): string {
  return JSON.stringify(
    {
      name: `replicated-${sanitizeTargetId(targetId)}`,
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: {
        dev: "shopify hydrogen dev",
        build: "shopify hydrogen build"
      },
      dependencies: {
        "@shopify/hydrogen": "latest",
        "@shopify/remix-oxygen": "latest",
        react: "latest",
        "react-dom": "latest"
      }
    },
    null,
    2
  );
}

function renderGeneratedSiteModule(spec: FrontendSpec, backend: BackendInferenceReport): string {
  return `export const generatedSiteSpec = ${JSON.stringify(spec, null, 2)} as const;

export const generatedBackendInference = ${JSON.stringify(backend, null, 2)} as const;
`;
}

function renderFigmaContextModule(figmaCode: string, framework: string | undefined): string {
  return `export const figmaDesignContext = ${JSON.stringify(figmaCode)} as const;
export const figmaDesignContextFramework = ${JSON.stringify(framework ?? "unknown")} as const;
`;
}

function renderRootComponent(job: HydrogenReplicationJob): string {
  const title = job.hydrogenIntake.targetLabel ?? job.hydrogenIntake.targetId;

  return `import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "@remix-run/react";

import { generatedSiteSpec } from "./lib/generated-site";

export default function App() {
  const navLinks = generatedSiteSpec.routes
    .filter((route) => route.path !== "/")
    .slice(0, 5);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>${title}</title>
        <Meta />
        <Links />
      </head>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <header style={{ padding: "24px 32px", borderBottom: "1px solid #e5e5e5" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
            <strong>${title}</strong>
            <nav style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <a href="/">Home</a>
              {navLinks.map((route) => (
                <a key={route.path} href={route.path}>
                  {route.path}
                </a>
              ))}
            </nav>
          </div>
        </header>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
`;
}

function renderIndexRoute(job: HydrogenReplicationJob, discovery: PlaywrightDiscovery): string {
  const heroText = job.capture?.headingOutline[0] ?? job.capture?.title ?? job.hydrogenIntake.targetId;
  const summary = job.frontendSpec?.summary ?? discovery.summary;

  return `export default function IndexRoute() {
  return (
    <main style={{ padding: "48px 32px", display: "grid", gap: 24 }}>
      <section style={{ maxWidth: 880 }}>
        <p style={{ textTransform: "uppercase", letterSpacing: "0.12em" }}>Replicated Hydrogen storefront</p>
        <h1 style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)", lineHeight: 0.95, margin: 0 }}>
          {${JSON.stringify(heroText)}}
        </h1>
        <p style={{ maxWidth: 640, fontSize: "1.1rem", lineHeight: 1.6 }}>
          {${JSON.stringify(summary)}}
        </p>
      </section>
    </main>
  );
}
`;
}

function renderProductRoute(): string {
  return `import { useParams } from "@remix-run/react";

export default function ProductRoute() {
  const { handle } = useParams();

  return (
    <main style={{ padding: "48px 32px" }}>
      <h1>{handle}</h1>
      <p>
        This replicated Hydrogen route is scaffolded from public storefront observation. Replace the
        placeholder loader with Storefront API-backed product data.
      </p>
    </main>
  );
}
`;
}

function renderCollectionRoute(): string {
  return `import { useParams } from "@remix-run/react";

export default function CollectionRoute() {
  const { handle } = useParams();

  return (
    <main style={{ padding: "48px 32px" }}>
      <h1>{handle}</h1>
      <p>
        This replicated collection route is scaffolded for Hydrogen. Wire collection data and filtering
        behavior against the Storefront API before publish.
      </p>
    </main>
  );
}
`;
}

function renderCartRoute(): string {
  return `export default function CartRoute() {
  return (
    <main style={{ padding: "48px 32px" }}>
      <h1>Cart</h1>
      <p>
        Cart and checkout were inferred from public storefront behavior. Replace this placeholder with
        Hydrogen cart handlers and native checkout handoff.
      </p>
    </main>
  );
}
`;
}

function renderReadme(job: HydrogenReplicationJob, backend: BackendInferenceReport): string {
  return `# Replicated Hydrogen workspace

Target: ${job.hydrogenIntake.targetId}
Source: ${job.hydrogenIntake.referenceUrl}

This workspace was generated by Shopify Web Replicator's Hydrogen pipeline.

## Notes

- Figma stage: ${job.figmaImport?.summary ?? "pending"}
- Backend unresolved capabilities: ${backend.unresolvedCapabilities.join(", ") || "none"}
- Replace placeholder loaders/actions with Storefront API and app-specific integrations before deployment.
`;
}

export class HydrogenWorkspaceGenerator {
  constructor(private readonly rootPath: string) {}

  async generate(input: {
    job: HydrogenReplicationJob;
    discovery: PlaywrightDiscovery;
    frontendSpec: FrontendSpec;
    backendInference: BackendInferenceReport;
  }): Promise<{
    artifacts: HydrogenReplicationJob["artifacts"];
    generation: HydrogenGenerationResult;
  }> {
    const { job, discovery, frontendSpec, backendInference } = input;
    const targetId = sanitizeTargetId(job.hydrogenIntake.targetId);
    const workspacePath = join(this.rootPath, targetId);
    const appPath = join(workspacePath, "app");
    const routesPath = join(appPath, "routes");
    const libPath = join(appPath, "lib");
    const metaPath = join(workspacePath, ".replicator");
    const generatedAt = new Date().toISOString();

    await mkdir(routesPath, { recursive: true });
    await mkdir(libPath, { recursive: true });
    await mkdir(metaPath, { recursive: true });

    const files = new Map<string, string>([
      [join(workspacePath, "package.json"), renderPackageJson(job.hydrogenIntake.targetId)],
      [join(workspacePath, "README.md"), renderReadme(job, backendInference)],
      [join(appPath, "root.tsx"), renderRootComponent(job)],
      [join(routesPath, "_index.tsx"), renderIndexRoute(job, discovery)],
      [join(routesPath, "products.$handle.tsx"), renderProductRoute()],
      [join(routesPath, "collections.$handle.tsx"), renderCollectionRoute()],
      [join(routesPath, "cart.tsx"), renderCartRoute()],
      [join(libPath, "generated-site.ts"), renderGeneratedSiteModule(frontendSpec, backendInference)],
      [
        join(libPath, "figma-design-context.ts"),
        renderFigmaContextModule(job.figmaImport?.designContextCode ?? "", job.figmaImport?.designContextFramework)
      ],
      [
        join(metaPath, "hydrogen-generation.json"),
        JSON.stringify(
          {
            generatedAt,
            targetId,
            referenceUrl: job.hydrogenIntake.referenceUrl,
            discovery,
            figmaImport: job.figmaImport,
            frontendSpec,
            backendInference
          },
          null,
          2
        )
      ]
    ]);

    await Promise.all(
      [...files.entries()].map(async ([path, body]) => {
        await writeFile(path, body, "utf8");
      })
    );

    const generatedFiles = [...files.keys()];
    const artifacts = generatedFiles.map((path) => ({
      kind: "config" as const,
      path,
      status: "generated" as const,
      description: `Generated Hydrogen workspace artifact: ${path.split(`${workspacePath}/`).at(-1) ?? path}`,
      lastWrittenAt: generatedAt
    }));

    return {
      artifacts,
      generation: {
        generatedAt,
        workspacePath,
        summary: `Generated a Hydrogen workspace for ${job.hydrogenIntake.targetId} with ${frontendSpec.routes.length} route definitions.`,
        routesWritten: frontendSpec.routes.map((route) => route.path),
        generatedFiles
      }
    };
  }
}
