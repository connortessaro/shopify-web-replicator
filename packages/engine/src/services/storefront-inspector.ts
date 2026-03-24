import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type {
  CapturedImageAsset,
  CapturedLink,
  ReferenceRouteHints,
  ReferenceStyleTokens
} from "@shopify-web-replicator/shared";

type InspectInput = {
  jobId: string;
  referenceUrl: string;
};

type RawStorefrontInspection = {
  sourceUrl: string;
  resolvedUrl: string;
  referenceHost: string;
  title: string;
  description?: string;
  capturedAt: string;
  html: string;
  textContent: string;
  headingOutline: string[];
  navigationLinks: CapturedLink[];
  primaryCtas: CapturedLink[];
  imageAssets: CapturedImageAsset[];
  styleTokens: ReferenceStyleTokens;
  routeHints: ReferenceRouteHints;
  evidence: string[];
  httpStatus?: number;
  isPasswordProtected: boolean;
  shopDomain?: string;
  desktopScreenshot: Uint8Array;
  mobileScreenshot: Uint8Array;
};

export type StorefrontInspection = Omit<RawStorefrontInspection, "html" | "desktopScreenshot" | "mobileScreenshot"> & {
  captureBundlePath: string;
  desktopScreenshotPath: string;
  mobileScreenshotPath: string;
};

export class StorefrontInspectionError extends Error {
  readonly code: "browser_unavailable" | "capture_failed";
  readonly httpStatus?: number;

  constructor(
    code: "browser_unavailable" | "capture_failed",
    message: string,
    options: { httpStatus?: number } = {}
  ) {
    super(message);
    this.name = "StorefrontInspectionError";
    this.code = code;
    if (options.httpStatus !== undefined) {
      this.httpStatus = options.httpStatus;
    }
  }
}

type StorefrontBrowserAdapter = {
  inspect(input: { referenceUrl: string }): Promise<RawStorefrontInspection>;
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeColor(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = normalizeWhitespace(value);

  if (!trimmed || trimmed === "rgba(0, 0, 0, 0)" || trimmed === "transparent") {
    return undefined;
  }

  return trimmed;
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim().length > 0)))];
}

function extractHandle(href: string, prefix: "/products/" | "/collections/"): string | undefined {
  try {
    const url = new URL(href);

    if (!url.pathname.startsWith(prefix)) {
      return undefined;
    }

    return url.pathname.slice(prefix.length).split("/").filter(Boolean)[0];
  } catch {
    return undefined;
  }
}

function buildRouteHints(links: string[]): ReferenceRouteHints {
  const productHandles = uniqueStrings(links.map((href) => extractHandle(href, "/products/")));
  const collectionHandles = uniqueStrings(links.map((href) => extractHandle(href, "/collections/")));
  const cartPath = links.find((href) => {
    try {
      return new URL(href).pathname === "/cart";
    } catch {
      return false;
    }
  });
  const checkoutPath = links.find((href) => {
    try {
      return new URL(href).pathname === "/checkout";
    } catch {
      return false;
    }
  });

  return {
    productHandles,
    collectionHandles,
    ...(cartPath ? { cartPath: "/cart" } : {}),
    ...(checkoutPath ? { checkoutPath: "/checkout" } : {})
  };
}

function detectEvidence(html: string, shopDomain?: string): string[] {
  const evidence: string[] = [];

  if (/window\.Shopify\b/i.test(html)) {
    evidence.push("window.Shopify");
  }

  if (/cdn\.shopify\.com/i.test(html)) {
    evidence.push("cdn.shopify.com");
  }

  if (/\/cdn\/shop\/files\//i.test(html)) {
    evidence.push("/cdn/shop/files/");
  }

  if (/shopify-payment-button/i.test(html)) {
    evidence.push("shopify-payment-button");
  }

  if (shopDomain) {
    evidence.push(`shopDomain:${shopDomain}`);
  }

  return evidence;
}

