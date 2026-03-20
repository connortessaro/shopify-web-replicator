import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
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
        <IntakePage submitReference={submitReference} />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/reference url/i), "https://example.com");
    await user.type(screen.getByLabelText(/notes/i), "Match the homepage hero");
    await user.click(screen.getByRole("button", { name: /start replication/i }));

    expect(submitReference).toHaveBeenCalledWith({
      referenceUrl: "https://example.com",
      notes: "Match the homepage hero"
    });
  });
});

