import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { pageTypeLabels, type ReplicationJob } from "@shopify-web-replicator/shared";

type JobDetailPageProps = {
  loadJob: (jobId: string) => Promise<ReplicationJob>;
  refreshIntervalMs?: number;
};

function formatTimestamp(value?: string): string {
  if (!value) {
    return "Pending";
  }

  return new Date(value).toLocaleString();
}

export function JobDetailPage({ loadJob, refreshIntervalMs = 2_000 }: JobDetailPageProps) {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<ReplicationJob | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      setErrorMessage("Missing job id.");
      return;
    }

    const currentJobId = jobId;
    let isCancelled = false;
    let timeoutId: number | undefined;

    async function syncJob() {
      try {
        const loadedJob = await loadJob(currentJobId);

        if (isCancelled) {
          return;
        }

        setJob(loadedJob);

        if (loadedJob.status === "queued" || loadedJob.status === "in_progress") {
          timeoutId = window.setTimeout(syncJob, refreshIntervalMs);
        }
      } catch {
        if (!isCancelled) {
          setErrorMessage("Unable to load the requested job.");
        }
      }
    }

    void syncJob();

    return () => {
      isCancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [jobId, loadJob, refreshIntervalMs]);

  if (errorMessage) {
    return (
      <section className="panel">
        <p className="error">{errorMessage}</p>
      </section>
    );
  }

  if (!job) {
    return (
      <section className="panel">
        <p className="lede">Loading replication job...</p>
      </section>
    );
  }

  return (
    <section className="stack">
      <div className="panel">
        <div className="eyebrow">Job Detail</div>
        <h1>{job.intake.referenceUrl}</h1>
        <p className="lede">
          Status: <strong>{job.status}</strong>
        </p>
        <p className="lede">
          Current stage: <strong>{job.currentStage}</strong>
        </p>
        <p className="lede">
          Page type: <strong>{pageTypeLabels[job.intake.pageType ?? "landing_page"]}</strong>
        </p>
        <p>{job.intake.notes ?? "No operator notes were added to this job."}</p>
        {job.error ? (
          <div className="job-alert job-alert--error">
            <strong>{job.error.stage}</strong>
            <span>{job.error.message}</span>
          </div>
        ) : null}
      </div>

      <div className="panel">
        <h2>Pipeline stages</h2>
        <ul className="stage-list">
          {job.stages.map((stage) => (
            <li key={stage.name} className={`stage-card stage-card--${stage.status}`}>
              <div className="stage-name">{stage.name}</div>
              <div className="stage-status">{stage.status}</div>
              {stage.summary ? <p className="stage-summary">{stage.summary}</p> : null}
              <div className="stage-time">Started: {formatTimestamp(stage.startedAt)}</div>
              <div className="stage-time">Completed: {formatTimestamp(stage.completedAt)}</div>
              {stage.errorMessage ? <div className="stage-error">{stage.errorMessage}</div> : null}
            </li>
          ))}
        </ul>
      </div>

      {job.analysis ? (
        <div className="panel stack">
          <h2>Analysis summary</h2>
          <p>{job.analysis.summary}</p>
          <p className="lede">
            Reference host: <strong>{job.analysis.referenceHost}</strong>
          </p>
          <ul className="artifact-list">
            {job.analysis.recommendedSections.map((sectionType) => (
              <li key={sectionType}>
                <span>recommended section</span>
                <strong>{sectionType}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {job.mapping ? (
        <div className="panel stack">
          <h2>Mapping summary</h2>
          <p>{job.mapping.summary}</p>
          <ul className="artifact-list">
            {job.mapping.sections.map((section) => (
              <li key={section.id}>
                <span>{section.type}</span>
                <strong>{section.heading ?? section.body ?? section.id}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="panel stack">
        <h2>Theme validation</h2>
        <p>{job.validation.summary}</p>
        <p className="lede">Validation status: {job.validation.status}</p>
      </div>

      <div className="panel">
        <h2>Generated artifacts</h2>
        <ul className="artifact-list">
          {job.artifacts.map((artifact) => (
            <li key={artifact.path}>
              <span>{artifact.kind}</span>
              <div className="artifact-details">
                <strong>{artifact.path}</strong>
                <span>{artifact.description}</span>
                <span>Status: {artifact.status}</span>
                <span>Last written: {formatTimestamp(artifact.lastWrittenAt)}</span>
              </div>
            </li>
          ))}
        </ul>
        <Link className="secondary-link" to={`/jobs/${job.id}/handoff`}>
          Review theme workspace handoff
        </Link>
      </div>
    </section>
  );
}
