import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import { createDefaultReplicatorMcpAdapter } from "./default-adapter.js";
import { logger } from "./logger.js";
import { createReplicatorMcpServer } from "./server.js";

type SessionContext = {
  transport: StreamableHTTPServerTransport;
  server: Awaited<ReturnType<typeof createReplicatorMcpServer>>;
};

export const MCP_HTTP_DEFAULT_PATH = "/mcp";

export type HttpMcpConfig = {
  host: string;
  port: number;
  path: string;
  allowedHosts: string[];
  allowedOrigins: string[];
};

function parseCsvEnv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function getRequestBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve(undefined);
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown);
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function writeJson(res: ServerResponse, statusCode: number, payload: Record<string, unknown>) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
}

async function createSessionContext(
  sessions: Map<string, SessionContext>,
  allowedHosts: string[],
  allowedOrigins: string[]
): Promise<SessionContext> {
  const server = createReplicatorMcpServer(createDefaultReplicatorMcpAdapter());
  let transport!: StreamableHTTPServerTransport;

  transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: randomUUID,
    onsessioninitialized: (sessionId) => {
      sessions.set(sessionId, { transport, server });
    },
    onsessionclosed: (sessionId) => {
      sessions.delete(sessionId);
    },
    allowedHosts,
    allowedOrigins
  });

  transport.onclose = async () => {
    const sessionId = transport.sessionId;
    if (sessionId) {
      sessions.delete(sessionId);
    }

    if (typeof server.close === "function") {
      await server.close();
    }
  };

  await server.connect(transport as unknown as Parameters<typeof server.connect>[0]);
  return { transport, server };
}

export function createHttpMcpConfig(overrides: Partial<Pick<HttpMcpConfig, "host" | "port" | "path" | "allowedHosts" | "allowedOrigins">> = {}): HttpMcpConfig {
  const host = overrides.host ?? process.env.MCP_HTTP_HOST ?? "127.0.0.1";
  const port = overrides.port ?? Number(process.env.MCP_HTTP_PORT ?? "8788");
  const path = overrides.path ?? process.env.MCP_HTTP_PATH ?? MCP_HTTP_DEFAULT_PATH;
  const allowedHosts = unique([
    ...parseCsvEnv(process.env.MCP_HTTP_ALLOWED_HOSTS),
    ...(overrides.allowedHosts ?? []),
    host,
    `${host}:${port}`,
    "localhost",
    `localhost:${port}`,
    "127.0.0.1",
    `127.0.0.1:${port}`
  ]);
  const allowedOrigins = unique([
    ...parseCsvEnv(process.env.MCP_HTTP_ALLOWED_ORIGINS),
    ...(overrides.allowedOrigins ?? []),
    `http://${host}:${port}`,
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`
  ]);

  return { host, port, path, allowedHosts, allowedOrigins };
}

export async function createHttpMcpServer(config = createHttpMcpConfig()) {
  const sessions = new Map<string, SessionContext>();

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? `${config.host}:${config.port}`}`);

      if (url.pathname !== config.path) {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }

      if (req.method === "POST") {
        await handlePost(req, res, sessions, config.allowedHosts, config.allowedOrigins);
        return;
      }

      if (req.method === "GET" || req.method === "DELETE") {
        await handleSessionRequest(req, res, sessions);
        return;
      }

      res.statusCode = 405;
      res.setHeader("allow", "GET, POST, DELETE");
      res.end("Method not allowed");
    } catch (error) {
      if (!res.headersSent) {
        writeJson(res, 500, {
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : "Internal server error."
          },
          id: null
        });
      } else {
        res.end();
      }
    }
  });
}

export async function startHttpMcpServer(config = createHttpMcpConfig()) {
  const server = await createHttpMcpServer(config);

  server.listen(config.port, config.host, () => {
    logger.info("MCP streamable HTTP listening", {
      host: config.host,
      port: config.port,
      path: config.path,
      url: `http://${config.host}:${config.port}${config.path}`
    });
  });

  return server;
}

async function handlePost(
  req: IncomingMessage,
  res: ServerResponse,
  sessions: Map<string, SessionContext>,
  allowedHosts: string[],
  allowedOrigins: string[]
) {
  let body: unknown;

  try {
    body = await getRequestBody(req);
  } catch {
    writeJson(res, 400, {
      jsonrpc: "2.0",
      error: {
        code: -32700,
        message: "Invalid JSON request body."
      },
      id: null
    });
    return;
  }

  const sessionIdHeader = req.headers["mcp-session-id"];
  const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;
  let context = sessionId ? sessions.get(sessionId) : undefined;

  if (!context) {
    if (!isInitializeRequest(body)) {
      writeJson(res, 400, {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: session required for non-initialize requests."
        },
        id: null
      });
      return;
    }

    context = await createSessionContext(sessions, allowedHosts, allowedOrigins);
  }

  await context.transport.handleRequest(req, res, body);
}

async function handleSessionRequest(
  req: IncomingMessage,
  res: ServerResponse,
  sessions: Map<string, SessionContext>
) {
  const sessionIdHeader = req.headers["mcp-session-id"];
  const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;
  const context = sessionId ? sessions.get(sessionId) : undefined;

  if (!context) {
    writeJson(res, 400, {
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Bad Request: invalid or missing MCP session id."
      },
      id: null
    });
    return;
  }

  await context.transport.handleRequest(req, res);
}

const isDirectExecution = (() => {
  const entrypoint = process.argv[1];
  if (!entrypoint) {
    return false;
  }

  return import.meta.url === pathToFileURL(resolve(entrypoint)).href;
})();

if (isDirectExecution) {
  void startHttpMcpServer();
}
