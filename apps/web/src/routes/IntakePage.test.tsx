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
      currentStage: "source_qualification",
      status: "in_progress"
    });

    render(
      <MemoryRouter>
        <IntakePage
          submitReference={submitReference}
          loadRecentJobs={vi.fn().mockResolvedValue([])}
          loadDestinationStores={vi.fn().mockResolvedValue([
            {
              id: "local-dev-store",
              label: "Local Dev Store",
              shopDomain: "local-dev-store.myshopify.com"
            }
          ])}
        />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/reference url/i), "https://example.com");
    await user.selectOptions(screen.getByLabelText(/destination store/i), "local-dev-store");
    await user.selectOptions(screen.getByLabelText(/page type/i), "product_page");
    await user.type(screen.getByLabelText(/notes/i), "Match the homepage hero");
    await user.click(screen.getByRole("button", { name: /start replication/i }));

    await waitFor(() => {
      expect(submitReference).toHaveBeenCalledWith({
        referenceUrl: "https://example.com",
        destinationStore: "local-dev-store",
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
        pageType: "collection_page",
        destinationStore: "local-dev-store"
      }
    ]);

    render(
      <MemoryRouter>
        <IntakePage
          submitReference={submitReference}
          loadRecentJobs={loadRecentJobs}
          loadDestinationStores={vi.fn().mockResolvedValue([
            {
              id: "local-dev-store",
              label: "Local Dev Store",
              shopDomain: "local-dev-store.myshopify.com"
            }
          ])}
        />
      </MemoryRouter>
    );

    expect(await screen.findByText(/recent jobs/i)).toBeInTheDocument();
    expect(screen.getByText(/page type: collection page/i)).toBeInTheDocument();
    expect(screen.getByText(/destination: local-dev-store/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view job job_latest/i })).toHaveAttribute(
      "href",
      "/jobs/job_latest"
    );
    expect(screen.getByRole("link", { name: /handoff for job_latest/i })).toHaveAttribute(
      "href",
      "/jobs/job_latest/handoff"
    );
  });

  it("shows destination store load failure and keeps submission disabled", async () => {
    const submitReference = vi.fn().mockResolvedValue({
      jobId: "job_123",
      currentStage: "source_qualification",
      status: "in_progress"
    });

    render(
      <MemoryRouter>
        <IntakePage
          submitReference={submitReference}
          loadRecentJobs={vi.fn().mockResolvedValue([])}
          loadDestinationStores={vi.fn().mockRejectedValue(new Error("offline"))}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/unable to load destination stores\./i)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /start replication/i })).toBeDisabled();
    expect(submitReference).not.toHaveBeenCalled();
  });

  it("shows recent jobs load failure without breaking the intake form", async () => {
    render(
      <MemoryRouter>
        <IntakePage
          submitReference={vi.fn().mockResolvedValue({
            jobId: "job_123",
            currentStage: "source_qualification",
            status: "in_progress"
          })}
          loadRecentJobs={vi.fn().mockRejectedValue(new Error("bad network"))}
          loadDestinationStores={vi.fn().mockResolvedValue([
            {
              id: "local-dev-store",
              label: "Local Dev Store",
              shopDomain: "local-dev-store.myshopify.com"
            }
          ])}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/unable to load recent jobs\./i)).toBeInTheDocument();
    });

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("shows a clear error when submit fails", async () => {
    const user = userEvent.setup();
    const submitReference = vi.fn().mockRejectedValue(new Error("queue unavailable"));

    render(
      <MemoryRouter>
        <IntakePage
          submitReference={submitReference}
          loadRecentJobs={vi.fn().mockResolvedValue([])}
          loadDestinationStores={vi.fn().mockResolvedValue([
            {
              id: "local-dev-store",
              label: "Local Dev Store",
              shopDomain: "local-dev-store.myshopify.com"
            }
          ])}
        />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/reference url/i), "https://example.com");
    await user.selectOptions(screen.getByLabelText(/destination store/i), "local-dev-store");
    await user.click(screen.getByRole("button", { name: /start replication/i }));

    await waitFor(() => {
      expect(submitReference).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/reference intake request failed/i)).toBeInTheDocument();
    });
  });
});
