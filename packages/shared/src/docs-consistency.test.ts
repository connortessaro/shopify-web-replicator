import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readDoc(relativePath: string): string {
  return readFileSync(new URL(`../../../${relativePath}`, import.meta.url), "utf8");
}

describe("documentation consistency", () => {
  it("documents the current MCP surfaces and transport options", () => {
    const readme = readDoc("README.md");
    const architecture = readDoc("docs/architecture.md");
    const mcpSetup = readDoc("docs/mcp-setup.md");
    const setupGuide = readDoc("docs/setup-guide.md");
    const operatorRunbook = readDoc("docs/operator-runbook.md");
    const agents = readDoc("AGENTS.md");

    expect(readme).toContain("replicate_site_to_theme");
    expect(readme).toContain("replicate_site_to_hydrogen");
    expect(readme).toContain("streamable HTTP");

    expect(architecture).toContain("replicate_site_to_hydrogen");
    expect(architecture).toContain("POST /api/hydrogen/jobs");
    expect(architecture).toContain("generated-sites/<targetId>");

    expect(mcpSetup).toContain("/mcp");
    expect(mcpSetup).toContain("streamable HTTP");
    expect(mcpSetup).toContain("FIGMA_MCP_URL");

    expect(setupGuide).toContain("advanced / beta");

    expect(operatorRunbook).toContain("Hydrogen");
    expect(operatorRunbook).toContain("screenshots");

    expect(agents).toContain("docs/agent-runbook.md");
    expect(agents).toContain("replicate_site_to_hydrogen");
    expect(agents).toContain("FIGMA_MCP_URL");
  });

  it("does not reference removed or stale workflow names", () => {
    const docs = [
      readDoc("README.md"),
      readDoc("docs/architecture.md"),
      readDoc("docs/mcp-setup.md"),
      readDoc("docs/operator-runbook.md"),
      readDoc("docs/setup-guide.md"),
      readDoc("AGENTS.md")
    ].join("\n");

    expect(docs).not.toContain("replicate_storefront");
    expect(docs).not.toContain("stdio-only");
  });

  it("includes a dedicated agent runbook", () => {
    const agentRunbookUrl = new URL("../../../docs/agent-runbook.md", import.meta.url);

    expect(existsSync(agentRunbookUrl)).toBe(true);

    const agentRunbook = readFileSync(agentRunbookUrl, "utf8");

    expect(agentRunbook).toContain("replicate_site_to_theme");
    expect(agentRunbook).toContain("replicate_site_to_hydrogen");
    expect(agentRunbook).toContain("get_replication_job");
    expect(agentRunbook).toContain("/mcp");
    expect(agentRunbook).toContain("Figma");
  });
});
