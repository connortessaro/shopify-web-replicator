import { z } from "zod";

export const pipelineStages = [
  "intake",
  "source_qualification",
  "route_inventory",
  "capture",
  "storefront_model",
  "analysis",
  "mapping",
  "theme_generation",
  "asset_sync",
  "store_setup",
  "commerce_wiring",
  "admin_replication",
  "validation",
  "parity_audit",
  "integration_check",
  "review"
] as const;

export const stageStatuses = ["pending", "current", "complete", "failed"] as const;
export const jobStatuses = ["in_progress", "needs_review", "failed"] as const;
export const artifactKinds = ["section", "template", "snippet", "config"] as const;
export const artifactStatuses = ["pending", "generated", "failed"] as const;
export const validationStatuses = ["pending", "passed", "failed"] as const;
export const integrationStatuses = ["passed", "failed"] as const;
export const parityStatuses = ["passed", "warning", "failed"] as const;
export const sourceQualificationStatuses = ["supported", "unsupported"] as const;
export const sourcePlatforms = ["shopify", "unknown"] as const;
export const sourceQualificationFailureCodes = [
  "non_shopify_source",
  "password_protected",
  "browser_unavailable",
  "capture_failed"
] as const;
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
  description: "Import-ready store setup bundle covering products, collections, menus, and structured content"
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
  destinationStore: z.string().trim().min(1),
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
export type ParityStatus = (typeof parityStatuses)[number];
export type SourceQualificationStatus = (typeof sourceQualificationStatuses)[number];
export type SourcePlatform = (typeof sourcePlatforms)[number];
export type SourceQualificationFailureCode = (typeof sourceQualificationFailureCodes)[number];
export type PageType = (typeof pageTypes)[number];
export type SectionBlueprintType = (typeof sectionBlueprintTypes)[number];
export type ReferenceIntake = z.infer<typeof referenceIntakeSchema>;

export interface NormalizedReferenceIntake {
  referenceUrl: string;
  destinationStore: string;
  pageType: PageType;
  notes?: string;
}

