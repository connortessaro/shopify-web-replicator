import { createLogger } from "@shopify-web-replicator/shared/logger";

export const logger = createLogger({ defaultContext: { service: "api" } });
