import { createDefaultReplicationOrchestrator } from "@shopify-web-replicator/engine";

async function runReplication() {
  const orchestrator = createDefaultReplicationOrchestrator();

  const urls = [
    "https://kip.life/?ref=ecommdesign",
    "https://kip.life/products/the-disconnect-tag",
    "https://kip.life/pages/faq"
  ];

  for (const url of urls) {
    console.log(`Starting replication for: ${url}...`);
    try {
      const result = await orchestrator.replicateStorefront({
        referenceUrl: url,
        destinationStore: "dev-store-749237498237499292"
      });
      console.log(`Job ${result.job.id} finished with status: ${result.job.status}`);
    } catch (error) {
      console.error(`Failed to replicate ${url}:`, error);
    }
  }
}

runReplication();
