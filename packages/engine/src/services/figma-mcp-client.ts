type JsonRpcId = number;

type ToolDefinition = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

type ToolCallResult = {
  content?: Array<{ type?: string; text?: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  [key: string]: unknown;
};

type FigmaMcpClientOptions = {
  endpoint: string;
  authHeaderName?: string;
  authHeaderValue?: string;
  protocolVersion?: string;
};

type JsonRpcSuccess<T> = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: T;
};

type JsonRpcFailure = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
};

function isJsonRpcFailure(payload: unknown): payload is JsonRpcFailure {
  return Boolean(payload && typeof payload === "object" && "error" in payload);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseSseJsonRpcPayload(text: string): unknown {
  const events = text
    .split(/\n\n+/)
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice("data:".length).trim())
        .join("")
    )
    .filter(Boolean);
  const finalEvent = events.at(-1);

  if (!finalEvent) {
    throw new FigmaMcpClientError("Figma MCP returned an empty SSE response.");
  }

  return JSON.parse(finalEvent);
}

function extractTextContent(result: ToolCallResult): string {
  return (result.content ?? [])
    .map((item) => item.text ?? "")
    .filter(Boolean)
    .join("\n");
}

export class FigmaMcpClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FigmaMcpClientError";
  }
}

export class FigmaMcpClient {
  readonly #endpoint: string;
  readonly #authHeaderName: string | undefined;
  readonly #authHeaderValue: string | undefined;
  readonly #protocolVersion: string;
  #requestId = 0;
  #sessionId: string | undefined;
  #initialized = false;

  constructor(options: FigmaMcpClientOptions) {
    this.#endpoint = options.endpoint;
    this.#authHeaderName = options.authHeaderName;
    this.#authHeaderValue = options.authHeaderValue;
    this.#protocolVersion = options.protocolVersion ?? "2025-11-25";
  }

  async listTools(): Promise<ToolDefinition[]> {
    await this.#initializeIfNeeded();
    const result = await this.#request<{ tools: ToolDefinition[] }>("tools/list", {});
    return result.tools ?? [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    await this.#initializeIfNeeded();
    return this.#request<ToolCallResult>("tools/call", {
      name,
      arguments: args
    });
  }

  async pollGenerateFigmaDesign(captureId: string, attempts = 10): Promise<ToolCallResult> {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const result = await this.callTool("generate_figma_design", { captureId });
      const payload = result.structuredContent ?? {};
      const status = String(payload.status ?? "").toLowerCase();

      if (status === "completed") {
        return result;
      }

      if (status === "failed") {
        throw new FigmaMcpClientError(
          String((payload.error ?? extractTextContent(result)) || "Figma design capture failed.")
        );
      }

      await sleep(5_000);
    }

    throw new FigmaMcpClientError("Timed out waiting for Figma design generation to complete.");
  }

  async #initializeIfNeeded(): Promise<void> {
    if (this.#initialized) {
      return;
    }

    await this.#request<{
      protocolVersion: string;
    }>("initialize", {
      protocolVersion: this.#protocolVersion,
      capabilities: {
        tools: {}
      },
      clientInfo: {
        name: "shopify-web-replicator",
        version: "0.0.0"
      }
    });

    await this.#notify("notifications/initialized", {});
    this.#initialized = true;
  }

  async #notify(method: string, params: Record<string, unknown>): Promise<void> {
    const response = await fetch(this.#endpoint, {
      method: "POST",
      headers: this.#headers(),
      body: JSON.stringify({
        jsonrpc: "2.0",
        method,
        params
      })
    });

    if (!response.ok && response.status !== 202) {
      throw new FigmaMcpClientError(`Figma MCP notification ${method} failed with ${response.status}.`);
    }
  }

  async #request<T>(method: string, params: Record<string, unknown>): Promise<T> {
    const id = ++this.#requestId;
    const response = await fetch(this.#endpoint, {
      method: "POST",
      headers: this.#headers(),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        method,
        params
      })
    });

    if (!response.ok) {
      throw new FigmaMcpClientError(`Figma MCP request ${method} failed with ${response.status}.`);
    }

    const sessionId = response.headers.get("MCP-Session-Id");
    if (sessionId) {
      this.#sessionId = sessionId;
    }

    const contentType = response.headers.get("content-type") ?? "";
    const payload = (contentType.includes("text/event-stream")
      ? parseSseJsonRpcPayload(await response.text())
      : await response.json()) as JsonRpcSuccess<T> | JsonRpcFailure;

    if (isJsonRpcFailure(payload)) {
      throw new FigmaMcpClientError(payload.error.message);
    }

    return payload.result;
  }

  #headers(): HeadersInit {
    const headers: Record<string, string> = {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": this.#protocolVersion
    };

    if (this.#sessionId) {
      headers["MCP-Session-Id"] = this.#sessionId;
    }

    if (this.#authHeaderName && this.#authHeaderValue) {
      headers[this.#authHeaderName] = this.#authHeaderValue;
    }

    return headers;
  }
}
