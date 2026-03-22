import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import type {
  AppRuntimeConfig,
  ReplicationJob,
  ReplicationJobSummary
} from "@shopify-web-replicator/shared";
import { pageTypeLabels } from "@shopify-web-replicator/shared";

type HandoffPageProps = {
  loadJob: (jobId: string) => Promise<ReplicationJob>;
  loadRuntime: () => Promise<AppRuntimeConfig>;
};

type LatestHandoffPageProps = {
  loadRecentJobs: (limit?: number) => Promise<ReplicationJobSummary[]>;
};

function formatTimestamp(value?: string): string {
  if (!value) {
    return "Pending";
  }

  return new Date(value).toLocaleString();
}

export function HandoffPage({ loadJob, loadRuntime }: HandoffPageProps) {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<ReplicationJob | null>(null);
  const [runtime, setRuntime] = useState<AppRuntimeConfig | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const currentJobId = jobId ?? "";

    if (!currentJobId) {
      setErrorMessage("Missing job id.");
      return;
    }

    let isCancelled = false;

    async function syncHandoff() {
      try {
        const [loadedJob, loadedRuntime] = await Promise.all([
          loadJob(currentJobId),
          loadRuntime()
        ]);

        if (isCancelled) {
          return;
        }

        setJob(loadedJob);
        setRuntime(loadedRuntime);
        setErrorMessage(null);
      } catch {
        if (!isCancelled) {
          setErrorMessage("Unable to load the handoff view.");
        }
      }
    }

    void syncHandoff();

    return () => {
      isCancelled = true;
    };
  }, [jobId, loadJob, loadRuntime]);

  if (errorMessage) {
    return (
      <section className="panel">
        <p className="error">{errorMessage}</p>
      </section>
    );
  }

  if (!job || !runtime) {
    return (
      <section className="panel">
        <p className="lede">Loading handoff details...</p>
      </section>
    );
  }

  return (
    <section className="panel stack">
      <div>
        <div className="eyebrow">Theme Handoff</div>
        <h1>Local Shopify theme workspace</h1>
        <p className="lede">
          Review the generated files for <strong>{job.id}</strong> before preview or publish.
        </p>
        <p className="lede">
          Page type: <strong>{pageTypeLabels[job.intake.pageType ?? "landing_page"]}</strong>
        </p>
      </div>

      <dl className="handoff-grid">
        <div>
          <dt>Workspace path</dt>
          <dd>{runtime.themeWorkspacePath}</dd>
        </div>
        <div>
          <dt>Preview command</dt>
          <dd>{runtime.previewCommand}</dd>
        </div>
        <div>
          <dt>Validation status</dt>
          <dd>{job.validation.status}</dd>
        </div>
        <div>
          <dt>Review expectation</dt>
          <dd>Check layout parity, store setup scope, commerce wiring, and the integration report before preview or publish.</dd>
        </div>
      </dl>

      <div className="stack">
        <h2>Generated artifacts</h2>
        <ul className="artifact-list">
          {job.artifacts.map((artifact) => (
            <li key={artifact.path}>
              <div className="artifact-details">
                <strong>{artifact.path}</strong>
                <span>{artifact.description}</span>
                <span>Status: {artifact.status}</span>
                <span>Last written: {formatTimestamp(artifact.lastWrittenAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="stack">
        <h2>Theme validation</h2>
        <p>{job.validation.summary}</p>
        {job.validation.output ? <pre className="validation-output">{job.validation.output}</pre> : null}
      </div>

      {job.storeSetup ? (
        <div className="stack">
          <h2>Store setup plan</h2>
          <p>{job.storeSetup.summary}</p>
          <p>Config path: {job.storeSetup.configPath}</p>
          <ul className="artifact-list">
            {job.storeSetup.products.map((product) => (
              <li key={product.handle}>
                <div className="artifact-details">
                  <strong>{product.handle}</strong>
                  <span>{product.title}</span>
                  <span>{product.merchandisingRole}</span>
                </div>
              </li>
            ))}
            {job.storeSetup.collections.map((collection) => (
              <li key={collection.handle}>
                <div className="artifact-details">
                  <strong>{collection.handle}</strong>
                  <span>{collection.title}</span>
                  <span>{collection.rule}</span>
                </div>
              </li>
            ))}
            {job.storeSetup.menus.map((menu) => (
              <li key={menu.handle}>
                <div className="artifact-details">
                  <strong>{menu.handle}</strong>
                  <span>{menu.title}</span>
                  <span>{menu.items.map((item) => `${item.title} -> ${item.target}`).join(" | ")}</span>
                </div>
              </li>
            ))}
            {job.storeSetup.contentModels.map((model) => (
              <li key={model.name}>
                <div className="artifact-details">
                  <strong>{model.name}</strong>
                  <span>{model.type}</span>
                  <span>{model.fields.join(", ")}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {job.commerce ? (
        <div className="stack">
          <h2>Commerce wiring</h2>
          <p>{job.commerce.summary}</p>
          <p>Snippet path: {job.commerce.snippetPath}</p>
          <p>Cart path: {job.commerce.cartPath}</p>
          <p>Checkout path: {job.commerce.checkoutPath}</p>
          <ul className="artifact-list">
            {job.commerce.entrypoints.map((entrypoint) => (
              <li key={`${entrypoint.label}-${entrypoint.target}`}>
                <div className="artifact-details">
                  <strong>{entrypoint.label}</strong>
                  <span>{entrypoint.target}</span>
                  <span>{entrypoint.behavior}</span>
                </div>
              </li>
            ))}
            {job.commerce.qaChecklist.map((check) => (
              <li key={check}>
                <div className="artifact-details">
                  <strong>{check}</strong>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {job.integration ? (
        <div className="stack">
          <h2>Integration report</h2>
          <p>{job.integration.summary}</p>
          <p>Report path: {job.integration.reportPath}</p>
          <p>Integration status: {job.integration.status}</p>
          <p>Checked at: {formatTimestamp(job.integration.checkedAt)}</p>
          <ul className="artifact-list">
            {job.integration.checks.map((check) => (
              <li key={check.id}>
                <div className="artifact-details">
                  <strong>{check.id}</strong>
                  <span>{check.status}</span>
                  <span>{check.details}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="stack">
        <h2>Operator checklist</h2>
        <ul className="checklist">
          <li>Confirm the generated layout matches the reference intent closely enough for QA.</li>
          <li>Verify content blocks and calls to action are mapped to the right section structure.</li>
          <li>Review the generated products, collections, menus, and structured content plan before store setup.</li>
          <li>Review the commerce wiring snippet, cart path, and checkout handoff before publish.</li>
          <li>Review the integration report and resolve any failed consistency checks before preview.</li>
          <li>Run the preview command and check cart to native Shopify checkout handoff.</li>
        </ul>
      </div>

      <Link className="secondary-link" to={`/jobs/${job.id}`}>
        Return to job detail
      </Link>
    </section>
  );
}

export function LatestHandoffPage({ loadRecentJobs }: LatestHandoffPageProps) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function resolveLatestJob() {
      try {
        const [latestJob] = await loadRecentJobs(1);

        if (isCancelled) {
          return;
        }

        setJobId(latestJob?.jobId ?? null);
        setErrorMessage(null);
      } catch {
        if (!isCancelled) {
          setErrorMessage("Unable to locate the latest handoff job.");
        }
      }
    }

    void resolveLatestJob();

    return () => {
      isCancelled = true;
    };
  }, [loadRecentJobs]);

  if (jobId) {
    return <Navigate replace to={`/jobs/${jobId}/handoff`} />;
  }

  return (
    <section className="panel">
      <div className="eyebrow">Theme Handoff</div>
      <h1>No handoff job available yet</h1>
      <p className="lede">{errorMessage ?? "Create a replication job first, then return here for the latest handoff."}</p>
      <Link className="secondary-link" to="/">
        Return to intake
      </Link>
    </section>
  );
}
