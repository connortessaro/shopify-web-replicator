import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("streamable HTTP MCP entrypoint", () => {
  it("exports a streamable MCP endpoint path constant", async () => {
    const mod = await import("./http.js");

    expect(mod.MCP_HTTP_DEFAULT_PATH).toBe("/mcp");
  });

  it("does not start the server when imported", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await import("./http.js");

    expect(logSpy).not.toHaveBeenCalled();
  });

  it("builds localhost-safe defaults for hosts and origins", async () => {
    const mod = await import("./http.js");
    const config = mod.createHttpMcpConfig({
      host: "127.0.0.1",
      port: 8788,
      path: "/mcp"
    });

    expect(config.allowedHosts).toEqual(
      expect.arrayContaining(["127.0.0.1", "127.0.0.1:8788", "localhost", "localhost:8788"])
    );
    expect(config.allowedOrigins).toEqual(
      expect.arrayContaining(["http://127.0.0.1:8788", "http://localhost:8788"])
    );
  });

  it("deduplicates configured host and origin values", async () => {
    const mod = await import("./http.js");
    const config = mod.createHttpMcpConfig({
      host: "127.0.0.1",
      port: 8788,
      path: "/mcp",
      allowedHosts: ["127.0.0.1", "127.0.0.1", "localhost"],
      allowedOrigins: ["http://localhost:8788", "http://localhost:8788"]
    });

    expect(new Set(config.allowedHosts).size).toBe(config.allowedHosts.length);
    expect(new Set(config.allowedOrigins).size).toBe(config.allowedOrigins.length);
  });
});
