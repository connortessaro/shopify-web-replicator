import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createDefaultReplicationOrchestrator } from "@shopify-web-replicator/engine";

import { createReplicatorMcpServer } from "./server.js";

const orchestrator = createDefaultReplicationOrchestrator();
const server = createReplicatorMcpServer(orchestrator);
const transport = new StdioServerTransport();

await server.connect(transport);
