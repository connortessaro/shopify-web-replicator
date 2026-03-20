import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createReplicationJob } from "@shopify-web-replicator/shared";

import { JobDetailPage } from "./JobDetailPage";

describe("JobDetailPage", () => {
  it("renders job stage data from the loader", async () => {
    const job = createReplicationJob({
      referenceUrl: "https://example.com/collection",
      notes: "Collection page rebuild"
    });
    const loadJob = vi.fn().mockResolvedValue(job);

    render(
      <MemoryRouter initialEntries={[`/jobs/${job.id}`]}>
        <Routes>
          <Route path="/jobs/:jobId" element={<JobDetailPage loadJob={loadJob} />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(loadJob).toHaveBeenCalledWith(job.id);
    });

    expect(await screen.findByText(/collection page rebuild/i)).toBeInTheDocument();
    expect(screen.getByText(/theme_generation/i)).toBeInTheDocument();
  });
});

