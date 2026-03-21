import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HandoffPage } from "./HandoffPage";

describe("HandoffPage", () => {
  it("shows the selected job handoff with runtime config and validation output", async () => {
    const loadJob = async () => ({
      id: "job_123",
      status: "needs_review",
      currentStage: "review",
      intake: {
        referenceUrl: "https://example.com"
      },
      stages: [],
      artifacts: [
        {
          kind: "section",
          path: "sections/generated-reference.liquid",
          status: "generated",
          description: "Primary generated landing section output",
          lastWrittenAt: "2026-03-20T12:03:00.000Z"
        }
      ],
      validation: {
        status: "passed",
        summary: "Theme check passed.",
        output: "No theme issues detected."
      },
      createdAt: "2026-03-20T12:00:00.000Z",
      updatedAt: "2026-03-20T12:03:00.000Z"
    });
    const loadRuntime = async () => ({
      themeWorkspacePath: "/tmp/theme-workspace",
      previewCommand: "shopify theme dev"
    });

    render(
      <MemoryRouter initialEntries={["/jobs/job_123/handoff"]}>
        <Routes>
          <Route
            path="/jobs/:jobId/handoff"
            element={<HandoffPage loadJob={loadJob} loadRuntime={loadRuntime} />}
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/local shopify theme workspace/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/\/tmp\/theme-workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/shopify theme dev/i)).toBeInTheDocument();
    expect(screen.getByText(/no theme issues detected/i)).toBeInTheDocument();
    expect(screen.getByText(/sections\/generated-reference\.liquid/i)).toBeInTheDocument();
  });
});
