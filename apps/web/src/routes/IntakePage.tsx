import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  pageTypeLabels,
  pageTypes,
  type DestinationStoreProfile,
  type ReferenceIntake,
  type ReplicationJobSummary
} from "@shopify-web-replicator/shared";

type IntakePageProps = {
  submitReference: (intake: ReferenceIntake) => Promise<ReplicationJobSummary>;
  loadRecentJobs?: (limit?: number) => Promise<ReplicationJobSummary[]>;
  loadDestinationStores?: () => Promise<DestinationStoreProfile[]>;
  recentJobsLimit?: number;
};

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

export function IntakePage({
  submitReference,
  loadRecentJobs = async () => [],
  loadDestinationStores = async () => [],
  recentJobsLimit = 5
}: IntakePageProps) {
  const navigate = useNavigate();
  const [referenceUrl, setReferenceUrl] = useState("");
  const [pageType, setPageType] = useState("landing_page");
  const [destinationStore, setDestinationStore] = useState("");
  const [notes, setNotes] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentJobs, setRecentJobs] = useState<ReplicationJobSummary[]>([]);
  const [recentJobsError, setRecentJobsError] = useState<string | null>(null);
  const [destinationStores, setDestinationStores] = useState<DestinationStoreProfile[]>([]);
  const [destinationStoresError, setDestinationStoresError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function syncRecentJobs() {
      try {
        const jobs = await loadRecentJobs(recentJobsLimit);

        if (!isCancelled) {
          setRecentJobs(jobs);
          setRecentJobsError(null);
        }
      } catch {
        if (!isCancelled) {
          setRecentJobsError("Unable to load recent jobs.");
        }
      }
    }

    void syncRecentJobs();

    return () => {
      isCancelled = true;
    };
  }, [loadRecentJobs, recentJobsLimit]);

  useEffect(() => {
    let isCancelled = false;

    async function syncDestinationStores() {
      try {
        const stores = await loadDestinationStores();

        if (isCancelled) {
          return;
        }

        setDestinationStores(stores);
        setDestinationStore((currentValue) => currentValue || stores[0]?.id || "");
        setDestinationStoresError(
          stores.length === 0 ? "No destination stores are configured for replication." : null
        );
      } catch {
        if (!isCancelled) {
          setDestinationStoresError("Unable to load destination stores.");
        }
      }
    }

    void syncDestinationStores();

    return () => {
      isCancelled = true;
    };
  }, [loadDestinationStores]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const payload: ReferenceIntake = {
        referenceUrl: referenceUrl.trim(),
        destinationStore,
        pageType,
        notes: notes.trim() || undefined
      };

      const job = await submitReference(payload);
      navigate(`/jobs/${job.jobId}`);
    } catch {
      setErrorMessage("The reference intake request failed. Check the API and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="eyebrow">Operator Intake</div>
        <h1>Capture a reference storefront and start the replication pipeline.</h1>
        <p className="lede">
          This dashboard creates an internal replication job. The generated Shopify theme files
          land in the local theme workspace for review before handoff.
        </p>

        <form className="stack" onSubmit={handleSubmit}>
          <label className="field">
            <span>Destination Store</span>
            <select
              aria-label="Destination Store"
              name="destinationStore"
              required
              value={destinationStore}
              onChange={(event) => setDestinationStore(event.target.value)}
            >
              {destinationStores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.label} ({store.shopDomain})
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Reference URL</span>
            <input
              aria-label="Reference URL"
              type="url"
              name="referenceUrl"
              placeholder="https://example.com"
              required
              value={referenceUrl}
              onChange={(event) => setReferenceUrl(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Page Type</span>
            <select
              aria-label="Page Type"
              name="pageType"
              value={pageType}
              onChange={(event) => setPageType(event.target.value)}
            >
              {pageTypes.map((pageTypeOption) => (
                <option key={pageTypeOption} value={pageTypeOption}>
                  {pageTypeLabels[pageTypeOption]}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Notes</span>
            <textarea
              aria-label="Notes"
              name="notes"
              rows={5}
              placeholder="What should the replicator prioritize?"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>

          <div className="actions">
            <button type="submit" disabled={isSubmitting || destinationStores.length === 0}>
              {isSubmitting ? "Starting..." : "Start replication"}
            </button>
          </div>

          {destinationStoresError ? <p className="error">{destinationStoresError}</p> : null}
          {errorMessage ? <p className="error">{errorMessage}</p> : null}
        </form>
      </section>

      <section className="panel stack">
        <div>
          <div className="eyebrow">Recent Jobs</div>
          <h2>Resume operator work</h2>
        </div>

        {recentJobsError ? <p className="error">{recentJobsError}</p> : null}
        {!recentJobsError && recentJobs.length === 0 ? <p className="lede">No jobs have been created yet.</p> : null}

        {recentJobs.length > 0 ? (
          <ul className="artifact-list">
            {recentJobs.map((job) => (
              <li key={job.jobId}>
                <div className="artifact-details">
                  <strong>{job.jobId}</strong>
                  <span>Page type: {pageTypeLabels[job.pageType ?? "landing_page"]}</span>
                  <span>Destination: {job.destinationStore}</span>
                  <span>Status: {job.status}</span>
                  <span>Current stage: {job.currentStage}</span>
                  <span>Created: {formatTimestamp(job.createdAt)}</span>
                </div>
                <div className="recent-job-links">
                  <Link className="secondary-link" to={`/jobs/${job.jobId}`}>
                    View job {job.jobId}
                  </Link>
                  <Link className="secondary-link" to={`/jobs/${job.jobId}/handoff`}>
                    Handoff for {job.jobId}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
