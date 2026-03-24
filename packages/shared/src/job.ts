import { z } from "zod";

export const pipelineStages = [
  "intake",
  "analysis",
  "mapping",
  "theme_generation",
  "store_setup",
  "commerce_wiring",
  "validation",
  "integration_check",
  "review"
] as const;

export const stageStatuses = ["pending", "current", "complete", "failed"] as const;
export const jobStatuses = ["in_progress", "needs_review", "failed"] as const;
export const artifactKinds = ["section", "template", "snippet", "config"] as const;
export const artifactStatuses = ["pending", "generated", "failed"] as const;
export const validationStatuses = ["pending", "passed", "failed"] as const;
export const integrationStatuses = ["passed", "failed"] as const;
export const pageTypes = ["landing_page", "homepage", "product_page", "collection_page"] as const;
export const sectionBlueprintTypes = [
  "hero",
  "cta",
  "rich_text",
  "product_detail",
  "collection_grid"
] as const;

export const stableThemeArtifacts = {
  landing_page: {
    section: "sections/generated-reference.liquid",
    template: "templates/page.generated-reference.json",
    sectionDescription: "Primary generated landing section output",
    templateDescription: "Generated JSON template that references the stable landing section"
  },
  homepage: {
    section: "sections/generated-homepage-reference.liquid",
    template: "templates/index.generated-reference.json",
    sectionDescription: "Stable generated homepage section output",
    templateDescription: "Generated homepage template that references the stable homepage section"
  },
  product_page: {
    section: "sections/generated-product-reference.liquid",
    template: "templates/product.generated-reference.json",
    sectionDescription: "Stable generated product section output",
    templateDescription: "Generated product template that references the stable product section"
  },
  collection_page: {
    section: "sections/generated-collection-reference.liquid",
    template: "templates/collection.generated-reference.json",
    sectionDescription: "Stable generated collection section output",
    templateDescription: "Generated collection template that references the stable collection section"
  }
} as const;

export const stableStoreSetupArtifact = {
  path: "config/generated-store-setup.json",
  description: "Deterministic store setup plan covering products, collections, menus, and structured content"
} as const;

export const stableCommerceArtifact = {
  path: "snippets/generated-commerce-wiring.liquid",
  description: "Deterministic commerce wiring snippet covering cart entrypoints and native checkout handoff"
} as const;

export const stableIntegrationArtifact = {
  path: "config/generated-integration-report.json",
  description: "Deterministic integration report covering theme, store setup, and commerce consistency"
} as const;

export const pageTypeLabels = {
  landing_page: "landing page",
  homepage: "homepage",
  product_page: "product page",
  collection_page: "collection page"
} as const satisfies Record<(typeof pageTypes)[number], string>;

export const referenceIntakeSchema = z.object({
  referenceUrl: z.string().url(),
  pageType: z.enum(pageTypes).optional(),
  notes: z.string().trim().min(1).max(500).optional()
});

export type PipelineStage = (typeof pipelineStages)[number];
export type StageStatus = (typeof stageStatuses)[number];
export type JobStatus = (typeof jobStatuses)[number];
export type ArtifactKind = (typeof artifactKinds)[number];
export type ArtifactStatus = (typeof artifactStatuses)[number];
export type ValidationStatus = (typeof validationStatuses)[number];
export type IntegrationStatus = (typeof integrationStatuses)[number];
export type PageType = (typeof pageTypes)[number];
export type SectionBlueprintType = (typeof sectionBlueprintTypes)[number];
export type ReferenceIntake = z.infer<typeof referenceIntakeSchema>;

export interface NormalizedReferenceIntake {
  referenceUrl: string;
  pageType: PageType;
  notes?: string;
}

