import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { extname, join } from "node:path";

import type {
  AssetSyncResult,
  ReferenceCapture,
  SyncedAsset
} from "@shopify-web-replicator/shared";

function deriveAssetFilename(sourceUrl: string): string {
  const hash = createHash("sha1").update(sourceUrl).digest("hex").slice(0, 12);
  const ext = extname(new URL(sourceUrl).pathname) || ".jpg";
  return `replicator-${hash}${ext}`;
}

export class ThemeAssetSyncService {
  async sync(input: {
    capture: ReferenceCapture;
    themeWorkspacePath: string;
  }): Promise<AssetSyncResult> {
    const assetsDir = join(input.themeWorkspacePath, "assets");
    await mkdir(assetsDir, { recursive: true });

    const assets: SyncedAsset[] = [];

    for (const image of input.capture.imageAssets) {
      const filename = deriveAssetFilename(image.src);
      const themePath = `assets/${filename}`;

      try {
        const response = await fetch(image.src);

        if (!response.ok) {
          assets.push({ sourceUrl: image.src, themePath, status: "failed", message: `HTTP ${response.status}` });
          continue;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        await writeFile(join(input.themeWorkspacePath, themePath), buffer);
        assets.push({ sourceUrl: image.src, themePath, status: "synced" });
      } catch (error) {
        assets.push({
          sourceUrl: image.src,
          themePath,
          status: "failed",
          message: error instanceof Error ? error.message : "Download failed"
        });
      }
    }

    const syncedCount = assets.filter((asset) => asset.status === "synced").length;

    return {
      syncedAt: new Date().toISOString(),
      summary: `Synced ${syncedCount} of ${assets.length} assets.`,
      assets
    };
  }
}