async function buildPageSnapshot(
  referenceUrl: string,
  viewport: { width: number; height: number },
  userAgent?: string
): Promise<{
  httpStatus?: number;
  resolvedUrl: string;
  html: string;
  title: string;
  description?: string;
  textContent: string;
  headingOutline: string[];
  navigationLinks: CapturedLink[];
  primaryCtas: CapturedLink[];
  imageAssets: CapturedImageAsset[];
  styleTokens: ReferenceStyleTokens;
  routeHints: ReferenceRouteHints;
  isPasswordProtected: boolean;
  shopDomain?: string;
  screenshot: Uint8Array;
}> {
  const { chromium } = await import("playwright");
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    throw new StorefrontInspectionError(
      "browser_unavailable",
      `Browser capture runtime unavailable. ${error instanceof Error ? error.message : "Unable to launch Playwright Chromium."}`
    );
  }

  try {
    const context = await browser.newContext({
      viewport,
      ...(userAgent ? { userAgent } : {})
    });
    const page = await context.newPage();
    const response = await page.goto(referenceUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });

    try {
      await page.waitForLoadState("networkidle", { timeout: 5_000 });
    } catch {
      // Some storefronts never reach network idle; best-effort capture is acceptable.
    }

    const html = await page.content();
    const pageData = await page.evaluate(() => {
      const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
      const toAbsoluteHref = (href: string | null) => {
        if (!href || href.startsWith("#")) {
          return undefined;
        }

        try {
          const url = new URL(href, window.location.href);

          if (url.protocol !== "http:" && url.protocol !== "https:") {
            return undefined;
          }

          url.hash = "";
          return url.toString();
        } catch {
          return undefined;
        }
      };
      const uniqueLinks = (links: Array<{ label: string; href: string }>) => {
        const seen = new Set<string>();
        return links.filter((link) => {
          const key = `${link.label}|${link.href}`;

          if (seen.has(key)) {
            return false;
          }

          seen.add(key);
          return true;
        });
      };
      const bodyStyle = window.getComputedStyle(document.body);
      const firstHeading = document.querySelector<HTMLElement>("h1, h2");
      const headingStyle = firstHeading ? window.getComputedStyle(firstHeading) : undefined;
      const firstLink = document.querySelector<HTMLAnchorElement>("a[href]");
      const linkStyle = firstLink ? window.getComputedStyle(firstLink) : undefined;
      const buttonCandidate = document.querySelector<HTMLElement>(
        "button, [role='button'], a.button, a.btn, a[class*='button'], a[class*='btn']"
      );
      const buttonStyle = buttonCandidate ? window.getComputedStyle(buttonCandidate) : undefined;
      const collectLinks = (selector: string, limit: number, keywordPattern?: RegExp) => {
        const links: Array<{ label: string; href: string }> = [];

        for (const element of Array.from(document.querySelectorAll<HTMLAnchorElement>(selector))) {
          if (links.length >= limit) {
            break;
          }

          const label = normalize(element.textContent ?? "");
          const href = toAbsoluteHref(element.getAttribute("href"));
          const className = normalize(element.getAttribute("class") ?? "");

          if (!label || !href) {
            continue;
          }

          if (keywordPattern && !keywordPattern.test(label) && !keywordPattern.test(className)) {
            continue;
          }

          links.push({ label, href });
        }

        return uniqueLinks(links);
      };
      const keywordPattern = /(shop|buy|get|learn|view|discover|explore|start|launch|add to cart|checkout)/i;
      const navigationLinks = collectLinks("nav a, header a", 8);
      const keywordCtas = collectLinks("main a, main section a, section a, form a", 8, keywordPattern);
      const primaryCtas =
        keywordCtas.length > 0 ? keywordCtas : collectLinks("main a, main section a, section a, form a", 4);
      const imageAssets = Array.from(document.querySelectorAll<HTMLImageElement>("img[src]"))
        .map((image) => {
          const src = toAbsoluteHref(image.getAttribute("src"));

          if (!src) {
            return undefined;
          }

          const alt = normalize(image.getAttribute("alt") ?? "");

          return {
            src,
            ...(alt ? { alt } : {})
          };
        })
        .filter((image): image is { src: string; alt?: string } => Boolean(image))
        .slice(0, 12);
      const title = normalize(document.title) || window.location.hostname;
      const description = normalize(
        document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? ""
      );
      const headingOutline = Array.from(document.querySelectorAll<HTMLElement>("h1, h2, h3"))
        .map((element) => normalize(element.textContent ?? ""))
        .filter(Boolean)
        .slice(0, 12);
      const textContent = normalize(document.body.innerText || document.body.textContent || "");
      const shopDomainValue = (window as Window & { Shopify?: { shop?: string } }).Shopify?.shop;
      const bodyTextColor = bodyStyle.color;
      const pageBackgroundColor = bodyStyle.backgroundColor;
      const primaryButtonBackgroundColor = buttonStyle?.backgroundColor;
      const primaryButtonTextColor = buttonStyle?.color;
      const linkColor = linkStyle?.color;
      const fontFamilies = [bodyStyle.fontFamily, headingStyle?.fontFamily, buttonStyle?.fontFamily]
        .map((value) => normalize(value ?? ""))
        .filter(Boolean);
      const dominantColors = [
        bodyTextColor,
        pageBackgroundColor,
        primaryButtonBackgroundColor,
        primaryButtonTextColor,
        linkColor
      ]
        .map((value) => normalize(value ?? ""))
        .filter((value) => value.length > 0 && value !== "rgba(0, 0, 0, 0)" && value !== "transparent");
      const passwordText = textContent.toLowerCase();
      const isPasswordProtected =
        Boolean(document.querySelector("form[action*='/password']")) ||
        Boolean(document.querySelector("input[type='password'], input[name='password']")) ||
        passwordText.includes("enter using password") ||
        passwordText.includes("opening soon");

      return {
        resolvedUrl: window.location.toString(),
        title,
        ...(description ? { description } : {}),
        textContent,
        headingOutline,
        navigationLinks,
        primaryCtas,
        imageAssets,
        styleTokens: {
          dominantColors,
          fontFamilies,
          ...(bodyTextColor ? { bodyTextColor } : {}),
          ...(pageBackgroundColor ? { pageBackgroundColor } : {}),
          ...(primaryButtonBackgroundColor ? { primaryButtonBackgroundColor } : {}),
          ...(primaryButtonTextColor ? { primaryButtonTextColor } : {}),
          ...(linkColor ? { linkColor } : {})
        },
        shopDomain: shopDomainValue,
        isPasswordProtected
      };
    });
    const allLinkTargets = [
      ...pageData.navigationLinks.map((link) => link.href),
      ...pageData.primaryCtas.map((link) => link.href)
    ];
    const screenshot = await page.screenshot({
      type: "jpeg",
      quality: 85,
      fullPage: true
    });

    await context.close();

    const styleTokens: ReferenceStyleTokens = {
      dominantColors: uniqueStrings(pageData.styleTokens.dominantColors.map(normalizeColor)),
      fontFamilies: uniqueStrings(pageData.styleTokens.fontFamilies.map((value) => normalizeWhitespace(value)))
    };

    const bodyTextColor = normalizeColor(pageData.styleTokens.bodyTextColor);
    const pageBackgroundColor = normalizeColor(pageData.styleTokens.pageBackgroundColor);
    const primaryButtonBackgroundColor = normalizeColor(pageData.styleTokens.primaryButtonBackgroundColor);
    const primaryButtonTextColor = normalizeColor(pageData.styleTokens.primaryButtonTextColor);
    const linkColor = normalizeColor(pageData.styleTokens.linkColor);

    if (bodyTextColor) {
      styleTokens.bodyTextColor = bodyTextColor;
    }

    if (pageBackgroundColor) {
      styleTokens.pageBackgroundColor = pageBackgroundColor;
    }

    if (primaryButtonBackgroundColor) {
      styleTokens.primaryButtonBackgroundColor = primaryButtonBackgroundColor;
    }

    if (primaryButtonTextColor) {
      styleTokens.primaryButtonTextColor = primaryButtonTextColor;
    }

    if (linkColor) {
      styleTokens.linkColor = linkColor;
    }

    const httpStatus = response?.status();

    return {
      ...(httpStatus !== undefined ? { httpStatus } : {}),
      resolvedUrl: pageData.resolvedUrl,
      html,
      title: pageData.title,
      ...(pageData.description ? { description: pageData.description } : {}),
      textContent: pageData.textContent,
      headingOutline: pageData.headingOutline,
      navigationLinks: pageData.navigationLinks,
      primaryCtas: pageData.primaryCtas,
      imageAssets: pageData.imageAssets,
      styleTokens,
      routeHints: buildRouteHints(allLinkTargets),
      isPasswordProtected: pageData.isPasswordProtected,
      ...(pageData.shopDomain ? { shopDomain: pageData.shopDomain } : {}),
      screenshot
    };
  } catch (error) {
    if (error instanceof StorefrontInspectionError) {
      throw error;
    }

    throw new StorefrontInspectionError(
      "capture_failed",
      `Browser capture failed. ${error instanceof Error ? error.message : "Unknown browser capture error."}`
    );
  } finally {
    await browser?.close();
  }
}

