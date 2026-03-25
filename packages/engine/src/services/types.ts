import type {
  CommerceWiringPlan,
  PageType,
  ReferenceAnalysis,
  ReplicationJob,
  StoreSetupPlan,
  ThemeCheckResult,
  ThemeMapping
} from "@shopify-web-replicator/shared";

export type Analyzer = {
  analyze(input: { referenceUrl: string; pageType?: PageType; notes?: string }): Promise<ReferenceAnalysis>;
};

export type Mapper = {
  map(input: { analysis: ReferenceAnalysis; referenceUrl: string; notes?: string }): Promise<ThemeMapping>;
};

export type Generator = {
  generate(input: {
    analysis: ReferenceAnalysis;
    mapping: ThemeMapping;
  }): Promise<{
    artifacts: ReplicationJob["artifacts"];
    generation: NonNullable<ReplicationJob["generation"]>;
  }>;
};

export type ThemeValidator = {
  validate(): Promise<ThemeCheckResult>;
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
