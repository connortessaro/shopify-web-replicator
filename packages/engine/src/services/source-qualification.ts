import type { SourceQualification } from "@shopify-web-replicator/shared";

import type { StorefrontInspection } from "./storefront-inspector.js";
import { StorefrontInspectionError } from "./storefront-inspector.js";

type QualifyInput = {
  jobId: string;
  referenceUrl: string;
};

export class ShopifySourceQualificationService {
  readonly #inspector: {
    inspect(input: QualifyInput): Promise<
      StorefrontInspection & {
        evidence?: string[];
        httpStatus?: number;
        isPasswordProtected?: boolean;
        shopDomain?: string;
      }
    >;
  };

  constructor(
    inspector: {
      inspect(input: QualifyInput): Promise<
        StorefrontInspection & {
          evidence?: string[];
          httpStatus?: number;
          isPasswordProtected?: boolean;
          shopDomain?: string;
        }
      >;
    }
  ) {
    this.#inspector = inspector;
  }

  async qualify({ jobId, referenceUrl }: QualifyInput): Promise<SourceQualification> {
    try {
      const inspection = await this.#inspector.inspect({ jobId, referenceUrl });
      const qualifiedAt = inspection.capturedAt;
      const evidence = inspection.evidence ?? [];
      const baseQualification = {
        referenceHost: inspection.referenceHost,
        resolvedUrl: inspection.resolvedUrl,
        qualifiedAt,
        evidence,
        ...(inspection.httpStatus ? { httpStatus: inspection.httpStatus } : {}),
        ...(inspection.shopDomain ? { shopDomain: inspection.shopDomain } : {})
      };

      if (inspection.isPasswordProtected) {
        return {
          status: "unsupported",
          platform: evidence.length > 0 ? "shopify" : "unknown",
          ...baseQualification,
          summary: "Reference source is password protected and cannot be replicated automatically.",
          failureCode: "password_protected",
          failureReason: "Shopify password protection was detected during source qualification.",
          isPasswordProtected: true
        };
      }

      if (evidence.length === 0) {
        return {
          status: "unsupported",
          platform: "unknown",
          ...baseQualification,
          summary: "Reference source is not a supported public Shopify storefront.",
          failureCode: "non_shopify_source",
          failureReason: "No Shopify storefront markers were detected after browser-backed qualification.",
          isPasswordProtected: false
        };
      }

      return {
        status: "supported",
        platform: "shopify",
        ...baseQualification,
        summary: `Verified a supported public Shopify storefront source using ${evidence.join(", ")}.`,
        isPasswordProtected: false
      };
    } catch (error) {
      if (error instanceof StorefrontInspectionError && error.code === "browser_unavailable") {
        const resolvedUrl = referenceUrl;
        const referenceHost = new URL(referenceUrl).hostname.replace(/^www\./, "");

        return {
          status: "unsupported",
          platform: "unknown",
          referenceHost,
          resolvedUrl,
          qualifiedAt: new Date().toISOString(),
          summary: error.message,
          evidence: [],
          failureCode: "browser_unavailable",
          failureReason: error.message,
          ...(error.httpStatus ? { httpStatus: error.httpStatus } : {}),
          isPasswordProtected: false
        };
      }

      throw error;
    }
  }
}