class PlaywrightStorefrontBrowserAdapter implements StorefrontBrowserAdapter {
  async inspect({ referenceUrl }: { referenceUrl: string }): Promise<RawStorefrontInspection> {
    const desktop = await buildPageSnapshot(referenceUrl, { width: 1440, height: 1200 });
    const mobile = await buildPageSnapshot(referenceUrl, { width: 393, height: 852 }, "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
    const referenceHost = new URL(desktop.resolvedUrl).hostname.replace(/^www\./, "");
    const evidence = detectEvidence(desktop.html, desktop.shopDomain);

    return {
      sourceUrl: referenceUrl,
      resolvedUrl: desktop.resolvedUrl,
      referenceHost,
      title: desktop.title,
      ...(desktop.description ? { description: desktop.description } : {}),
      capturedAt: new Date().toISOString(),
      html: desktop.html,
      textContent: desktop.textContent,
      headingOutline: desktop.headingOutline,
      navigationLinks: desktop.navigationLinks,
      primaryCtas: desktop.primaryCtas,
      imageAssets: desktop.imageAssets,
      styleTokens: desktop.styleTokens,
      routeHints: {
        productHandles: uniqueStrings([
          ...desktop.routeHints.productHandles,
          ...mobile.routeHints.productHandles
        ]),
        collectionHandles: uniqueStrings([
          ...desktop.routeHints.collectionHandles,
          ...mobile.routeHints.collectionHandles
        ]),
        ...(desktop.routeHints.cartPath ?? mobile.routeHints.cartPath
          ? { cartPath: desktop.routeHints.cartPath ?? mobile.routeHints.cartPath }
          : {}),
        ...(desktop.routeHints.checkoutPath ?? mobile.routeHints.checkoutPath
          ? { checkoutPath: desktop.routeHints.checkoutPath ?? mobile.routeHints.checkoutPath }
          : {})
      },
      evidence,
      ...(desktop.httpStatus ? { httpStatus: desktop.httpStatus } : {}),
      isPasswordProtected: desktop.isPasswordProtected,
      ...(desktop.shopDomain ? { shopDomain: desktop.shopDomain } : {}),
      desktopScreenshot: desktop.screenshot,
      mobileScreenshot: mobile.screenshot
    };
  }
}

export class StorefrontInspector {
  readonly #captureRoot: string;
  readonly #adapter: StorefrontBrowserAdapter;
  readonly #cache = new Map<string, Promise<StorefrontInspection>>();

