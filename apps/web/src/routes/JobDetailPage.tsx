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
        <p className="lede">
          Destination store: <strong>{job.intake.destinationStore}</strong>
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

      {job.sourceQualification ? (
        <div className="panel stack">
          <h2>Source qualification</h2>
          <p>{job.sourceQualification.summary}</p>
          <p className="lede">
            Qualification status: <strong>{job.sourceQualification.status}</strong>
          </p>
          <p className="lede">
            Platform: <strong>{job.sourceQualification.platform}</strong>
          </p>
          <p className="lede">
            Resolved source: <strong>{job.sourceQualification.resolvedUrl}</strong>
          </p>
          {job.sourceQualification.httpStatus !== undefined ? (
            <p className="lede">
              HTTP status: <strong>{job.sourceQualification.httpStatus}</strong>
            </p>
          ) : null}
          {job.sourceQualification.failureCode ? (
            <p className="lede">
              Failure code: <strong>{job.sourceQualification.failureCode}</strong>
            </p>
          ) : null}
          {job.sourceQualification.failureReason ? <p>{job.sourceQualification.failureReason}</p> : null}
          {job.sourceQualification.evidence.length > 0 ? (
            <ul className="artifact-list">
              {job.sourceQualification.evidence.map((evidence) => (
                <li key={evidence}>
                  <span>evidence</span>
                  <strong>{evidence}</strong>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {job.capture ? (
        <div className="panel stack">
          <h2>Reference capture</h2>
          <p>
            Captured <strong>{job.capture.title}</strong> from {job.capture.referenceHost}.
          </p>
          <p className="lede">
            Resolved URL: <strong>{job.capture.resolvedUrl}</strong>
          </p>
          <p className="lede">
            Captured at: <strong>{formatTimestamp(job.capture.capturedAt)}</strong>
          </p>
          <p className="lede">
            Capture bundle: <strong>{job.capture.captureBundlePath}</strong>
          </p>
          <p className="lede">
            Desktop screenshot: <strong>{job.capture.desktopScreenshotPath}</strong>
          </p>
          <p className="lede">
            Mobile screenshot: <strong>{job.capture.mobileScreenshotPath}</strong>
          </p>
          {job.capture.description ? <p>{job.capture.description}</p> : null}
          <ul className="artifact-list">
            <li>
              <span>headings</span>
              <strong>{job.capture.headingOutline.length}</strong>
            </li>
            <li>
              <span>navigation links</span>
              <strong>{job.capture.navigationLinks.length}</strong>
            </li>
            <li>
              <span>primary CTAs</span>
              <strong>{job.capture.primaryCtas.length}</strong>
            </li>
            <li>
              <span>images</span>
              <strong>{job.capture.imageAssets.length}</strong>
            </li>
          </ul>
          {job.capture.headingOutline.length > 0 ? (
            <ul className="artifact-list">
              {job.capture.headingOutline.map((heading) => (
                <li key={heading}>
                  <span>heading</span>
                  <strong>{heading}</strong>
                </li>
              ))}
            </ul>
          ) : null}
          <ul className="artifact-list">
            <li>
              <span>fonts</span>
              <strong>{job.capture.styleTokens.fontFamilies.join(", ") || "None detected"}</strong>
            </li>
            <li>
              <span>dominant colors</span>
              <strong>{job.capture.styleTokens.dominantColors.join(", ") || "None detected"}</strong>
            </li>
            <li>
              <span>product handles</span>
              <strong>{job.capture.routeHints.productHandles.join(", ") || "None detected"}</strong>
            </li>
            <li>
              <span>collection handles</span>
              <strong>{job.capture.routeHints.collectionHandles.join(", ") || "None detected"}</strong>
            </li>
          </ul>
        </div>
      ) : null}

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

      {job.storeSetup ? (
        <div className="panel stack">
          <h2>Store setup bundle</h2>
          <p>{job.storeSetup.summary}</p>
          <p className="lede">
            Config path: <strong>{job.storeSetup.configPath}</strong>
          </p>
          <p className="lede">
            Import bundle path: <strong>{job.storeSetup.importBundlePath}</strong>
          </p>
          <ul className="artifact-list">
            {job.storeSetup.products.map((product) => (
              <li key={product.handle}>
                <span>product</span>
                <div className="artifact-details">
                  <strong>{product.handle}</strong>
                  <span>{product.title}</span>
                  <span>{product.merchandisingRole}</span>
                </div>
              </li>
            ))}
            {job.storeSetup.collections.map((collection) => (
              <li key={collection.handle}>
                <span>collection</span>
                <div className="artifact-details">
                  <strong>{collection.handle}</strong>
                  <span>{collection.title}</span>
                  <span>{collection.rule}</span>
                </div>
              </li>
            ))}
            {job.storeSetup.menus.map((menu) => (
              <li key={menu.handle}>
                <span>menu</span>
                <div className="artifact-details">
                  <strong>{menu.handle}</strong>
                  <span>{menu.title}</span>
                  <span>{menu.items.map((item) => `${item.title} -> ${item.target}`).join(" | ")}</span>
                </div>
              </li>
            ))}
            {job.storeSetup.contentModels.map((model) => (
              <li key={model.name}>
                <span>{model.type}</span>
                <div className="artifact-details">
                  <strong>{model.name}</strong>
                  <span>{model.fields.join(", ")}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {job.commerce ? (
        <div className="panel stack">
          <h2>Commerce wiring</h2>
          <p>{job.commerce.summary}</p>
          <p className="lede">
            Snippet path: <strong>{job.commerce.snippetPath}</strong>
          </p>
          <p className="lede">
            Cart path: <strong>{job.commerce.cartPath}</strong>
          </p>
          <p className="lede">
            Checkout path: <strong>{job.commerce.checkoutPath}</strong>
          </p>
          <ul className="artifact-list">
            {job.commerce.entrypoints.map((entrypoint) => (
              <li key={`${entrypoint.label}-${entrypoint.target}`}>
                <span>entrypoint</span>
                <div className="artifact-details">
                  <strong>{entrypoint.label}</strong>
                  <span>{entrypoint.target}</span>
                  <span>{entrypoint.behavior}</span>
                </div>
              </li>
            ))}
            {job.commerce.qaChecklist.map((check) => (
              <li key={check}>
                <span>qa</span>
                <div className="artifact-details">
                  <strong>{check}</strong>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {job.integration ? (
        <div className="panel stack">
          <h2>Integration report</h2>
          <p>{job.integration.summary}</p>
          <p className="lede">
            Report path: <strong>{job.integration.reportPath}</strong>
          </p>
          <p className="lede">
            Integration status: <strong>{job.integration.status}</strong>
          </p>
          <p className="lede">
            Checked at: <strong>{formatTimestamp(job.integration.checkedAt)}</strong>
          </p>
          <ul className="artifact-list">
            {job.integration.checks.map((check) => (
              <li key={check.id}>
                <span>{check.status}</span>
                <div className="artifact-details">
                  <strong>{check.id}</strong>
                  <span>{check.details}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="panel stack">
        <h2>Theme validation</h2>
        <p>{job.validation.summary}</p>
        <p className="lede">Validation status: {job.validation.status}</p>
        <p className="lede">Checked at: {formatTimestamp(job.validation.checkedAt)}</p>
        {job.validation.output ? <pre className="validation-output">{job.validation.output}</pre> : null}
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