export interface JobStage {
  name: PipelineStage;
  status: StageStatus;
  summary?: string;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface GeneratedThemeArtifact {
  kind: ArtifactKind;
  path: string;
  status: ArtifactStatus;
  description: string;
  lastWrittenAt?: string;
}

export interface ThemeMappingSection {
  id: string;
  type: SectionBlueprintType;
  heading?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  items?: string[];
}

export interface ReferenceAnalysis {
  sourceUrl: string;
  referenceHost: string;
  pageType: PageType;
  title: string;
  summary: string;
  analyzedAt: string;
  recommendedSections: SectionBlueprintType[];
}

export interface ThemeMapping {
  sourceUrl: string;
  title: string;
  summary: string;
  mappedAt: string;
  templatePath: string;
  sectionPath: string;
  sections: ThemeMappingSection[];
}

export interface GenerationResult {
  generatedAt: string;
  templatePath: string;
  sectionPath: string;
}

export interface StoreSetupProductPlan {
  handle: string;
  title: string;
  merchandisingRole: string;
}

export interface StoreSetupCollectionPlan {
  handle: string;
  title: string;
  rule: string;
  featuredProductHandles: string[];
}

export interface StoreSetupMenuItemPlan {
  title: string;
  target: string;
}

export interface StoreSetupMenuPlan {
  handle: string;
  title: string;
  items: StoreSetupMenuItemPlan[];
}

export interface StoreSetupContentModelPlan {
  name: string;
  type: "metaobject" | "metafield_definition";
  fields: string[];
}

export interface StoreSetupPlan {
  plannedAt: string;
  configPath: string;
  summary: string;
  products: StoreSetupProductPlan[];
  collections: StoreSetupCollectionPlan[];
  menus: StoreSetupMenuPlan[];
  contentModels: StoreSetupContentModelPlan[];
}

export interface CommerceEntryPoint {
  label: string;
  target: string;
  behavior: string;
}

export interface CommerceWiringPlan {
  plannedAt: string;
  snippetPath: string;
  summary: string;
  cartPath: string;
  checkoutPath: string;
  entrypoints: CommerceEntryPoint[];
  qaChecklist: string[];
}

export interface IntegrationCheck {
  id: string;
  status: IntegrationStatus;
  details: string;
}

export interface IntegrationReport {
  checkedAt: string;
  reportPath: string;
  status: IntegrationStatus;
  summary: string;
  checks: IntegrationCheck[];
}

export interface ThemeCheckResult {
  status: ValidationStatus;
  summary: string;
  checkedAt?: string;
  output?: string;
}

export interface JobError {
  stage: PipelineStage;
  message: string;
}

export interface ReplicationJob {
  id: string;
  status: JobStatus;
  currentStage: PipelineStage;
  intake: NormalizedReferenceIntake;
  stages: JobStage[];
  artifacts: GeneratedThemeArtifact[];
  analysis?: ReferenceAnalysis;
  mapping?: ThemeMapping;
  generation?: GenerationResult;
  storeSetup?: StoreSetupPlan;
  commerce?: CommerceWiringPlan;
  integration?: IntegrationReport;
  validation: ThemeCheckResult;
  error?: JobError;
  createdAt: string;
  updatedAt: string;
}

export interface ReplicationJobSummary {
  jobId: string;
  status: JobStatus;
  currentStage: PipelineStage;
  createdAt: string;
  pageType: PageType;
}

export interface AppRuntimeConfig {
  themeWorkspacePath: string;
  previewCommand: string;
}

function derivePageTypeFromUrl(referenceUrl: string): PageType | undefined {
  try {
    const url = new URL(referenceUrl);
    if (url.pathname === "/" || url.pathname === "") return "homepage";
    if (url.pathname.startsWith("/products/")) return "product_page";
    if (url.pathname.startsWith("/collections/")) return "collection_page";
  } catch {
    // invalid URL — fall through
  }
  return undefined;
}

function normalizeReferenceIntake(intake: ReferenceIntake): NormalizedReferenceIntake {
  return {
    referenceUrl: intake.referenceUrl,
    pageType: intake.pageType ?? derivePageTypeFromUrl(intake.referenceUrl) ?? "landing_page",
    ...(intake.notes ? { notes: intake.notes } : {})
  };
}

function createPendingArtifacts(pageType: PageType): GeneratedThemeArtifact[] {
  const artifacts = stableThemeArtifacts[pageType];

  return [
    {
      kind: "section",
      path: artifacts.section,
      status: "pending",
      description: artifacts.sectionDescription
    },
    {
      kind: "template",
      path: artifacts.template,
      status: "pending",
      description: artifacts.templateDescription
    },
    {
      kind: "config",
      path: stableStoreSetupArtifact.path,
      status: "pending",
      description: stableStoreSetupArtifact.description
    },
    {
      kind: "snippet",
      path: stableCommerceArtifact.path,
      status: "pending",
      description: stableCommerceArtifact.description
    },
    {
      kind: "config",
      path: stableIntegrationArtifact.path,
      status: "pending",
      description: stableIntegrationArtifact.description
    }
  ];
}

export function createReplicationJob(intake: ReferenceIntake): ReplicationJob {
  const parsedIntake = normalizeReferenceIntake(referenceIntakeSchema.parse(intake));
  const timestamp = new Date().toISOString();

  return {
    id: `job_${globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
    status: "in_progress",
    currentStage: "analysis",
    intake: parsedIntake,
    stages: pipelineStages.map((name, index) => {
      if (index === 0) {
        return {
          name,
          status: "complete" as const,
          summary: "Reference intake accepted.",
          startedAt: timestamp,
          completedAt: timestamp
        };
      }

      if (index === 1) {
        return {
          name,
          status: "current" as const,
          summary: `Preparing deterministic ${pageTypeLabels[parsedIntake.pageType]} analysis.`,
          startedAt: timestamp
        };
      }

      return {
        name,
        status: "pending" as const,
        summary: `Waiting for ${name.replaceAll("_", " ")}.`
      };
    }),
    artifacts: createPendingArtifacts(parsedIntake.pageType),
    validation: {
      status: "pending",
      summary: "Theme validation has not run yet."
    },
    createdAt: timestamp,
    updatedAt: timestamp
  };
}
