import { beforeEach, describe, expect, it, vi } from "vitest";

import { createLogger, type LogSink } from "./logger";

describe("createLogger", () => {
  const stdout = vi.fn<LogSink>();
  const stderr = vi.fn<LogSink>();

  beforeEach(() => {
    stdout.mockReset();
    stderr.mockReset();
  });

  it("writes structured info logs to stdout with merged context", () => {
    const logger = createLogger({
      level: "info",
      defaultContext: { service: "api" },
      stdout,
      stderr
    }).child({ requestId: "req_123" });

    logger.info("job created", { jobId: "job_123" });

    expect(stdout).toHaveBeenCalledTimes(1);
    expect(stderr).not.toHaveBeenCalled();
    expect(JSON.parse(stdout.mock.calls[0][0])).toMatchObject({
      level: "info",
      message: "job created",
      service: "api",
      requestId: "req_123",
      jobId: "job_123"
    });
  });

  it("filters logs below the configured level", () => {
    const logger = createLogger({
      level: "warn",
      stdout,
      stderr
    });

    logger.debug("hidden debug");
    logger.info("hidden info");
    logger.warn("visible warn");

    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledTimes(1);
    expect(JSON.parse(stderr.mock.calls[0][0])).toMatchObject({
      level: "warn",
      message: "visible warn"
    });
  });

  it("serializes errors without dropping metadata", () => {
    const logger = createLogger({
      level: "error",
      stdout,
      stderr
    });

    logger.error("hydrogen replication failed", {
      error: new Error("boom"),
      jobId: "hydrogen_123"
    });

    expect(stderr).toHaveBeenCalledTimes(1);
    expect(JSON.parse(stderr.mock.calls[0][0])).toMatchObject({
      level: "error",
      message: "hydrogen replication failed",
      jobId: "hydrogen_123",
      error: {
        name: "Error",
        message: "boom"
      }
    });
  });
});
