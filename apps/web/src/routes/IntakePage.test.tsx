import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { IntakePage } from "./IntakePage";

describe("IntakePage", () => {
  it("submits the reference intake payload", async () => {
    const user = userEvent.setup();
    const submitReference = vi.fn().mockResolvedValue({
      jobId: "job_123",
      currentStage: "intake",
      status: "in_progress"
    });

    render(
      <MemoryRouter>
        <IntakePage submitReference={submitReference} loadRecentJobs={vi.fn().mockResolvedValue([])} />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/reference url/i), "https://example.com");
    await user.selectOptions(screen.getByLabelText(/page type/i), "product_page");
    await user.type(screen.getByLabelText(/notes/i), "Match the homepage hero");
    await user.click(screen.getByRole("button", { name: /start replication/i }));

    await waitFor(() => {
      expect(submitReference).toHaveBeenCalledWith({
        referenceUrl: "https://example.com",
        notes: "Match the homepage hero",
        pageType: "product_page"
      });
    });
  });

  it("renders recent jobs with direct links to detail and handoff views", async () => {
    const submitReference = vi.fn().mockResolvedValue({
      jobId: "job_123",
      currentStage: "analysis",
      status: "in_progress"
    });
    const loadRecentJobs = vi.fn().mockResolvedValue([
      {
        jobId: "job_latest",
        currentStage: "review",
        status: "needs_review",
        createdAt: "2026-03-20T12:00:00.000Z",
        pageType: "collection_page"
      }
    ]);

    render(
      <MemoryRouter>
        <IntakePage submitReference={submitReference} loadRecentJobs={loadRecentJobs} />
      </MemoryRouter>
    );

    expect(await screen.findByText(/recent jobs/i)).toBeInTheDocument();
    expect(screen.getByText(/page type: collection page/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view job job_latest/i })).toHaveAttribute(
      "href",
      "/jobs/job_latest"
    );
    expect(screen.getByRole("link", { name: /handoff for job_latest/i })).toHaveAttribute(
      "href",
      "/jobs/job_latest/handoff"
    );
  });
});
