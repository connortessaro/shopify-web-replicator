import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createDefaultReplicatorMcpAdapter } from "./default-adapter.js";
import { createReplicatorMcpServer } from "./server.js";

const server = createReplicatorMcpServer(createDefaultReplicatorMcpAdapter());
const transport = new StdioServerTransport();

await server.connect(transport);
