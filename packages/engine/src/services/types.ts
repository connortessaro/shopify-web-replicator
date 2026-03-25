import type {
<<<<<<< HEAD
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
=======
  CommerceWiringPlan,
  PageType,
  ReferenceAnalysis,
  ReplicationJob,
>>>>>>> 0ff837ae2df3782ab4b72a9b6d93d92b7f7d8110
  StoreSetupPlan,
  ThemeCheckResult,
  ThemeMapping
} from "@shopify-web-replicator/shared";

<<<<<<< HEAD
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
=======
export type Analyzer = {
  analyze(input: { referenceUrl: string; pageType?: PageType; notes?: string }): Promise<ReferenceAnalysis>;
>>>>>>> 0ff837ae2df3782ab4b72a9b6d93d92b7f7d8110
};

export type Mapper = {
  map(input: { analysis: ReferenceAnalysis; referenceUrl: string; notes?: string }): Promise<ThemeMapping>;
};

export type Generator = {
  generate(input: {
    analysis: ReferenceAnalysis;
    mapping: ThemeMapping;
<<<<<<< HEAD
    capture?: ReferenceCapture;
    storefrontModel?: StorefrontModel;
=======
>>>>>>> 0ff837ae2df3782ab4b72a9b6d93d92b7f7d8110
  }): Promise<{
    artifacts: ReplicationJob["artifacts"];
    generation: NonNullable<ReplicationJob["generation"]>;
  }>;
};

<<<<<<< HEAD
export type AssetSyncService = {
  sync(input: {
    capture: ReferenceCapture;
    themeWorkspacePath: string;
  }): Promise<AssetSyncResult>;
=======
export type ThemeValidator = {
  validate(): Promise<ThemeCheckResult>;
>>>>>>> 0ff837ae2df3782ab4b72a9b6d93d92b7f7d8110
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

<<<<<<< HEAD
export type AdminReplicationService = {
  replicate(input: {
    jobId: string;
    destinationStore: DestinationStoreProfile;
    storefrontModel: StorefrontModel;
    themeWorkspacePath: string;
  }): Promise<AdminReplicationResult>;
};

=======
>>>>>>> 0ff837ae2df3782ab4b72a9b6d93d92b7f7d8110
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
<<<<<<< HEAD

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
=======
>>>>>>> 0ff837ae2df3782ab4b72a9b6d93d92b7f7d8110
