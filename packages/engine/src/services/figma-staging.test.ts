import { describe, expect, it, vi } from "vitest";

import { FigmaStagingService } from "./figma-staging.js";

describe("FigmaStagingService", () => {
  it("imports a URL through the Figma MCP bridge and returns design context metadata", async () => {
    const client = {
      listTools: vi.fn(async () => [
        { name: "generate_figma_design" },
        { name: "get_design_context" }
      ]),
      callTool: vi
        .fn()
        .mockResolvedValueOnce({
          structuredContent: {
            captureId: "cap_123"
          }
        })
        .mockResolvedValueOnce({
          structuredContent: {
            code: "export function Hero() { return <div />; }",
            fileKey: "FILE123",
            nodeId: "0:1",
            url: "https://www.figma.com/design/FILE123/Replicated-Example"
          },
          content: [{ type: "text", text: "hero code" }]
        }),
      pollGenerateFigmaDesign: vi.fn(async () => ({
        structuredContent: {
          fileKey: "FILE123",
          nodeId: "0:1",
          url: "https://www.figma.com/design/FILE123/Replicated-Example"
        }
      }))
    } as never;
    const service = new FigmaStagingService({
      client,
      planKey: "plan_123"
    });

    const result = await service.stage({
      referenceUrl: "https://example.com",
      discovery: {
        discoveredAt: "2026-03-26T00:00:00.000Z",
        summary: "Observed routes.",
        screenshots: {
          desktopPath: "/tmp/desktop.jpg",
          mobilePath: "/tmp/mobile.jpg"
        },
        routes: [],
        interactions: [],
        observedFeatures: [],
        networkEndpoints: []
      }
    });

    expect(result.status).toBe("imported");
    expect(result.fileKey).toBe("FILE123");
    expect(result.nodeId).toBe("0:1");
    expect(result.figmaUrl).toContain("FILE123");
    expect(result.designContextCode).toContain("Hero");
    expect(client.callTool).toHaveBeenCalledWith(
      "generate_figma_design",
      expect.objectContaining({
        outputMode: "newFile",
        planKey: "plan_123"
      })
    );
    expect(client.callTool).toHaveBeenCalledWith(
      "get_design_context",
      expect.objectContaining({
        fileKey: "FILE123",
        nodeId: "0:1"
      })
    );
  });

  it("fails when the required Figma tools are not exposed", async () => {
    const service = new FigmaStagingService({
      client: {
        listTools: vi.fn(async () => [{ name: "get_metadata" }])
      } as never
    });

    await expect(
      service.stage({
        referenceUrl: "https://example.com",
        discovery: {
          discoveredAt: "2026-03-26T00:00:00.000Z",
          summary: "Observed routes.",
          screenshots: {
            desktopPath: "/tmp/desktop.jpg",
            mobilePath: "/tmp/mobile.jpg"
          },
          routes: [],
          interactions: [],
          observedFeatures: [],
          networkEndpoints: []
        }
      })
    ).rejects.toThrow(/generate_figma_design/i);
  });

  it("fails when design generation does not return a capture id", async () => {
    const service = new FigmaStagingService({
      client: {
        listTools: vi.fn(async () => [
          { name: "generate_figma_design" },
          { name: "get_design_context" }
        ]),
        callTool: vi.fn(async () => ({
          structuredContent: {}
        }))
      } as never
    });

    await expect(
      service.stage({
        referenceUrl: "https://example.com",
        discovery: {
          discoveredAt: "2026-03-26T00:00:00.000Z",
          summary: "Observed routes.",
          screenshots: {
            desktopPath: "/tmp/desktop.jpg",
            mobilePath: "/tmp/mobile.jpg"
          },
          routes: [],
          interactions: [],
          observedFeatures: [],
          networkEndpoints: []
        }
      })
    ).rejects.toThrow(/captureId/i);
  });
});
