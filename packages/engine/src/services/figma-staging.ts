import type { FigmaImportStage, PlaywrightDiscovery } from "@shopify-web-replicator/shared";

import { FigmaMcpClient, FigmaMcpClientError } from "./figma-mcp-client.js";

type FigmaStagingServiceOptions = {
  client?: FigmaMcpClient;
  planKey?: string;
  outputMode?: "newFile" | "clipboard";
  clientFrameworks?: string;
  clientLanguages?: string;
};

function inferFileName(referenceUrl: string): string {
  const host = new URL(referenceUrl).hostname.replace(/^www\./, "");
  return `Replicated ${host}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function extractCaptureId(result: Record<string, unknown>): string | undefined {
  const direct = result.captureId ?? result.capture_id;
  if (typeof direct === "string" && direct.length > 0) {
    return direct;
  }

  const data = asRecord(result.data);
  const nested = data.captureId ?? data.capture_id;
  return typeof nested === "string" && nested.length > 0 ? nested : undefined;
}

function extractCompletedPayload(result: Record<string, unknown>): Record<string, unknown> {
  if (result.structuredContent && typeof result.structuredContent === "object") {
    return result.structuredContent as Record<string, unknown>;
  }

  const data = asRecord(result.data);
  if (Object.keys(data).length > 0) {
    return data;
  }

  return result;
}

export class FigmaStagingService {
  readonly #client: FigmaMcpClient | undefined;
  readonly #planKey: string | undefined;
  readonly #outputMode: "newFile" | "clipboard";
  readonly #clientFrameworks: string;
  readonly #clientLanguages: string;

  constructor(options: FigmaStagingServiceOptions = {}) {
    this.#client = options.client;
    this.#planKey = options.planKey;
    this.#outputMode = options.outputMode ?? "newFile";
    this.#clientFrameworks = options.clientFrameworks ?? "React";
    this.#clientLanguages = options.clientLanguages ?? "typescript";
  }

  async stage(input: {
    referenceUrl: string;
    discovery: PlaywrightDiscovery;
  }): Promise<FigmaImportStage> {
    const stagedAt = new Date().toISOString();

    if (!this.#client) {
      throw new FigmaMcpClientError(
        "Figma MCP bridge is not configured. Set FIGMA_MCP_URL and optional FIGMA_MCP_AUTH_HEADER_NAME / FIGMA_MCP_AUTH_HEADER_VALUE."
      );
    }

    try {
      const availableTools = (await this.#client.listTools()).map((tool) => tool.name);

      if (!availableTools.includes("generate_figma_design") || !availableTools.includes("get_design_context")) {
        throw new FigmaMcpClientError(
          "Connected Figma MCP server does not expose generate_figma_design and get_design_context."
        );
      }

      const generationArgs: Record<string, unknown> = {
        outputMode: this.#outputMode,
        fileName: inferFileName(input.referenceUrl)
      };

      if (this.#outputMode === "newFile" && this.#planKey) {
        generationArgs.planKey = this.#planKey;
      }

      const initialResult = await this.#client.callTool("generate_figma_design", generationArgs);
      const initialPayload = extractCompletedPayload(initialResult.structuredContent ?? initialResult);
      const captureId = extractCaptureId(initialPayload);

      if (!captureId) {
        throw new FigmaMcpClientError(
          "Figma design generation did not return a captureId. Configure FIGMA_MCP_PLAN_KEY for new-file output or verify the remote MCP server authentication."
        );
      }

      const completedResult = await this.#client.pollGenerateFigmaDesign(captureId);
      const completedPayload = extractCompletedPayload(completedResult.structuredContent ?? completedResult);
      const fileKey = completedPayload.file_key ?? completedPayload.fileKey;
      const figmaUrl = completedPayload.url ?? completedPayload.file_url;
      const nodeId =
        (typeof completedPayload.nodeId === "string" && completedPayload.nodeId) ||
        (typeof completedPayload.node_id === "string" && completedPayload.node_id) ||
        "0:1";

      if (typeof fileKey !== "string" || fileKey.length === 0) {
        throw new FigmaMcpClientError("Figma design generation completed without returning a file key.");
      }

      const designContextResult = await this.#client.callTool("get_design_context", {
        fileKey,
        nodeId,
        clientFrameworks: this.#clientFrameworks,
        clientLanguages: this.#clientLanguages
      });
      const designPayload = extractCompletedPayload(designContextResult.structuredContent ?? designContextResult);
      const designContextCode =
        (typeof designPayload.code === "string" && designPayload.code) ||
        designContextResult.content?.map((entry) => entry.text ?? "").filter(Boolean).join("\n");

      return {
        stagedAt,
        status: "imported",
        sourceUrl: input.referenceUrl,
        summary:
          "Imported the reference URL into Figma through the MCP bridge and fetched design context for Hydrogen reconstruction.",
        handoffPrompt:
          "Use the imported Figma file and design context as the primary design source for Hydrogen route/component generation.",
        recommendedTools: ["generate_figma_design", "get_design_context"],
        availableTools,
        fileKey,
        nodeId,
        ...(typeof figmaUrl === "string" ? { figmaUrl } : {}),
        ...(typeof designContextCode === "string" && designContextCode.length > 0
          ? {
              designContextCode,
              designContextFramework: this.#clientFrameworks
            }
          : {})
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      throw new FigmaMcpClientError("Figma MCP bridge failed.");
    }
  }
}