  constructor(captureRoot: string, adapter: StorefrontBrowserAdapter = new PlaywrightStorefrontBrowserAdapter()) {
    this.#captureRoot = captureRoot;
    this.#adapter = adapter;
  }

  async inspect({ jobId, referenceUrl }: InspectInput): Promise<StorefrontInspection> {
    const cacheKey = `${jobId}:${referenceUrl}`;
    const cached = this.#cache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const inspectionPromise = this.#inspectAndPersist({ jobId, referenceUrl });
    this.#cache.set(cacheKey, inspectionPromise);

    return inspectionPromise;
  }

  async #inspectAndPersist({ jobId, referenceUrl }: InspectInput): Promise<StorefrontInspection> {
    const rawInspection = await this.#adapter.inspect({ referenceUrl });
    const captureDirectory = join(this.#captureRoot, jobId);
    const captureBundlePath = join(captureDirectory, "capture-bundle.json");
    const desktopScreenshotPath = join(captureDirectory, "desktop.jpg");
    const mobileScreenshotPath = join(captureDirectory, "mobile.jpg");

    await mkdir(captureDirectory, { recursive: true });
    await writeFile(desktopScreenshotPath, rawInspection.desktopScreenshot);
    await writeFile(mobileScreenshotPath, rawInspection.mobileScreenshot);
    await writeFile(
      captureBundlePath,
      JSON.stringify(
        {
          sourceUrl: rawInspection.sourceUrl,
          resolvedUrl: rawInspection.resolvedUrl,
          referenceHost: rawInspection.referenceHost,
          title: rawInspection.title,
          ...(rawInspection.description ? { description: rawInspection.description } : {}),
          capturedAt: rawInspection.capturedAt,
          html: rawInspection.html,
          textContent: rawInspection.textContent,
          headingOutline: rawInspection.headingOutline,
          navigationLinks: rawInspection.navigationLinks,
          primaryCtas: rawInspection.primaryCtas,
          imageAssets: rawInspection.imageAssets,
          styleTokens: rawInspection.styleTokens,
          routeHints: rawInspection.routeHints,
          evidence: rawInspection.evidence,
          ...(rawInspection.httpStatus ? { httpStatus: rawInspection.httpStatus } : {}),
          isPasswordProtected: rawInspection.isPasswordProtected,
          ...(rawInspection.shopDomain ? { shopDomain: rawInspection.shopDomain } : {})
        },
        null,
        2
      )
    );

    return {
      sourceUrl: rawInspection.sourceUrl,
      resolvedUrl: rawInspection.resolvedUrl,
      referenceHost: rawInspection.referenceHost,
      title: rawInspection.title,
      ...(rawInspection.description ? { description: rawInspection.description } : {}),
      capturedAt: rawInspection.capturedAt,
      captureBundlePath,
      desktopScreenshotPath,
      mobileScreenshotPath,
      textContent: rawInspection.textContent,
      headingOutline: rawInspection.headingOutline,
      navigationLinks: rawInspection.navigationLinks,
      primaryCtas: rawInspection.primaryCtas,
      imageAssets: rawInspection.imageAssets,
      styleTokens: rawInspection.styleTokens,
      routeHints: rawInspection.routeHints,
      evidence: rawInspection.evidence,
      ...(rawInspection.httpStatus ? { httpStatus: rawInspection.httpStatus } : {}),
      isPasswordProtected: rawInspection.isPasswordProtected,
      ...(rawInspection.shopDomain ? { shopDomain: rawInspection.shopDomain } : {})
    };
  }
}

export type { RawStorefrontInspection, StorefrontBrowserAdapter };
