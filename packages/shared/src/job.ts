import { randomUUID } from "node:crypto";

import { z } from "zod";

export const pipelineStages = [
  "intake",
  "analysis",
  "mapping",
  "theme_generation",
  "review"
] as const;

export const stageStatuses = ["pending", "current", "complete"] as const;
export const jobStatuses = ["queued", "in_progress", "needs_review", "completed"] as const;
export const artifactKinds = ["section", "template", "snippet", "config"] as const;
export const artifactStatuses = ["placeholder", "generated"] as const;

export const referenceIntakeSchema = z.object({
  referenceUrl: z.string().url(),
  notes: z.string().trim().min(1).optional()
});

export type PipelineStage = (typeof pipelineStages)[number];
export type StageStatus = (typeof stageStatuses)[number];
export type JobStatus = (typeof jobStatuses)[number];
export type ArtifactKind = (typeof artifactKinds)[number];
export type ArtifactStatus = (typeof artifactStatuses)[number];
export type ReferenceIntake = z.infer<typeof referenceIntakeSchema>;

export interface JobStage {
  name: PipelineStage;
  status: StageStatus;
}

export interface GeneratedThemeArtifact {
  kind: ArtifactKind;
  path: string;
  status: ArtifactStatus;
  description: string;
}

export interface ReplicationJob {
  id: string;
  status: JobStatus;
  currentStage: PipelineStage;
  intake: ReferenceIntake;
  stages: JobStage[];
  artifacts: GeneratedThemeArtifact[];
  createdAt: string;
  updatedAt: string;
}

export interface ReplicationJobSummary {
  jobId: string;
  status: JobStatus;
  currentStage: PipelineStage;
  createdAt: string;
}

const placeholderArtifacts: GeneratedThemeArtifact[] = [
  {
    kind: "section",
    path: "sections/generated-reference.liquid",
    status: "placeholder",
    description: "Primary generated landing section output"
  },
  {
    kind: "template",
    path: "templates/page.generated-reference.json",
    status: "placeholder",
    description: "Generated JSON template that references generated sections"
  }
];

export function createReplicationJob(intake: ReferenceIntake): ReplicationJob {
  const parsedIntake = referenceIntakeSchema.parse(intake);
  const timestamp = new Date().toISOString();

  return {
    id: `job_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
    status: "in_progress",
    currentStage: "intake",
    intake: parsedIntake,
    stages: pipelineStages.map((name, index) => ({
      name,
      status: index === 0 ? "current" : "pending"
    })),
    artifacts: placeholderArtifacts,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}
