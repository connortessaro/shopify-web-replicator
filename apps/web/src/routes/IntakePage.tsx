import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import type { ReferenceIntake, ReplicationJobSummary } from "@shopify-web-replicator/shared";

type IntakePageProps = {
  submitReference: (intake: ReferenceIntake) => Promise<ReplicationJobSummary>;
};

export function IntakePage({ submitReference }: IntakePageProps) {
  const navigate = useNavigate();
  const [referenceUrl, setReferenceUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const payload: ReferenceIntake = {
        referenceUrl: referenceUrl.trim(),
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
    <section className="panel">
      <div className="eyebrow">Operator Intake</div>
      <h1>Capture a reference storefront and start the replication pipeline.</h1>
      <p className="lede">
        This dashboard creates an internal replication job. The generated Shopify theme files
        land in the local theme workspace for review before handoff.
      </p>

      <form className="stack" onSubmit={handleSubmit}>
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
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Starting..." : "Start replication"}
          </button>
        </div>

        {errorMessage ? <p className="error">{errorMessage}</p> : null}
      </form>
    </section>
  );
}
