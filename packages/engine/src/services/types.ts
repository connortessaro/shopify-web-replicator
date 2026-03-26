import type {
  AdminReplicationResult,
  AssetSyncResult,
  CommerceWiringPlan,
  DestinationStoreProfile,
  PageType,
  ParityAudit,
  ReferenceAnalysis,
  ReferenceCapture,
  ReplicationJob,
  RouteInventory,
  SourceQualification,
  StorefrontModel,
  StoreSetupPlan,
  ThemeCheckResult,
  ThemeMapping
} from "@shopify-web-replicator/shared";

export type QualificationService = {
  qualify(input: { jobId: string; referenceUrl: string }): Promise<SourceQualification>;
};

export type CaptureService = {
  capture(input: { jobId: string; referenceUrl: string }): Promise<ReferenceCapture>;
};

export type RouteInventoryService = {
  build(input: { jobId?: string; referenceUrl: string }): Promise<RouteInventory>;
};

export type StorefrontModelBuilderService = {
  build(input: {
    referenceUrl: string;
    routeInventory: RouteInventory;
    capture: ReferenceCapture;
  }): Promise<StorefrontModel>;
};

export type Analyzer = {
  analyze(input: {
    referenceUrl: string;
    pageType?: PageType;
    notes?: string;
    capture?: ReferenceCapture;
  }): Promise<ReferenceAnalysis>;
};

export type Mapper = {
  map(input: { analysis: ReferenceAnalysis; referenceUrl: string; notes?: string }): Promise<ThemeMapping>;
};

export type Generator = {
  generate(input: {
    analysis: ReferenceAnalysis;
    mapping: ThemeMapping;
    capture?: ReferenceCapture;
    storefrontModel?: StorefrontModel;
  }): Promise<{
    artifacts: ReplicationJob["artifacts"];
    generation: NonNullable<ReplicationJob["generation"]>;
  }>;
};

export type AssetSyncService = {
  sync(input: {
    capture: ReferenceCapture;
    themeWorkspacePath: string;
  }): Promise<AssetSyncResult>;
};

export type StoreSetupGenerator = {
  generate(input: {
    analysis: ReferenceAnalysis;
    mapping: ThemeMapping;
  }): Promise<{
    artifact: ReplicationJob["artifacts"][number];
    storeSetup: StoreSetupPlan;
  }>;
};

export type CommerceGenerator = {
  generate(input: {
    analysis: ReferenceAnalysis;
    mapping: ThemeMapping;
    storeSetup: StoreSetupPlan;
  }): Promise<{
    artifact: ReplicationJob["artifacts"][number];
    commerce: CommerceWiringPlan;
  }>;
};

export type AdminReplicationService = {
  replicate(input: {
    jobId: string;
    destinationStore: DestinationStoreProfile;
    storefrontModel: StorefrontModel;
    themeWorkspacePath: string;
  }): Promise<AdminReplicationResult>;
};

export type IntegrationGenerator = {
  generate(input: {
    analysis: ReferenceAnalysis;
    mapping: ThemeMapping;
    generation: NonNullable<ReplicationJob["generation"]>;
    storeSetup: StoreSetupPlan;
    commerce: CommerceWiringPlan;
    artifacts: ReplicationJob["artifacts"];
    validation: ThemeCheckResult;
  }): Promise<{
    artifact: ReplicationJob["artifacts"][number];
    integration: NonNullable<ReplicationJob["integration"]>;
  }>;
};

export type ThemeValidator = {
  validate(): Promise<ThemeCheckResult>;
};

export type ParityAuditorService = {
  audit(input: {
    jobId: string;
    sourceCapture: ReferenceCapture;
    adminReplication: AdminReplicationResult;
  }): Promise<ParityAudit>;
};