export interface DestinationStoreProfile {
  id: string;
  label: string;
  shopDomain: string;
  adminTokenEnvVar?: string;
  apiVersion?: string;
  baseThemeId?: string;
  baseThemeRole?: "MAIN" | "UNPUBLISHED" | "DEVELOPMENT" | undefined;
  themeNamePrefix?: string;
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

export interface CapturedLink {
  label: string;
  href: string;
}

export interface CapturedImageAsset {
  src: string;
  alt?: string;
}

export interface ReferenceStyleTokens {
  dominantColors: string[];
  fontFamilies: string[];
  bodyTextColor?: string;
  pageBackgroundColor?: string;
  primaryButtonBackgroundColor?: string;
  primaryButtonTextColor?: string;
  linkColor?: string;
}

export interface ReferenceRouteHints {
  productHandles: string[];
  collectionHandles: string[];
  cartPath?: string;
  checkoutPath?: string;
}

export type DiscoveredRouteKind = PageType | "content_page";
export type RouteDiscoverySource = "root" | "navigation" | "cta";

export interface RouteInventoryRoute {
  kind: DiscoveredRouteKind;
  source: RouteDiscoverySource;
  url: string;
  handle?: string;
}

export interface RouteInventory {
  discoveredAt: string;
  referenceHost: string;
  summary: string;
  routes: RouteInventoryRoute[];
}

export interface CapturedRoute {
  kind: DiscoveredRouteKind;
  url: string;
  handle?: string;
  title: string;
  description?: string;
  referenceHost: string;
  headingOutline: string[];
  navigationLinks: CapturedLink[];
  primaryCtas: CapturedLink[];
  imageAssets: CapturedImageAsset[];
  styleTokens: ReferenceStyleTokens;
  captureBundlePath: string;
  desktopScreenshotPath: string;
  mobileScreenshotPath: string;
}

export interface ReferenceCapture {
  sourceUrl: string;
  resolvedUrl: string;
  referenceHost: string;
  title: string;
  description?: string;
  capturedAt: string;
  captureBundlePath: string;
  desktopScreenshotPath: string;
  mobileScreenshotPath: string;
  textContent: string;
  headingOutline: string[];
  navigationLinks: CapturedLink[];
  primaryCtas: CapturedLink[];
  imageAssets: CapturedImageAsset[];
  styleTokens: ReferenceStyleTokens;
  routeHints: ReferenceRouteHints;
  routes?: CapturedRoute[];
}

export interface SourceQualification {
  status: SourceQualificationStatus;
  platform: SourcePlatform;
  referenceHost: string;
  resolvedUrl: string;
  qualifiedAt: string;
  summary: string;
  evidence: string[];
  failureCode?: SourceQualificationFailureCode;
  failureReason?: string;
  isPasswordProtected?: boolean;
  httpStatus?: number;
  shopDomain?: string;
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

export interface StorefrontModelPage {
  kind: DiscoveredRouteKind;
  url: string;
  handle?: string;
  title: string;
}

export interface StorefrontModel {
  modeledAt: string;
  referenceHost: string;
  storeTitle: string;
  summary: string;
  styleTokens: ReferenceStyleTokens;
  pages: StorefrontModelPage[];
  products: StoreSetupProductPlan[];
  collections: StoreSetupCollectionPlan[];
  menus: StoreSetupMenuPlan[];
  contentModels: StoreSetupContentModelPlan[];
  unsupportedFeatures: string[];
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
  importBundlePath: string;
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

export interface SyncedAsset {
  sourceUrl: string;
  themePath: string;
  status: "synced" | "failed";
  message?: string;
}

export interface AssetSyncResult {
  syncedAt: string;
  summary: string;
  assets: SyncedAsset[];
}

export type ReplicatedResourceKind =
  | "theme"
  | "product"
  | "collection"
  | "page"
  | "menu"
  | "metaobject_definition"
  | "metafield_definition"
  | "metaobject";

export interface ReplicatedResource {
  kind: ReplicatedResourceKind;
  id: string;
  handle?: string;
  action: "created" | "updated";
}

export interface RollbackManifest {
  generatedAt: string;
  resources: Array<Pick<ReplicatedResource, "kind" | "id" | "handle">>;
}

export interface AdminReplicationResult {
  replicatedAt: string;
  destinationStoreId: string;
  shopDomain: string;
  themeId: string;
  themeName: string;
  previewUrl: string;
  summary: string;
  createdResources: ReplicatedResource[];
  updatedResources: ReplicatedResource[];
  warnings: string[];
  rollbackManifest: RollbackManifest;
}

export interface ParityRouteResult {
  kind: DiscoveredRouteKind;
  url: string;
  previewUrl: string;
  status: "matched" | "warning" | "failed";
  visualSimilarity: number;
  sourceTitle: string;
  destinationTitle: string;
  notes: string[];
}

export interface ParityAudit {
  checkedAt: string;
  status: ParityStatus;
  summary: string;
  routes: ParityRouteResult[];
  warnings: string[];
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
  sourceQualification?: SourceQualification;
  routeInventory?: RouteInventory;
  capture?: ReferenceCapture;
  storefrontModel?: StorefrontModel;
  analysis?: ReferenceAnalysis;
  mapping?: ThemeMapping;
  generation?: GenerationResult;
  assetSync?: AssetSyncResult;
  storeSetup?: StoreSetupPlan;
  commerce?: CommerceWiringPlan;
  adminReplication?: AdminReplicationResult;
  parityAudit?: ParityAudit;
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
  destinationStore: string;
}

export interface AppRuntimeConfig {
  themeWorkspacePath: string;
  captureRootPath: string;
  previewCommand: string;
  destinationStores: DestinationStoreProfile[];
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
    destinationStore: intake.destinationStore,
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
    currentStage: "source_qualification",
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
          summary: "Validating the reference source and destination store.",
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
