import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import type { ReplicationJob } from "@shopify-web-replicator/shared";

type JobDetailPageProps = {
  loadJob: (jobId: string) => Promise<ReplicationJob>;
};

export function JobDetailPage({ loadJob }: JobDetailPageProps) {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<ReplicationJob | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      setErrorMessage("Missing job id.");
      return;
    }

    let isCancelled = false;

    loadJob(jobId)
      .then((loadedJob) => {
        if (!isCancelled) {
          setJob(loadedJob);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setErrorMessage("Unable to load the requested job.");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [jobId, loadJob]);

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
          Current stage: <strong>{job.currentStage}</strong>
        </p>
        <p>{job.intake.notes ?? "No operator notes were added to this job."}</p>
      </div>

      <div className="panel">
        <h2>Pipeline stages</h2>
        <ul className="stage-list">
          {job.stages.map((stage) => (
            <li key={stage.name} className={`stage-card stage-card--${stage.status}`}>
              <div className="stage-name">{stage.name}</div>
              <div className="stage-status">{stage.status}</div>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <h2>Generated artifacts</h2>
        <ul className="artifact-list">
          {job.artifacts.map((artifact) => (
            <li key={artifact.path}>
              <span>{artifact.kind}</span>
              <strong>{artifact.path}</strong>
            </li>
          ))}
        </ul>
        <Link className="secondary-link" to="/handoff">
          Review theme workspace handoff
        </Link>
      </div>
    </section>
  );
}
