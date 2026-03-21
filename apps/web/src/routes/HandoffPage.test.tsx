import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HandoffPage } from "./HandoffPage";

describe("HandoffPage", () => {
  it("shows the local Shopify theme workspace handoff", () => {
    render(<HandoffPage />);

    expect(screen.getByText(/packages\/theme-workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/shopify theme dev/i)).toBeInTheDocument();
    expect(screen.getByText(/deterministic pipeline overwrites the stable generated reference section/i)).toBeInTheDocument();
  });
});
