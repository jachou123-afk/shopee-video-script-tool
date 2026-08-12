import { chromium } from "playwright";
import {
  looksLikeLoginWall,
  normalizeMetaContent,
  normalizePdpResponse,
  normalizeShopeeUrl,
  parseShopeeIds,
} from "./shopee.mjs";

let browserContext;
let controlPage;
const productCache = new Map();
const productCacheTtlMs = 6 * 60 * 60 * 1000;
const productCacheMaxItems = 500;

export async function startBrowser() {
  browserContext = await chromium.launchPersistentContext("/data/profile", {
    headless: false,
    viewport: null,
    args: [
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-sandbox",
      "--window-size=1365,768",
    ],
  });

  const existingPages = browserContext.pages();
  controlPage = existingPages[0] || await browserContext.newPage();
  if (controlPage.url() === "about:blank") {
    await controlPage.goto(process.env.SHOPEE_HOME_URL || "https://shopee.tw/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    }).catch(() => {});
  }
  return browserContext;
}

async function pageSnapshot(page) {
  return page.evaluate(() => ({
    title: document.title || "",
    ogTitle: document.querySelector('meta[property="og:title"]')?.content || "",
    ogDescription: document.querySelector('meta[property="og:description"]')?.content || "",
    description: document.querySelector('meta[name="description"]')?.content || "",
    bodyText: document.body?.innerText?.slice(0, 3000) || "",
  }));
}

async function readAuthenticatedApi(page, ids) {
  if (!ids) return null;
  return page.evaluate(async ({ shopId, itemId }) => {
    const endpoint = `/api/v4/pdp/get_pc?shop_id=${encodeURIComponent(shopId)}&item_id=${encodeURIComponent(itemId)}&tz_offset_minutes=480&detail_level=0`;
    const response = await fetch(endpoint, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch {}
    return { ok: response.ok, status: response.status, payload };
  }, ids);
}

function productCacheKey(ids) {
  return ids ? `${ids.shopId}:${ids.itemId}` : "";
}

function readProductCache(ids) {
  const key = productCacheKey(ids);
  const cached = key ? productCache.get(key) : null;
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    productCache.delete(key);
    return null;
  }
  productCache.delete(key);
  productCache.set(key, cached);
  return { ...cached.product, source: `${cached.product.source || "authenticated_api"}_cache` };
}

function writeProductCache(ids, product) {
  const key = productCacheKey(ids);
  if (!key || !product?.description) return product;
  productCache.delete(key);
  productCache.set(key, {
    product: { ...product },
    expiresAt: Date.now() + productCacheTtlMs,
  });
  while (productCache.size > productCacheMaxItems) {
    productCache.delete(productCache.keys().next().value);
  }
  return product;
}

export async function extractShopeeProduct(rawUrl) {
  if (!browserContext) throw new Error("BROWSER_NOT_STARTED");
  const productUrl = normalizeShopeeUrl(rawUrl);
  const initialIds = parseShopeeIds(productUrl);
  const cached = readProductCache(initialIds);
  if (cached) return { ...cached, finalUrl: productUrl };

  if (initialIds && controlPage && !controlPage.isClosed()) {
    const api = await readAuthenticatedApi(controlPage, initialIds).catch(() => null);
    const structured = api?.ok ? normalizePdpResponse(api.payload) : null;
    if (structured?.description) {
      return { ...writeProductCache(initialIds, structured), finalUrl: productUrl };
    }
  }

  const page = await browserContext.newPage();

  try {
    await page.goto(productUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1800);

    let snapshot = await pageSnapshot(page);
    let meta = normalizeMetaContent(snapshot);
    if (meta?.description?.length >= 80 && !looksLikeLoginWall(snapshot)) {
      return { ...writeProductCache(initialIds || parseShopeeIds(page.url()), meta), finalUrl: page.url() };
    }

    const ids = parseShopeeIds(page.url());
    const api = await readAuthenticatedApi(page, ids).catch(() => null);
    const structured = api?.ok ? normalizePdpResponse(api.payload) : null;
    if (structured?.description) {
      return { ...writeProductCache(ids, structured), finalUrl: page.url() };
    }

    await page.waitForTimeout(1800);
    snapshot = await pageSnapshot(page);
    meta = normalizeMetaContent(snapshot);
    if (meta?.description && !looksLikeLoginWall(snapshot)) {
      return { ...writeProductCache(ids, meta), finalUrl: page.url() };
    }

    if (looksLikeLoginWall(snapshot)) throw new Error("SHOPEE_LOGIN_REQUIRED");
    throw new Error(`SHOPEE_CONTENT_UNAVAILABLE${api?.status ? `_${api.status}` : ""}`);
  } finally {
    await page.close().catch(() => {});
  }
}

export function browserStatus() {
  return {
    started: Boolean(browserContext),
    controlUrl: controlPage?.url() || "",
  };
}
