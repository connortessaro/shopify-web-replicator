import { randomUUID } from "node:crypto";

import { z } from "zod";

export const pipelineStages = [
  "intake",
  "analysis",
  "mapping",
  "theme_generation",
  "review"
] as const;

export const stageStatuses = ["pending", "current", "complete", "failed"] as const;
export const jobStatuses = ["queued", "in_progress", "needs_review", "completed", "failed"] as const;
export const artifactKinds = ["section", "template", "snippet", "config"] as const;
export const artifactStatuses = ["pending", "generated", "failed"] as const;
export const validationStatuses = ["pending", "passed", "failed"] as const;
export const sectionBlueprintTypes = [
  "hero",
  "cta",
  "rich_text"
] as const;

export const stableThemeArtifacts = {
  section: "sections/generated-reference.liquid",
  template: "templates/page.generated-reference.json"
} as const;

export const referenceIntakeSchema = z.object({
  referenceUrl: z.string().url(),
  notes: z.string().trim().min(1).optional()
});

export type PipelineStage = (typeof pipelineStages)[number];
export type StageStatus = (typeof stageStatuses)[number];
export type JobStatus = (typeof jobStatuses)[number];
export type ArtifactKind = (typeof artifactKinds)[number];
export type ArtifactStatus = (typeof artifactStatuses)[number];
export type ValidationStatus = (typeof validationStatuses)[number];
export type SectionBlueprintType = (typeof sectionBlueprintTypes)[number];
export type ReferenceIntake = z.infer<typeof referenceIntakeSchema>;

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
  pageType: "landing_page";
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
  intake: ReferenceIntake;
  stages: JobStage[];
  artifacts: GeneratedThemeArtifact[];
  analysis?: ReferenceAnalysis;
  mapping?: ThemeMapping;
  generation?: GenerationResult;
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
}

export interface AppRuntimeConfig {
  themeWorkspacePath: string;
  previewCommand: string;
}

function createPendingArtifacts(): GeneratedThemeArtifact[] {
  return [
    {
      kind: "section",
      path: stableThemeArtifacts.section,
      status: "pending",
      description: "Primary generated landing section output"
    },
    {
      kind: "template",
      path: stableThemeArtifacts.template,
      status: "pending",
      description: "Generated JSON template that references the stable landing section"
    }
  ];
}

export function createReplicationJob(intake: ReferenceIntake): ReplicationJob {
  const parsedIntake = referenceIntakeSchema.parse(intake);
  const timestamp = new Date().toISOString();

  return {
    id: `job_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
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
          summary: "Preparing deterministic landing-page analysis.",
          startedAt: timestamp
        };
      }

      return {
        name,
        status: "pending" as const,
        summary: `Waiting for ${name.replaceAll("_", " ")}.`
      };
    }),
    artifacts: createPendingArtifacts(),
    validation: {
      status: "pending",
      summary: "Theme validation has not run yet."
    },
    createdAt: timestamp,
    updatedAt: timestamp
  };
}
