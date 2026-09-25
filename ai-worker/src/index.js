import { publishSnapshot, loadSnapshot, resolveSnapshotKey } from "./snapshot-blocks.js";
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });


function legacySnapshotKey(metadata, slot) {
  const [kind, ...parts] = slot.split(":");
  if (kind.startsWith("erp-order-") && !metadata.indexFormat && parts.length === 2) {
    if (parts[1] !== "0") return undefined;
    parts.pop();
  }
  return [kind, metadata.version, ...parts].join(":");
}
function snapshotReadKey(metadata, legacyKey) {
  const slot = legacyKey.replace(`:${metadata.version}:`, ":");
  const key = resolveSnapshotKey(metadata, slot, legacyKey);
  if (!key) throw new Error("SNAPSHOT_BLOCK_REFERENCE_MISSING");
  return key;
}
async function readSnapshotBlock(storage, metadata, legacyKey) {
  const value = await storage.get(snapshotReadKey(metadata, legacyKey));
  if (metadata?.snapshotFormat && value === undefined) throw new Error("SNAPSHOT_BLOCK_MISSING");
  return value;
}
function warehouseSnapshotKeys(metadata) {
  if (!metadata?.version) return [];
  const keys = [];
  for (let i = 0; i < (metadata.bucketCount || 64); i++) keys.push(`warehouse-location:${metadata.version}:${i}`);
  for (let i = 0; i < (metadata.searchChunkCount || 0); i++) keys.push(`warehouse-location-search:${metadata.version}:${i}`);
  for (let i = 0; i < (metadata.reverseBucketCount || 0); i++) {
    keys.push(`warehouse-location-reverse:${metadata.version}:${i}`);
    for (let j = 0; j < (metadata.reverseItemChunkCounts?.[i] || 0); j++) keys.push(`warehouse-location-reverse-items:${metadata.version}:${i}:${j}`);
  }
  return keys;
}
function orderSnapshotKeys(metadata) {
  if (!metadata?.version) return [];
  const keys = [];
  for (let i = 0; i < (metadata.chunkCount || 0); i++) keys.push(`erp-order:${metadata.version}:${i}`);
  for (const kind of ["alias", "sku-status"]) {
    const count = kind === "alias" ? metadata.aliasBucketCount : metadata.skuStatusBucketCount;
    for (let i = 0; i < (count || 0); i++) keys.push(...erpOrderIndexPageKeys(metadata, kind, i));
  }
  return keys;
}
function snapshotSavings(result) {
  return { writtenBlocks: result.writtenBlocks, reusedBlocks: result.reusedBlocks, writtenManifestPages: result.writtenManifestPages, writtenGarbagePages: result.writtenGarbagePages, deletedBlocks: result.deletedBlocks, cleanupFailed: result.cleanupFailed };
}
function logSnapshotSavings(kind, result) {
  console.log("SYNC_SNAPSHOT_SAVINGS", JSON.stringify({ kind, changed: result.changed, ...snapshotSavings(result) }));
}

// src/index.js
var allowedOrigins = /* @__PURE__ */ new Set([
  "https://jachou123-afk.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
]);
var usage = /* @__PURE__ */ new Map();
var lineActivations = /* @__PURE__ */ new Map();
var warehousePositionPromptActivations = /* @__PURE__ */ new Map();
var encoder = new TextEncoder();
var globalLineScheduleName = "line-schedule:global-v1";
var profitDashboardDataUrl = "https://vicchou-profit-analysis.vicchou.chatgpt.site/api/dashboard-data";
var defaultShopeeShopId = "52793230";
var workerPublicBaseUrl = "https://shopee-video-script-ai.jachou123-afk.workers.dev";
var warehouseImageCacheBucketCount = 64;
var warehouseImageQueueChunkSize = 100;
var warehouseImageFetchBatchSize = 20;
var warehouseImageFetchDailyLimit = 100;
var warehouseImageFetchMinDelayMs = 45e3;
var warehouseImageFetchMaxDelayMs = 75e3;
var warehouseImageFetchBatchPauseMs = 15 * 6e4;
var warehouseImageFailureBaseDelayMs = 30 * 6e4;
var warehouseImageMaxBytes = 8 * 1024 * 1024;
var nasImagePrecacheChunkSize = 100;
var nasImagePrecacheOfflineDelayMs = 5 * 6e4;
var warehousePositionDryRunTargetBasicId = "@059hdfyo";
var warehousePositionDryRunMaxSnapshotAgeMs = 30 * 6e4;
var warehousePositionPromptTtlMs = 8e3;
var warehousePositionWizardAction = "warehouse_position_dry_run";
var warehousePositionWriteAction = "warehouse_position_write_confirm";
var warehousePositionWriteConfirmTtlMs = 2 * 6e4;
var warehousePositionCustomInputTtlMs = 2 * 6e4;
var warehouseStorageLocationAction = "warehouse_storage_location";
var warehouseStorageLocationPageSize = 10;
var warehouseStorageLocationBucketCount = 64;
var warehouseStorageLocationIndexChunkSize = 50;
var erpOrderAliasBucketCount = 128;
var erpOrderSkuStatusBucketCount = 128;
var erpOrderChunkTargetBytes = 96 * 1024;
var erpOrderMaxSnapshotAgeMs = 30 * 6e4;
var erpOrderMaxInputItems = 2e4;
var erpOrderMaxStoredItems = 100;
var erpOrderMaxPrintableOrders = 100;
var erpOrderMaxAliases = 500;
var erpOrderPrintablePageSize = 20;
var erpOrderSkuStatusPageSize = 10;
var erpOrderRecentSelectionTtlMs = 5 * 6e4;
var erpOrderSkuStatusSelectionTtlMs = 1e4;
var erpOrderSkuAction = "erp_order_sku_lookup";
var erpOrderSkuStatuses = Object.freeze(["\u65B0\u8A02\u55AE", "\u53EF\u51FA\u8CA8", "\u51FA\u8CA8\u4E2D"]);
var warehousePositionWizardOptions = Object.freeze({
  zones: ["01", "02", "03", "04", "05", "06"],
  sides: ["L", "R"],
  shelves: ["01", "02", "03", "04", "05"],
  levels: ["01", "02", "03", "04"],
  trays: ["T1", "T2", "T3", "T4", "NONE"]
});
var warehousePositionVariantPageSize = 9;
var warehousePositionAllVariantLimit = 30;
var profitWarehouseCatalogCache = { expiresAt: 0, token: "", products: /* @__PURE__ */ new Map() };
var lineBotInfoCache = { expiresAt: 0, token: "", info: null };
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://jachou123-afk.github.io",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
__name(corsHeaders, "corsHeaders");
function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...corsHeaders(origin) }
  });
}
__name(json, "json");
function httpError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}
__name(httpError, "httpError");
async function withAbortTimeout(task, timeoutMs, message = "\u8655\u7406\u903E\u6642") {
  const controller = new AbortController();
  const timeoutError = httpError(message, 504);
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(() => task(controller.signal)),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort(timeoutError);
          reject(timeoutError);
        }, timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}
__name(withAbortTimeout, "withAbortTimeout");
function cleanShopeeUrl(raw) {
  const candidate = String(raw || "").trim().split(/\s+/)[0].replace(/[)\]}>，。！？、]+$/u, "");
  const url = new URL(candidate);
  if (!url.hostname.toLowerCase().endsWith("shopee.tw")) throw httpError("\u8ACB\u8CBC\u4E0A shopee.tw \u5546\u54C1\u9023\u7D50");
  return url;
}
__name(cleanShopeeUrl, "cleanShopeeUrl");
async function resolveShopeeUrl(raw, signal) {
  const url = cleanShopeeUrl(raw);
  if (url.hostname.toLowerCase() !== "s.shopee.tw") return url.toString();
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0" },
      signal
    });
    const resolved = cleanShopeeUrl(response.url);
    response.body?.cancel();
    return resolved.toString();
  } catch (error) {
    if (signal?.aborted) throw error;
    return url.toString();
  }
}
__name(resolveShopeeUrl, "resolveShopeeUrl");
function cleanProductTitleText(value) {
  const normalized = String(value || "").replace(/\s*\|\s*蝦皮購物\s*$/u, "").replace(/-i\.\d+\.\d+.*$/i, "").replace(/[+-]/g, " ").replace(/\s+/g, " ").trim();
  return normalized.replace(/^(?:(?:(?:台灣)?現貨|實拍影片)[!！\s]*)+/u, "").replace(/^【[^】]{1,60}】\s*/u, "").trim().slice(0, 500) || normalized.slice(0, 500) || "\u8766\u76AE\u5546\u54C1";
}
__name(cleanProductTitleText, "cleanProductTitleText");
function productTitle(raw) {
  const url = cleanShopeeUrl(raw);
  const seoName = url.searchParams.get("seoName");
  const decoded = seoName || decodeURIComponent(url.pathname).replace(/^\//, "");
  return cleanProductTitleText(decoded);
}
__name(productTitle, "productTitle");
function decodeHtmlEntities(value) {
  return String(value || "").replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16))).replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10))).replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&amp;/gi, "&");
}
__name(decodeHtmlEntities, "decodeHtmlEntities");
function extractShopeePageContent(html) {
  const metadata = {};
  for (const tag of String(html || "").match(/<meta\b[^>]*>/gis) || []) {
    const attributes = {};
    for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(["'])([\s\S]*?)\2/g)) {
      attributes[match[1].toLowerCase()] = decodeHtmlEntities(match[3]);
    }
    const key = String(attributes.property || attributes.name || "").toLowerCase();
    if ((key === "og:title" || key === "og:description" || key === "description") && attributes.content) {
      metadata[key] = attributes.content;
    }
  }
  return {
    title: metadata["og:title"] ? cleanProductTitleText(metadata["og:title"]) : "",
    description: String(metadata["og:description"] || metadata.description || "").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 6e3)
  };
}
__name(extractShopeePageContent, "extractShopeePageContent");
function normalizeReaderProduct(product) {
  const title = cleanProductTitleText(product?.title || "");
  const description = String(product?.description || "").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 12e3);
  const normalized = {
    title,
    description,
    source: String(product?.source || "nas_browser").slice(0, 80)
  };
  const imageUrl = normalizeShopeeImageUrl(product?.imageUrl || product?.image_url || product?.image);
  if (imageUrl) normalized.imageUrl = imageUrl;
  return normalized;
}
__name(normalizeReaderProduct, "normalizeReaderProduct");
function readerBrokerStub(env) {
  if (!env.LINE_ACTIVATION) throw httpError("NAS \u5546\u54C1\u8B80\u53D6\u670D\u52D9\u5C1A\u672A\u8A2D\u5B9A", 503);
  const id = env.LINE_ACTIVATION.idFromName("shopee-reader-broker-v1");
  return env.LINE_ACTIVATION.get(id);
}
__name(readerBrokerStub, "readerBrokerStub");
async function fetchFromNasReader(productUrl, env, signal) {
  const response = await readerBrokerStub(env).fetch("https://shopee-reader/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: productUrl }),
    signal
  });
  let result = null;
  try {
    result = await response.json();
  } catch {
  }
  if (!response.ok || !result?.ok) {
    const reason = String(result?.error || `HTTP_${response.status}`).slice(0, 120);
    throw httpError(`NAS \u5546\u54C1\u8B80\u53D6\u5931\u6557\uFF1A${reason}`, 503);
  }
  return normalizeReaderProduct(result.product);
}
__name(fetchFromNasReader, "fetchFromNasReader");
async function fetchShopeePageContent(productUrl, env, signal) {
  const controller = new AbortController();
  const abortFromParent = /* @__PURE__ */ __name(() => controller.abort(signal?.reason), "abortFromParent");
  if (signal?.aborted) abortFromParent();
  else signal?.addEventListener("abort", abortFromParent, { once: true });
  const timeout = setTimeout(() => controller.abort(), 8e3);
  let direct = { title: "", description: "", source: "" };
  try {
    const response = await fetch(productUrl, {
      headers: {
        "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "zh-TW,zh;q=0.9"
      },
      redirect: "follow",
      signal: controller.signal
    });
    if (response.ok) {
      direct = { ...extractShopeePageContent(await response.text()), source: "direct_meta" };
      if (direct.description.length >= 5) return direct;
    } else {
      console.log("SHOPEE_DIRECT_FETCH", JSON.stringify({ status: response.status }));
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    console.log("SHOPEE_DIRECT_FETCH", JSON.stringify({ error: error?.name || "fetch_failed" }));
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromParent);
  }
  try {
    const reader = await fetchFromNasReader(productUrl, env, signal);
    if (reader.description.length >= 5) return reader;
  } catch (error) {
    if (signal?.aborted) throw error;
    console.error("SHOPEE_NAS_READER", error?.message || error);
  }
  throw httpError("\u76EE\u524D\u7121\u6CD5\u8B80\u53D6\u5546\u54C1\u5B8C\u6574\u5167\u5BB9\uFF0C\u8ACB\u78BA\u8A8D NAS \u8B80\u53D6\u670D\u52D9\u5728\u7DDA\u4E14\u8766\u76AE\u5E33\u865F\u4ECD\u70BA\u767B\u5165\u72C0\u614B", 503);
}
__name(fetchShopeePageContent, "fetchShopeePageContent");
function canonicalShopeeUrl(raw) {
  const url = cleanShopeeUrl(raw);
  const productPath = url.pathname.match(/^\/product\/(\d+)\/(\d+)/i);
  const legacyPath = decodeURIComponent(url.pathname).match(/-i\.(\d+)\.(\d+)/i);
  const ids = productPath || legacyPath;
  return ids ? `https://shopee.tw/product/${ids[1]}/${ids[2]}` : url.toString();
}
__name(canonicalShopeeUrl, "canonicalShopeeUrl");
function shopeeProductId(raw) {
  try {
    const url = cleanShopeeUrl(raw);
    const productPath = url.pathname.match(/^\/product\/\d+\/(\d+)/i);
    const legacyPath = decodeURIComponent(url.pathname).match(/-i\.\d+\.(\d+)/i);
    return String((productPath || legacyPath)?.[1] || "");
  } catch {
    return "";
  }
}
__name(shopeeProductId, "shopeeProductId");
function profitSkuMapFromDashboard(data) {
  const products = Array.isArray(data?.current?.products) ? data.current.products : [];
  const mapping = /* @__PURE__ */ new Map();
  for (const product of products) {
    const productId = String(product?.pid || "").trim();
    const skuLabel = String(product?.skuLabel || "").replace(/\s+/g, " ").trim().slice(0, 100);
    if (productId && skuLabel) mapping.set(productId, skuLabel);
  }
  return mapping;
}
__name(profitSkuMapFromDashboard, "profitSkuMapFromDashboard");
function normalizeWarehouseSku(value) {
  return String(value || "").normalize("NFKC").replace(/\s+/g, "").trim().toUpperCase().slice(0, 80);
}
__name(normalizeWarehouseSku, "normalizeWarehouseSku");
function isNasLocalImageSku(value) {
  const sku = normalizeWarehouseSku(value);
  return /^(?=[GK])(?=.*\d)[A-Z0-9._-]{2,32}$/u.test(sku);
}
__name(isNasLocalImageSku, "isNasLocalImageSku");
function normalizeShopeeImageUrl(value) {
  const raw = typeof value === "object" && value ? value.url || value.imageUrl || value.image_url || value.id || value.image_id || "" : value;
  const text = String(raw || "").trim();
  if (/^https:\/\/[^\s]+$/iu.test(text)) return text.slice(0, 2e3);
  if (/^[A-Za-z0-9_-]{10,300}$/u.test(text)) {
    return `https://down-tw.img.susercontent.com/file/${text}`;
  }
  return "";
}
__name(normalizeShopeeImageUrl, "normalizeShopeeImageUrl");
function profitWarehouseProductMapFromDashboard(data) {
  const products = Array.isArray(data?.current?.products) ? data.current.products : [];
  const mapping = /* @__PURE__ */ new Map();
  for (const product of products) {
    const sku = normalizeWarehouseSku(product?.skuLabel || product?.sku || product?.itemSku);
    const productId = String(product?.pid || product?.productId || product?.itemId || "").trim();
    if (!sku || !productId || mapping.has(sku)) continue;
    const shopId = String(product?.shopId || product?.shop_id || defaultShopeeShopId).trim() || defaultShopeeShopId;
    const imageCandidate = product?.imageUrl || product?.image_url || product?.thumbnailUrl || product?.thumbnail || product?.coverImage || product?.cover || product?.image || (Array.isArray(product?.images) ? product.images[0] : "");
    mapping.set(sku, {
      productId,
      productUrl: `https://shopee.tw/product/${shopId}/${productId}`,
      imageUrl: normalizeShopeeImageUrl(imageCandidate)
    });
  }
  return mapping;
}
__name(profitWarehouseProductMapFromDashboard, "profitWarehouseProductMapFromDashboard");
function normalizeWarehouseImageCandidate(raw) {
  const sku = normalizeWarehouseSku(raw?.sku);
  let productUrl = String(raw?.productUrl || "").trim();
  try {
    productUrl = canonicalShopeeUrl(productUrl);
  } catch {
    return null;
  }
  const productId = String(raw?.productId || shopeeProductId(productUrl)).trim().slice(0, 80);
  if (!sku || !productId) return null;
  return {
    sku,
    productId,
    productUrl: productUrl.slice(0, 500),
    sourceImageUrl: normalizeShopeeImageUrl(raw?.sourceImageUrl || raw?.imageUrl)
  };
}
__name(normalizeWarehouseImageCandidate, "normalizeWarehouseImageCandidate");
function warehouseImageObjectKey(sku) {
  return `warehouse/${encodeURIComponent(normalizeWarehouseSku(sku))}`;
}
__name(warehouseImageObjectKey, "warehouseImageObjectKey");
function warehouseImagePublicUrl(sku, cachedAt) {
  return `${workerPublicBaseUrl}/product-images/${encodeURIComponent(normalizeWarehouseSku(sku))}?v=${Math.max(0, Number(cachedAt) || 0)}`;
}
__name(warehouseImagePublicUrl, "warehouseImagePublicUrl");
function taipeiDayKey(timestamp = Date.now()) {
  return new Date(Number(timestamp) + 8 * 60 * 6e4).toISOString().slice(0, 10);
}
__name(taipeiDayKey, "taipeiDayKey");
function nextTaipeiDayStart(timestamp = Date.now()) {
  const shifted = new Date(Number(timestamp) + 8 * 60 * 6e4);
  shifted.setUTCHours(24, 0, 0, 0);
  return shifted.getTime() - 8 * 60 * 6e4;
}
__name(nextTaipeiDayStart, "nextTaipeiDayStart");
function warehouseImageDelay(minimum = warehouseImageFetchMinDelayMs, maximum = warehouseImageFetchMaxDelayMs) {
  const min = Math.max(1e3, Number(minimum) || warehouseImageFetchMinDelayMs);
  const max = Math.max(min, Number(maximum) || warehouseImageFetchMaxDelayMs);
  return Math.floor(min + Math.random() * (max - min + 1));
}
__name(warehouseImageDelay, "warehouseImageDelay");
async function profitWarehouseProductMap(env) {
  const bypassToken = String(env?.PROFIT_DASHBOARD_BYPASS_TOKEN || "").trim();
  if (!bypassToken) return /* @__PURE__ */ new Map();
  if (profitWarehouseCatalogCache.token === bypassToken && profitWarehouseCatalogCache.expiresAt > Date.now()) {
    return profitWarehouseCatalogCache.products;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7e3);
  try {
    const response = await fetch(profitDashboardDataUrl, {
      headers: { "OAI-Sites-Authorization": `Bearer ${bypassToken}` },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const products = profitWarehouseProductMapFromDashboard(await response.json());
    profitWarehouseCatalogCache = {
      token: bypassToken,
      expiresAt: Date.now() + 5 * 60 * 1e3,
      products
    };
    return products;
  } finally {
    clearTimeout(timeout);
  }
}
__name(profitWarehouseProductMap, "profitWarehouseProductMap");
async function enrichScheduleItemsWithProfitSkus(items, env) {
  const normalized = (Array.isArray(items) ? items : []).map((item) => ({ ...item }));
  const bypassToken = String(env?.PROFIT_DASHBOARD_BYPASS_TOKEN || "").trim();
  if (!normalized.length || !bypassToken) return normalized;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7e3);
  try {
    const response = await fetch(profitDashboardDataUrl, {
      headers: { "OAI-Sites-Authorization": `Bearer ${bypassToken}` },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const mapping = profitSkuMapFromDashboard(await response.json());
    return normalized.map((item) => ({
      ...item,
      skuLabel: mapping.get(shopeeProductId(item.productUrl)) || String(item.skuLabel || "").trim()
    }));
  } catch (error) {
    console.error("PROFIT_SKU_LOOKUP", error?.message || error);
    return normalized;
  } finally {
    clearTimeout(timeout);
  }
}
__name(enrichScheduleItemsWithProfitSkus, "enrichScheduleItemsWithProfitSkus");
function allowRequest(key) {
  const hour = Math.floor(Date.now() / 36e5);
  const usageKey = `${key}:${hour}`;
  const count = usage.get(usageKey) || 0;
  if (count >= 20) return false;
  usage.set(usageKey, count + 1);
  if (usage.size > 1e3) {
    for (const entry of usage.keys()) {
      if (!entry.endsWith(`:${hour}`)) usage.delete(entry);
    }
  }
  return true;
}
__name(allowRequest, "allowRequest");
function outputText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}
__name(outputText, "outputText");
var scriptSchema = {
  type: "object",
  additionalProperties: false,
  required: ["productName", "totalSeconds", "direction", "segments"],
  properties: {
    productName: { type: "string" },
    totalSeconds: { type: "integer", minimum: 10, maximum: 60 },
    direction: { type: "string" },
    segments: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["time", "title", "voice"],
        properties: {
          time: { type: "string" },
          title: { type: "string" },
          voice: { type: "string" }
        }
      }
    }
  }
};
async function generateScript(body, env, options = {}) {
  if (!env.OPENAI_API_KEY) throw httpError("AI \u670D\u52D9\u5C1A\u672A\u8A2D\u5B9A\u5B8C\u6210", 503);
  const signal = options?.signal;
  const productUrl = await resolveShopeeUrl(String(body.productUrl || ""), signal);
  const pageContent = await fetchShopeePageContent(productUrl, env, signal);
  const suppliedTitle = String(body.productName || body.title || "").replace(/\s+/g, " ").trim().slice(0, 500);
  const title = pageContent.title || suppliedTitle || productTitle(productUrl);
  const focus = String(body.focus || "").trim().slice(0, 300);
  const requestedSeconds = Math.min(60, Math.max(10, Number.parseInt(body.seconds, 10) || 40));
  const prompt = [
    `\u5546\u54C1\u7DB2\u5740\u53EF\u8FA8\u8B58\u6A19\u984C\uFF1A${title}`,
    pageContent.description ? `\u4EE5\u4E0B\u662F\u5BE6\u969B\u5546\u54C1\u9801\u5167\u5BB9\uFF0C\u8ACB\u512A\u5148\u6839\u64DA\u5176\u4E2D\u7684\u5546\u54C1\u7279\u8272\u3001\u6750\u8CEA\u3001\u5C3A\u5BF8\u3001\u6578\u91CF\u3001\u984F\u8272\u8207\u4F7F\u7528\u65B9\u5F0F\u64B0\u5BEB\uFF1A
---\u5546\u54C1\u9801\u5167\u5BB9---
${pageContent.description}
---\u5546\u54C1\u9801\u5167\u5BB9\u7D50\u675F---` : "\u5546\u54C1\u9801\u5167\u5BB9\u76EE\u524D\u7121\u6CD5\u8B80\u53D6\uFF0C\u53EA\u80FD\u6839\u64DA\u5546\u54C1\u540D\u7A31\u64B0\u5BEB\uFF1B\u4E0D\u53EF\u81EA\u884C\u88DC\u5145\u898F\u683C\u6216\u8CE3\u9EDE\u3002",
    `\u4F7F\u7528\u8005\u5E0C\u671B\u7684\u62CD\u651D\u65B9\u5411\uFF1A${focus || "\u6C92\u6709\u6307\u5B9A\uFF0C\u8ACB\u7A81\u51FA\u6700\u5BB9\u6613\u7528\u756B\u9762\u8B49\u660E\u7684\u8CE3\u9EDE"}`,
    `\u8ACB\u88FD\u4F5C\u4E00\u652F\u7E3D\u9577\u525B\u597D ${requestedSeconds} \u79D2\u7684\u7E41\u9AD4\u4E2D\u6587\u8766\u76AE\u5546\u54C1\u77ED\u5F71\u7247\u53E3\u64AD\u8173\u672C\u3002`,
    "\u8F38\u51FA\u53EA\u8981 3 \u6BB5\uFF1A\u958B\u982D\u3001\u8CE3\u9EDE\u3001\u7D50\u5C3E\u3002\u6BCF\u6BB5\u5305\u542B\u9023\u7E8C\u4E14\u4E0D\u91CD\u758A\u7684\u79D2\u6578\u8207\u4E00\u6BB5\u81EA\u7136\u53E3\u64AD\uFF0C\u4E0D\u8981\u62C6\u6210\u591A\u500B\u93E1\u982D\uFF0C\u4E5F\u4E0D\u8981\u53E6\u5BEB\u5B57\u5E55\u3002",
    `totalSeconds \u5FC5\u9808\u662F ${requestedSeconds}\uFF0C\u4E09\u6BB5\u6642\u9593\u5FC5\u9808\u5F9E 0 \u79D2\u958B\u59CB\u3001\u9023\u7E8C\u5206\u914D\uFF0C\u6700\u5F8C\u525B\u597D\u5728 ${requestedSeconds} \u79D2\u7D50\u675F\u3002`,
    "\u958B\u982D\u7D04\u5360 15%\uFF0C\u7528\u4E00\u53E5\u8A71\u5438\u5F15\u76EE\u6A19\u5BA2\u7FA4\uFF1B\u8CE3\u9EDE\u662F\u4E3B\u9AD4\uFF1B\u7D50\u5C3E\u7D04\u5360 20%\uFF0C\u8981\u6709\u7C21\u77ED\u884C\u52D5\u5F15\u5C0E\u3002",
    "\u5F71\u7247\u56FA\u5B9A\u4F7F\u7528\u55AE\u4E00\u93E1\u982D\uFF0C\u6240\u4EE5\u4E0D\u8981\u63D0\u4F9B\u62CD\u651D\u65B9\u5F0F\u3001\u642D\u914D\u52D5\u4F5C\u3001\u93E1\u4F4D\u3001\u904B\u93E1\u6216\u756B\u9762\u6307\u793A\u3002",
    "\u82E5\u4F7F\u7528\u8005\u6307\u5B9A\u5167\u88DD\u3001\u9694\u5C64\u6216\u5BB9\u91CF\uFF0C\u8CE3\u9EDE\u53E3\u64AD\u5FC5\u9808\u96C6\u4E2D\u4ECB\u7D39\u8A72\u65B9\u5411\u3002",
    "\u53EA\u80FD\u6839\u64DA\u5546\u54C1\u6A19\u984C\u3001\u4E0A\u8FF0\u5546\u54C1\u9801\u5167\u5BB9\u8207\u4F7F\u7528\u8005\u65B9\u5411\u64B0\u5BEB\uFF1B\u4E0D\u8981\u634F\u9020\u6750\u8CEA\u3001\u5C3A\u5BF8\u3001\u6578\u91CF\u3001\u8010\u7528\u5E74\u9650\u6216\u5546\u54C1\u9801\u672A\u63D0\u4F9B\u7684\u4FDD\u8B49\u3002",
    "\u53E3\u64AD\u7E3D\u9577\u8981\u80FD\u5728\u6307\u5B9A\u79D2\u6578\u5167\u81EA\u7136\u8AAA\u5B8C\uFF0C\u8A9E\u6C23\u50CF\u53F0\u7063\u96FB\u5546\u77ED\u5F71\u7247\u62CD\u651D\u4EBA\u54E1\uFF0C\u6E05\u695A\u76F4\u63A5\uFF0C\u4E0D\u8981\u8A87\u5927\u3002"
  ].join("\n");
  const openai = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-5.6-luna",
      reasoning: { effort: "none" },
      instructions: "\u4F60\u662F\u53F0\u7063\u96FB\u5546\u77ED\u5F71\u7247\u5C0E\u6F14\uFF0C\u5C08\u9580\u628A\u5546\u54C1\u8CC7\u6599\u8F49\u6210\u80FD\u76F4\u63A5\u7167\u8457\u62CD\u7684\u77ED\u8173\u672C\u3002",
      input: prompt,
      max_output_tokens: 1e3,
      text: {
        format: {
          type: "json_schema",
          name: "shooting_script",
          strict: true,
          schema: scriptSchema
        }
      }
    }),
    signal
  });
  const response = await openai.json();
  if (!openai.ok) {
    console.error("OpenAI error", openai.status, response?.error?.code || "unknown");
    if (openai.status === 401) throw httpError("AI \u91D1\u9470\u7121\u6548\uFF0C\u8ACB\u901A\u77E5\u7BA1\u7406\u8005", 502);
    if (openai.status === 429) throw httpError("AI \u4F7F\u7528\u984D\u5EA6\u4E0D\u8DB3\u6216\u8ACB\u6C42\u592A\u591A\uFF0C\u8ACB\u7A0D\u5F8C\u518D\u8A66", 502);
    throw httpError("AI \u66AB\u6642\u7121\u6CD5\u7522\u751F\u8173\u672C\uFF0C\u8ACB\u7A0D\u5F8C\u518D\u8A66", 502);
  }
  const text = outputText(response);
  if (!text) throw httpError("AI \u6C92\u6709\u56DE\u50B3\u8173\u672C\uFF0C\u8ACB\u518D\u8A66\u4E00\u6B21", 502);
  try {
    const script = JSON.parse(text);
    script.productName = title;
    script.totalSeconds = requestedSeconds;
    script.pageContentRead = Boolean(pageContent.description);
    return script;
  } catch {
    throw httpError("AI \u56DE\u50B3\u683C\u5F0F\u932F\u8AA4\uFF0C\u8ACB\u518D\u8A66\u4E00\u6B21", 502);
  }
}
__name(generateScript, "generateScript");
function findShopeeUrl(text) {
  return findShopeeUrls(text)[0] || "";
}
__name(findShopeeUrl, "findShopeeUrl");
function findShopeeUrls(text) {
  const urls = [];
  const seen = /* @__PURE__ */ new Set();
  for (const match of String(text || "").matchAll(/https?:\/\/[^\s<>"'\[\]()]+/giu)) {
    try {
      const rawUrl = cleanShopeeUrl(match[0]).toString();
      const productUrl = canonicalShopeeUrl(rawUrl);
      if (seen.has(productUrl)) continue;
      seen.add(productUrl);
      urls.push(rawUrl);
    } catch {
    }
  }
  return urls;
}
__name(findShopeeUrls, "findShopeeUrls");
function scheduleItemsFromText(text) {
  return findShopeeUrls(text).slice(0, 50).map((rawUrl) => ({
    productUrl: canonicalShopeeUrl(rawUrl),
    productName: productTitle(rawUrl).slice(0, 160)
  }));
}
__name(scheduleItemsFromText, "scheduleItemsFromText");
function isScheduleAddCommand(text) {
  return /^廣告影片排程(?:\s|$)/u.test(String(text || "").trim());
}
__name(isScheduleAddCommand, "isScheduleAddCommand");
function isPendingScheduleCommand(text) {
  return /^要拍什麼[？?]?$/u.test(String(text || "").trim());
}
__name(isPendingScheduleCommand, "isPendingScheduleCommand");
function isCompletedScheduleCommand(text) {
  return /^已拍完$/u.test(String(text || "").trim());
}
__name(isCompletedScheduleCommand, "isCompletedScheduleCommand");
function normalizeScheduleDigits(text) {
  return String(text || "").trim().replace(/[０-９]/gu, (digit) => String(digit.charCodeAt(0) - 65296));
}
__name(normalizeScheduleDigits, "normalizeScheduleDigits");
function parseScheduleSelection(text) {
  const match = normalizeScheduleDigits(text).match(/^(\d{1,3})$/u);
  if (!match) return null;
  const index = Number.parseInt(match[1], 10);
  return index >= 1 ? index : null;
}
__name(parseScheduleSelection, "parseScheduleSelection");
function parseScheduleCompletion(text) {
  const match = normalizeScheduleDigits(text).match(/^完成\s*(?:第\s*)?(\d{1,3})(?:\s*號)?$/u);
  if (!match) return null;
  const index = Number.parseInt(match[1], 10);
  return index >= 1 ? index : null;
}
__name(parseScheduleCompletion, "parseScheduleCompletion");
function parseScheduleUndoCompletion(text) {
  const match = normalizeScheduleDigits(text).match(/^取消完成\s*(?:第\s*)?(\d{1,3})(?:\s*號)?$/u);
  if (!match) return null;
  const index = Number.parseInt(match[1], 10);
  return index >= 1 ? index : null;
}
__name(parseScheduleUndoCompletion, "parseScheduleUndoCompletion");
function formatTaipeiDate(timestamp) {
  try {
    return new Intl.DateTimeFormat("zh-TW", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date(Number(timestamp)));
  } catch {
    return "\u6642\u9593\u4E0D\u660E";
  }
}
__name(formatTaipeiDate, "formatTaipeiDate");
function splitLineText(text, maxLength = 4500, maxMessages = 5) {
  const lines = String(text || "").split("\n");
  const chunks = [];
  let current = "";
  for (const line of lines) {
    const candidate = current ? `${current}
${line}` : line;
    if (candidate.length <= maxLength) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    current = line.slice(0, maxLength);
    if (chunks.length >= maxMessages - 1) break;
  }
  if (current && chunks.length < maxMessages) chunks.push(current);
  return chunks.map((chunk) => ({ type: "text", text: chunk }));
}
__name(splitLineText, "splitLineText");
function formatScheduleProductName(item) {
  const productName = String(item?.productName || "\u8766\u76AE\u5546\u54C1").replace(/\s+/g, " ").trim() || "\u8766\u76AE\u5546\u54C1";
  const skuLabel = String(item?.skuLabel || "").replace(/\s+/g, " ").trim();
  return skuLabel && !productName.startsWith(`\u3010${skuLabel}\u3011`) ? `\u3010${skuLabel}\u3011${productName}` : productName;
}
__name(formatScheduleProductName, "formatScheduleProductName");
function formatPendingSchedule(items) {
  if (!items.length) return "\u{1F3AC} \u76EE\u524D\u6C92\u6709\u5F85\u62CD\u7684\u5EE3\u544A\u5F71\u7247\u3002";
  const lines = [`\u{1F3AC} \u5168\u57DF\u5F85\u62CD\u5EE3\u544A\u5F71\u7247\uFF08\u5171 ${items.length} \u9805\uFF09`, ""];
  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${formatScheduleProductName(item)}`);
    lines.push(`   ${item.productUrl}`);
  });
  lines.push("", "\u8ACB\u56DE\u8986\u7DE8\u865F\u7522\u751F\u6587\u6848\uFF0C\u4F8B\u5982\uFF1A1", "\u62CD\u651D\u5B8C\u6210\u5F8C\u8F38\u5165\u300C\u5B8C\u62101\u300D\u3002");
  return lines.join("\n");
}
__name(formatPendingSchedule, "formatPendingSchedule");
function formatCompletedSchedule(items) {
  if (!items.length) return "\u2705 \u76EE\u524D\u9084\u6C92\u6709\u5DF2\u62CD\u5B8C\u7684\u7D00\u9304\u3002";
  const lines = [`\u2705 \u5168\u57DF\u5DF2\u62CD\u5B8C\uFF08\u5171 ${items.length} \u9805\uFF09`, ""];
  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${formatScheduleProductName(item)}`);
    lines.push(`   \u5B8C\u6210\u6642\u9593\uFF1A${formatTaipeiDate(item.completedAt)}`);
    lines.push(`   \u62CD\u651D\u54E1\u5DE5\uFF1A${item.completedBy || "\u7FA4\u7D44\u6210\u54E1"}`);
    lines.push(`   ${item.productUrl}`);
  });
  lines.push("", "\u82E5\u8AA4\u6A19\u5B8C\u6210\uFF0C\u8F38\u5165\u300C\u53D6\u6D88\u5B8C\u62101\u300D\u3002");
  return lines.join("\n");
}
__name(formatCompletedSchedule, "formatCompletedSchedule");
function lineInput(text, productUrl) {
  const secondsMatch = String(text).match(/(?:約\s*)?(\d{2})\s*秒/u);
  const seconds = secondsMatch ? Math.min(60, Math.max(10, Number.parseInt(secondsMatch[1], 10))) : 40;
  const focus = String(text).replace(/https?:\/\/[^\s]+/iu, " ").replace(/(?:約\s*)?\d{2}\s*秒/gu, " ").replace(/\s+/g, " ").trim().slice(0, 300);
  return { productUrl, focus, seconds };
}
__name(lineInput, "lineInput");
function panelPostback(productUrl, seconds, focus = "", title = "", action = "generate") {
  const params = new URLSearchParams({
    action,
    url: canonicalShopeeUrl(productUrl),
    seconds: String(seconds),
    focus
  });
  let compactTitle = String(title || "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (compactTitle) params.set("title", compactTitle);
  while (compactTitle && params.toString().length > 300) {
    compactTitle = compactTitle.slice(0, -1);
    if (compactTitle) params.set("title", compactTitle);
    else params.delete("title");
  }
  return params.toString();
}
__name(panelPostback, "panelPostback");
function focusPanelPostback(productUrl, seconds, title = "") {
  return panelPostback(productUrl, seconds, "", title, "choose_focus");
}
__name(focusPanelPostback, "focusPanelPostback");
function createLinePanel(productUrl, title) {
  const options = [
    { label: "30 \u79D2\u5FEB\u901F\u7248", seconds: 30 },
    { label: "40 \u79D2\u6A19\u6E96\u7248", seconds: 40 },
    { label: "60 \u79D2\u8A73\u7D30\u7248", seconds: 60 }
  ];
  const buttons = options.map((option) => ({
    type: "button",
    style: "primary",
    color: "#174B3A",
    height: "sm",
    margin: option.seconds === 30 ? "lg" : "sm",
    action: {
      type: "postback",
      label: option.label,
      data: focusPanelPostback(productUrl, option.seconds, title),
      displayText: option.label
    }
  }));
  return {
    type: "flex",
    altText: `\u8ACB\u9078\u64C7\u300C${title}\u300D\u7684\u62CD\u651D\u8173\u672C`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#174B3A",
        paddingAll: "20px",
        contents: [
          { type: "text", text: "AI \u5546\u54C1\u62CD\u651D\u8173\u672C", color: "#D9F46B", weight: "bold", size: "sm" },
          { type: "text", text: "\u9078\u64C7\u8173\u672C\u7248\u672C", color: "#FFFFFF", weight: "bold", size: "xl", margin: "sm" }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "20px",
        contents: [
          { type: "text", text: title, weight: "bold", size: "md", wrap: true, maxLines: 2 },
          { type: "text", text: "\u5148\u9078\u64C7\u79D2\u6578\uFF0C\u4E0B\u4E00\u6B65\u518D\u9078\u62CD\u651D\u91CD\u9EDE\u3002", color: "#718078", size: "sm", wrap: true, margin: "sm" },
          ...buttons
        ]
      }
    }
  };
}
__name(createLinePanel, "createLinePanel");
function createLineFocusPanel(productUrl, title, seconds) {
  const options = [
    { label: "AI \u81EA\u52D5\u9078\u64C7\u91CD\u9EDE", focus: "" },
    { label: "\u91CD\u9EDE\u62CD\u5BB9\u91CF", focus: "\u91CD\u9EDE\u62CD\u5BB9\u91CF" },
    { label: "\u91CD\u9EDE\u62CD\u6750\u8CEA", focus: "\u91CD\u9EDE\u62CD\u6750\u8CEA" },
    { label: "\u91CD\u9EDE\u62CD\u4F7F\u7528\u65B9\u5F0F", focus: "\u91CD\u9EDE\u62CD\u4F7F\u7528\u65B9\u5F0F" }
  ];
  const buttons = options.map((option, index) => ({
    type: "button",
    style: index === 0 ? "primary" : "secondary",
    color: index === 0 ? "#174B3A" : void 0,
    height: "sm",
    margin: index === 0 ? "lg" : "sm",
    action: {
      type: "postback",
      label: option.label,
      data: panelPostback(productUrl, seconds, option.focus, title),
      displayText: option.label
    }
  }));
  return {
    type: "flex",
    altText: `\u8ACB\u9078\u64C7\u300C${title}\u300D\u7684\u62CD\u651D\u91CD\u9EDE`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#174B3A",
        paddingAll: "20px",
        contents: [
          { type: "text", text: `${seconds} \u79D2\u8173\u672C`, color: "#D9F46B", weight: "bold", size: "sm" },
          { type: "text", text: "\u9078\u64C7\u62CD\u651D\u91CD\u9EDE", color: "#FFFFFF", weight: "bold", size: "xl", margin: "sm" }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "20px",
        contents: [
          { type: "text", text: title, weight: "bold", size: "md", wrap: true, maxLines: 2 },
          { type: "text", text: "\u4E0D\u6307\u5B9A\u6642\uFF0CAI \u6703\u4F9D\u5546\u54C1\u540D\u7A31\u81EA\u52D5\u9078\u64C7\u3002", color: "#718078", size: "sm", wrap: true, margin: "sm" },
          ...buttons
        ]
      }
    }
  };
}
__name(createLineFocusPanel, "createLineFocusPanel");
function formatLineScript(script) {
  const sections = (script.segments || []).map(
    (segment, index) => `${index + 1}\uFF5C${segment.time}\uFF5C${segment.title}
${segment.voice}`
  );
  const direction = script.direction ? `
\u62CD\u651D\u91CD\u9EDE\uFF1A${script.direction}` : "";
  const source = script.pageContentRead === true ? "\u{1F4C4} \u5DF2\u8B80\u53D6\u5546\u54C1\u9801\u5167\u5BB9" : script.pageContentRead === false ? "\u26A0\uFE0F \u5546\u54C1\u9801\u7121\u6CD5\u8B80\u53D6\uFF0C\u672C\u6B21\u50C5\u4F9D\u5546\u54C1\u540D\u7A31\u751F\u6210" : "";
  return [
    `\u{1F3AC} ${script.productName}`,
    source,
    `\u23F1 ${script.totalSeconds} \u79D2${direction}`,
    "",
    ...sections
  ].filter(Boolean).join("\n\n").slice(0, 4900);
}
__name(formatLineScript, "formatLineScript");
function base64Bytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
__name(base64Bytes, "base64Bytes");
async function verifyLineSignature(rawBody, signature, channelSecret) {
  if (!signature || !channelSecret) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(channelSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    return crypto.subtle.verify("HMAC", key, base64Bytes(signature), encoder.encode(rawBody));
  } catch {
    return false;
  }
}
__name(verifyLineSignature, "verifyLineSignature");
async function replyLine(replyToken, messageOrMessages, env) {
  const messages = Array.isArray(messageOrMessages) ? messageOrMessages : [{ type: "text", text: String(messageOrMessages).slice(0, 5e3) }];
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ replyToken, messages })
  });
  if (!response.ok) console.error("LINE reply error", response.status, await response.text());
}
__name(replyLine, "replyLine");
function isGroupSource(source) {
  return source?.type === "group" || source?.type === "room";
}
__name(isGroupSource, "isGroupSource");
function isSelfMentioned(message) {
  return (message?.mention?.mentionees || []).some(
    (mentionee) => mentionee.type === "user" && mentionee.isSelf === true
  );
}
__name(isSelfMentioned, "isSelfMentioned");
function removeLineMentions(text, mention) {
  let cleaned = String(text || "");
  const ranges = (mention?.mentionees || []).filter((mentionee) => Number.isInteger(mentionee.index) && Number.isInteger(mentionee.length)).sort((a, b) => b.index - a.index);
  for (const range of ranges) {
    cleaned = `${cleaned.slice(0, range.index)} ${cleaned.slice(range.index + range.length)}`;
  }
  return cleaned.replace(/\s+/g, " ").trim();
}
__name(removeLineMentions, "removeLineMentions");
function isLineHelpCommand(text) {
  return /^(?:使用方法|使用說明|如何使用|怎麼用|說明|help)$/iu.test(String(text || "").trim());
}
__name(isLineHelpCommand, "isLineHelpCommand");
function isLineScriptPromptCommand(text) {
  return /^(?:產生文案|商品文案|寫文案)$/u.test(String(text || "").trim());
}
__name(isLineScriptPromptCommand, "isLineScriptPromptCommand");
function parseWarehouseLocationCommand(text) {
  const normalized = normalizeScheduleDigits(text).trim();
  const prefixed = normalized.match(/^儲位\s*(?:[+＋:：]\s*)?([^\s]+)\s*$/iu);
  if (prefixed) {
    const sku2 = String(prefixed[1] || "").replace(/[，,。；;]+$/u, "").trim().toUpperCase();
    const isPrefixedSku = /^(?=[A-Z0-9._-]{2,80}$)(?=[A-Z0-9._-]*[A-Z])(?=[A-Z0-9._-]*\d)[A-Z0-9._-]+$/u.test(sku2);
    return isPrefixedSku ? sku2 : null;
  }
  const sku = normalized.toUpperCase();
  const isBareSku = /^(?=[A-Z0-9._-]{2,80}$)(?=[A-Z0-9._-]*[A-Z])(?=[A-Z0-9._-]*\d)[A-Z0-9._-]+$/u.test(sku);
  return isBareSku ? sku : null;
}
__name(parseWarehouseLocationCommand, "parseWarehouseLocationCommand");
function normalizeWarehouseStorageLocation(value) {
  return String(value || "").normalize("NFKC").toUpperCase().replace(/[‐‑‒–—―−﹘﹣－]/gu, "-").replace(/／/gu, "/").replace(/\s+/gu, "").slice(0, 160);
}
__name(normalizeWarehouseStorageLocation, "normalizeWarehouseStorageLocation");
function parseWarehouseStorageLocationCommand(text) {
  const normalized = normalizeScheduleDigits(text).normalize("NFKC").trim();
  const prefixed = normalized.match(/^(?:儲位|查儲位|查詢儲位)\s*(?:[+＋:：]\s*)?(.+)$/u);
  const candidate = normalizeWarehouseStorageLocation(prefixed?.[1] || normalized);
  return /^\d{2}-[LR]\d{2}-\d{2}(?:\/T\d{1,3})?$/u.test(candidate) ? candidate : null;
}
__name(parseWarehouseStorageLocationCommand, "parseWarehouseStorageLocationCommand");
function parseWarehouseStorageLocationCandidate(text) {
  const normalized = normalizeScheduleDigits(text).normalize("NFKC").trim();
  const prefixed = normalized.match(/^(?:儲位|查儲位|查詢儲位)\s*(?:[+＋:：]\s*)?(.+)$/u);
  const candidate = normalizeWarehouseStorageLocation(prefixed?.[1] || normalized);
  if (!candidate || /(?:HTTPS?:\/\/|WWW\.)/iu.test(candidate)) return null;
  return candidate;
}
__name(parseWarehouseStorageLocationCandidate, "parseWarehouseStorageLocationCandidate");
function parseWarehouseStorageLocationAvailabilityCommand(text) {
  const normalized = normalizeScheduleDigits(text).normalize("NFKC").trim();
  const directives = [
    { pattern: /^(.*?)\s*(?:不顯示|隱藏|排除)\s*無庫存(?:商品|品項)?$/u, includeUnavailable: false },
    { pattern: /^(.*?)\s*只\s*(?:看|顯示)?\s*有庫存(?:商品|品項)?$/u, includeUnavailable: false },
    { pattern: /^(.*?)\s+有庫存(?:商品|品項)?$/u, includeUnavailable: false },
    { pattern: /^(.*?)\s*(?:顯示|包含|含)\s*無庫存(?:商品|品項)?$/u, includeUnavailable: true }
  ];
  for (const directive of directives) {
    const match = normalized.match(directive.pattern);
    if (!match) continue;
    const location = parseWarehouseStorageLocationCandidate(match[1]);
    if (location) return { location, includeUnavailable: directive.includeUnavailable };
  }
  return null;
}
__name(parseWarehouseStorageLocationAvailabilityCommand, "parseWarehouseStorageLocationAvailabilityCommand");
function parseWarehouseLocationDetailCommand(text) {
  const normalized = normalizeScheduleDigits(text).replace(/\s+/g, " ").trim();
  const match = normalized.match(/^(?:完整儲位|儲位明細)\s*(?:[+＋:：]\s*)?([^\s]+)\s*$/u);
  return match ? parseWarehouseLocationCommand(String(match[1] || "")) : null;
}
__name(parseWarehouseLocationDetailCommand, "parseWarehouseLocationDetailCommand");
function isWarehousePositionDryRunCommand(text) {
  return /^改儲位(?:\s|$)/u.test(String(text || "").normalize("NFKC").trim());
}
__name(isWarehousePositionDryRunCommand, "isWarehousePositionDryRunCommand");
function isWarehousePositionPromptCommand(text) {
  return String(text || "").normalize("NFKC").trim() === "\u6539\u5132\u4F4D";
}
__name(isWarehousePositionPromptCommand, "isWarehousePositionPromptCommand");
function normalizeWarehousePosition(value) {
  const normalized = String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > 80 || /[\u0000-\u001f\u007f]/u.test(normalized)) return "";
  return /^[\p{L}\p{N}._/+#:()（）-]+(?: [\p{L}\p{N}._/+#:()（）-]+)*$/u.test(normalized) ? normalized : "";
}
__name(normalizeWarehousePosition, "normalizeWarehousePosition");
function parseWarehousePositionDryRunCommand(text) {
  const normalized = normalizeScheduleDigits(text).normalize("NFKC").replace(/\s+/g, " ").trim();
  const match = normalized.match(/^改儲位\s+([^\s]+)\s+(.+)$/u);
  if (!match) return null;
  const sku = parseWarehouseLocationCommand(match[1]);
  const newLocation = normalizeWarehousePosition(match[2]);
  return sku && newLocation ? { sku, newLocation } : null;
}
__name(parseWarehousePositionDryRunCommand, "parseWarehousePositionDryRunCommand");
function parseWarehousePositionWriteCommand(text) {
  const normalized = normalizeScheduleDigits(text).normalize("NFKC").replace(/\s+/gu, " ").trim();
  const match = normalized.match(/^改儲位\s+([A-Z][A-Z0-9._-]{1,79}-\d{2,})\s+(.+)$/iu);
  if (!match) return null;
  const itemUID = match[1].toUpperCase();
  const parent = itemUID.match(/^([A-Z][A-Z0-9._-]{1,79})-\d{2,}$/u)?.[1] || "";
  const newLocation = match[2].toUpperCase();
  if (!parent || newLocation.length > 100 || !/[\p{L}\p{N}]/u.test(newLocation)) return null;
  if (!/^[\p{L}\p{N}._/ -]+$/u.test(newLocation)) return null;
  return { goodId: parent, itemUID, newLocation };
}
__name(parseWarehousePositionWriteCommand, "parseWarehousePositionWriteCommand");
function warehousePositionBatchTarget(goodId, itemUIDs) {
  if (typeof goodId !== "string" || !Array.isArray(itemUIDs) || itemUIDs.length < 1 || itemUIDs.length > warehousePositionAllVariantLimit) return null;
  const parent = goodId.trim().toUpperCase();
  const commands = itemUIDs.map((uid) => typeof uid === "string" ? parseWarehousePositionWriteCommand(`\u6539\u5132\u4F4D ${uid} TEST`) : null);
  if (commands.some((command) => !command || command.goodId !== parent)) return null;
  const ids = commands.map((command) => command.itemUID);
  return new Set(ids).size === ids.length ? { goodId: parent, itemUIDs: ids } : null;
}
__name(warehousePositionBatchTarget, "warehousePositionBatchTarget");
function warehousePositionBatchRowsValid(items, target, newLocation, expectedOldLocations = null) {
  if (!target || !Array.isArray(items) || items.length !== target.itemUIDs.length) return false;
  if (new Set(items.map((item) => item?.itemUID)).size !== items.length) return false;
  return items.every((item) => target.itemUIDs.includes(item?.itemUID) && typeof item.oldLocation === "string" && item.oldLocation.length <= 500 && item.newLocation === newLocation && typeof item.changed === "boolean" && item.changed === (item.oldLocation !== newLocation) && (!expectedOldLocations || expectedOldLocations[item.itemUID] === item.oldLocation));
}
__name(warehousePositionBatchRowsValid, "warehousePositionBatchRowsValid");
function warehousePositionBatchResultValid(result, command, expectedOldLocations = null) {
  const target = warehousePositionBatchTarget(command.goodId, command.itemUIDs);
  return Boolean(target && result?.scope === "all_variants" && result.goodId === target.goodId && result.warehouseId === 1 && result.targetCount === target.itemUIDs.length && warehousePositionBatchRowsValid(result.items, target, command.newLocation, expectedOldLocations) && result.changedCount > 0 && result.changedCount === result.items.filter((item) => item.changed).length && /^[0-9a-f]{64}$/u.test(String(result.beforeProductSha256 || "")) && result.backupRecorded === true && result.eventRecorded === true);
}
__name(warehousePositionBatchResultValid, "warehousePositionBatchResultValid");
function parseWarehousePositionDryRunStartCommand(text) {
  const normalized = normalizeScheduleDigits(text).normalize("NFKC").replace(/\s+/g, " ").trim();
  const match = normalized.match(/^改儲位\s+([^\s]+)$/u);
  return match ? parseWarehouseLocationCommand(match[1]) : null;
}
__name(parseWarehousePositionDryRunStartCommand, "parseWarehousePositionDryRunStartCommand");
function warehousePositionWizardPostback(state = {}) {
  const params = new URLSearchParams({
    action: warehousePositionWizardAction,
    step: String(state.step || "warehouse"),
    sku: String(state.sku || "")
  });
  for (const key of ["variant", "warehouse", "zone", "side", "shelf", "level", "tray", "page"]) {
    if (state[key]) params.set(key, String(state[key]));
  }
  return params.toString();
}
__name(warehousePositionWizardPostback, "warehousePositionWizardPostback");
function warehousePositionWizardQuickReplyItem(label, state, displayText = label) {
  return {
    type: "action",
    action: {
      type: "postback",
      label,
      data: warehousePositionWizardPostback(state),
      displayText
    }
  };
}
__name(warehousePositionWizardQuickReplyItem, "warehousePositionWizardQuickReplyItem");
function warehousePositionIdentifiedVariants(item) {
  const variants = Array.isArray(item?.variants) ? item.variants : [];
  const seen = /* @__PURE__ */ new Set();
  const identified = [];
  for (const variant of variants) {
    const barcode = normalizeWarehouseSku(variant?.barcode);
    if (!/^[A-Z0-9._-]{2,80}$/u.test(barcode) || seen.has(barcode)) return [];
    seen.add(barcode);
    identified.push({ barcode, variant });
  }
  return identified;
}
__name(warehousePositionIdentifiedVariants, "warehousePositionIdentifiedVariants");
function warehousePositionVariantButtonLabel(sku, barcode) {
  const normalizedSku = normalizeWarehouseSku(sku);
  const normalizedBarcode = normalizeWarehouseSku(barcode);
  const suffix = normalizedBarcode.startsWith(normalizedSku) ? normalizedBarcode.slice(normalizedSku.length) : "";
  return (suffix && suffix.length <= 20 ? suffix : normalizedBarcode).slice(0, 20);
}
__name(warehousePositionVariantButtonLabel, "warehousePositionVariantButtonLabel");
function createWarehousePositionWizardMessage(state = {}, notice = "", item = null) {
  const sku = parseWarehouseLocationCommand(state.sku);
  if (!sku) return null;
  const step = String(state.step || "warehouse");
  const base = {
    sku,
    variant: state.variant,
    warehouse: state.warehouse,
    zone: state.zone,
    side: state.side,
    shelf: state.shelf,
    level: state.level
  };
  let prompt = "";
  let choices = [];
  if (step === "variant") {
    const variants = warehousePositionIdentifiedVariants(item);
    if (variants.length < 2) return null;
    const requestedPage = Math.max(1, Number.parseInt(state.page, 10) || 1);
    const pageCount = Math.ceil(variants.length / warehousePositionVariantPageSize);
    const page = Math.min(requestedPage, pageCount);
    const pageVariants = variants.slice(
      (page - 1) * warehousePositionVariantPageSize,
      page * warehousePositionVariantPageSize
    );
    prompt = `\u8CA8\u865F\uFF1A${sku}
\u8ACB\u5148\u9078\u64C7\u5B50\u8CA8\u865F\uFF08${page}/${pageCount}\uFF09\uFF1A`;
    if (variants.length > warehousePositionAllVariantLimit) prompt += `
\u6B64\u5546\u54C1\u5171 ${variants.length} \u7B46\uFF0C\u8D85\u904E\u5168\u90E8\u5BEB\u5165\u4E0A\u9650 30 \u7B46\uFF0C\u8ACB\u9078\u55AE\u4E00\u5B50\u8CA8\u865F\u3002`;
    choices = pageVariants.map(({ barcode }) => warehousePositionWizardQuickReplyItem(
      warehousePositionVariantButtonLabel(sku, barcode),
      { step: "warehouse", sku, variant: barcode },
      barcode
    ));
    if (variants.length <= warehousePositionAllVariantLimit) {
      choices.push(warehousePositionWizardQuickReplyItem("\u5168\u90E8", { step: "warehouse", sku, variant: "*" }, `\u5168\u90E8 ${variants.length} \u500B\u5B50\u8CA8\u865F`));
    }
    if (page > 1) {
      choices.push(warehousePositionWizardQuickReplyItem("\u4E0A\u4E00\u9801", { step: "variant", sku, page: page - 1 }));
    }
    if (page < pageCount) {
      choices.push(warehousePositionWizardQuickReplyItem("\u4E0B\u4E00\u9801", { step: "variant", sku, page: page + 1 }));
    }
  } else if (step === "warehouse") {
    prompt = `\u8CA8\u865F\uFF1A${sku}
\u8ACB\u9078\u64C7\u5009\u5EAB\uFF0C\u6216\u9EDE\u300C\u81EA\u8A02\u300D\u8F38\u5165\u5132\u4F4D\uFF1A`;
    choices = [
      warehousePositionWizardQuickReplyItem("A\u5009", { ...base, step: "zone", warehouse: "A" }),
      warehousePositionWizardQuickReplyItem("B\u5009", { ...base, step: "zone", warehouse: "B" }),
      warehousePositionWizardQuickReplyItem("\u81EA\u8A02", { step: "custom", sku, variant: state.variant })
    ];
    if (state.variant) {
      choices.push(warehousePositionWizardQuickReplyItem("\u91CD\u9078\u5B50\u8CA8\u865F", { step: "variant", sku, page: 1 }));
    }
  } else if (step === "zone" && state.warehouse === "B") {
    prompt = `\u8CA8\u865F\uFF1A${sku}
\u5009\u5EAB\uFF1AB\u5009
\u8ACB\u9078\u64C7\u5340\u865F\uFF1A`;
    choices = warehousePositionWizardOptions.zones.map(
      (zone) => warehousePositionWizardQuickReplyItem(zone, { ...base, step: "side", warehouse: "B", zone })
    );
    choices.push(warehousePositionWizardQuickReplyItem("\u4E0A\u4E00\u6B65", {
      step: "warehouse",
      sku,
      variant: state.variant
    }, "\u91CD\u65B0\u9078\u5009\u5EAB"));
  } else if (step === "side" && state.warehouse === "B" && warehousePositionWizardOptions.zones.includes(state.zone)) {
    prompt = `\u8CA8\u865F\uFF1A${sku}
B\u5009\u30FB\u5340\u865F ${state.zone}
\u8ACB\u9078\u64C7\u5C64\u67B6\u65B9\u5411\uFF1A`;
    choices = [
      warehousePositionWizardQuickReplyItem("\u5DE6\u908A L", { ...base, step: "shelf", side: "L" }),
      warehousePositionWizardQuickReplyItem("\u53F3\u908A R", { ...base, step: "shelf", side: "R" }),
      warehousePositionWizardQuickReplyItem("\u4E0A\u4E00\u6B65", {
        step: "zone",
        sku,
        variant: state.variant,
        warehouse: "B"
      }, "\u91CD\u9078\u5340\u865F")
    ];
  } else if (step === "shelf" && state.warehouse === "B" && warehousePositionWizardOptions.zones.includes(state.zone) && warehousePositionWizardOptions.sides.includes(state.side)) {
    prompt = `\u8CA8\u865F\uFF1A${sku}
B\u5009\u30FB${state.zone}\u5340\u30FB${state.side === "R" ? "\u53F3\u908A" : "\u5DE6\u908A"}
\u8ACB\u9078\u64C7\u7B2C\u5E7E\u500B\u5C64\u67B6\uFF1A`;
    choices = warehousePositionWizardOptions.shelves.map(
      (shelf) => warehousePositionWizardQuickReplyItem(`${state.side}${shelf}`, { ...base, step: "level", shelf })
    );
    choices.push(warehousePositionWizardQuickReplyItem("\u4E0A\u4E00\u6B65", {
      step: "side",
      sku,
      variant: state.variant,
      warehouse: "B",
      zone: state.zone
    }, "\u91CD\u9078\u5DE6\u53F3"));
  } else if (step === "level" && state.warehouse === "B" && warehousePositionWizardOptions.zones.includes(state.zone) && warehousePositionWizardOptions.sides.includes(state.side) && warehousePositionWizardOptions.shelves.includes(state.shelf)) {
    prompt = `\u8CA8\u865F\uFF1A${sku}
\u5DF2\u9078\uFF1A${state.zone}-${state.side}${state.shelf}
\u8ACB\u9078\u64C7\u5C64\u4F4D\uFF1A`;
    choices = warehousePositionWizardOptions.levels.map(
      (level) => warehousePositionWizardQuickReplyItem(level, { ...base, step: "tray", level })
    );
    choices.push(warehousePositionWizardQuickReplyItem("\u4E0A\u4E00\u6B65", {
      step: "shelf",
      sku,
      variant: state.variant,
      warehouse: "B",
      zone: state.zone,
      side: state.side
    }, "\u91CD\u9078\u5C64\u67B6"));
  } else if (step === "tray" && state.warehouse === "B" && warehousePositionWizardOptions.zones.includes(state.zone) && warehousePositionWizardOptions.sides.includes(state.side) && warehousePositionWizardOptions.shelves.includes(state.shelf) && warehousePositionWizardOptions.levels.includes(state.level)) {
    prompt = `\u8CA8\u865F\uFF1A${sku}
\u5DF2\u9078\uFF1A${state.zone}-${state.side}${state.shelf}-${state.level}
\u8ACB\u9078\u64C7\u7BB1\u4F4D\uFF1A`;
    choices = warehousePositionWizardOptions.trays.map((tray) => {
      const label = tray === "NONE" ? "\u7121 T" : tray;
      return warehousePositionWizardQuickReplyItem(label, { ...base, step: "preview", tray });
    });
    choices.push(warehousePositionWizardQuickReplyItem("\u4E0A\u4E00\u6B65", {
      step: "level",
      sku,
      variant: state.variant,
      warehouse: "B",
      zone: state.zone,
      side: state.side,
      shelf: state.shelf
    }, "\u91CD\u9078\u5C64\u4F4D"));
  } else {
    return null;
  }
  choices.push(warehousePositionWizardQuickReplyItem("\u53D6\u6D88", { step: "cancel", sku }, "\u53D6\u6D88\u6539\u5132\u4F4D\u6F14\u7DF4"));
  return {
    type: "text",
    text: `${notice ? `${notice}

` : ""}\u{1F9EA} \u5132\u4F4D\u4FEE\u6539
${prompt}

A\uFF0FB \u5009\u9078\u9805\u53EA\u505A\u9810\u89BD\uFF1B\u300C\u81EA\u8A02\u300D\u53EF\u624B\u6253\u5132\u4F4D\uFF0C\u53E6\u7D93\u5099\u4EFD\u8207\u78BA\u8A8D\u5F8C\u624D\u6703\u5BEB\u5165 ERP\u3002`,
    quickReply: { items: choices }
  };
}
__name(createWarehousePositionWizardMessage, "createWarehousePositionWizardMessage");
function warehousePositionWizardState(params) {
  const sku = parseWarehouseLocationCommand(params.get("sku"));
  if (!sku || params.get("action") !== warehousePositionWizardAction) return null;
  const rawVariant = String(params.get("variant") || "").normalize("NFKC").trim().toUpperCase();
  if (rawVariant && rawVariant !== "*" && !/^[A-Z0-9._-]{2,80}$/u.test(rawVariant)) return null;
  return {
    step: String(params.get("step") || ""),
    sku,
    variant: rawVariant,
    warehouse: String(params.get("warehouse") || ""),
    zone: String(params.get("zone") || ""),
    side: String(params.get("side") || ""),
    shelf: String(params.get("shelf") || ""),
    level: String(params.get("level") || ""),
    tray: String(params.get("tray") || ""),
    page: String(params.get("page") || "")
  };
}
__name(warehousePositionWizardState, "warehousePositionWizardState");
function warehousePositionWizardLocation(state) {
  if (state?.warehouse !== "B" || !warehousePositionWizardOptions.zones.includes(state.zone) || !warehousePositionWizardOptions.sides.includes(state.side) || !warehousePositionWizardOptions.shelves.includes(state.shelf) || !warehousePositionWizardOptions.levels.includes(state.level) || !warehousePositionWizardOptions.trays.includes(state.tray)) return "";
  const traySuffix = state.tray === "NONE" ? "" : `/${state.tray}`;
  return `${state.zone}-${state.side}${state.shelf}-${state.level}${traySuffix}`;
}
__name(warehousePositionWizardLocation, "warehousePositionWizardLocation");
function normalizeWarehouseSearchText(value) {
  return String(value || "").normalize("NFKC").toUpperCase().replace(/[\s\p{P}\p{S}]+/gu, "").slice(0, 160);
}
__name(normalizeWarehouseSearchText, "normalizeWarehouseSearchText");
function parseWarehouseSearchCommand(text) {
  const normalized = normalizeScheduleDigits(text).replace(/\s+/g, " ").trim();
  if (!normalized || /https?:\/\/|shopee/iu.test(normalized)) return null;
  const prefixed = normalized.match(/^(?:儲位|查詢?|搜(?:尋)?)\s*(?:[+＋:：]\s*)?(.+)$/iu);
  const keyword = String(prefixed?.[1] || normalized).trim().slice(0, 80);
  const searchable = normalizeWarehouseSearchText(keyword);
  if (!searchable || parseWarehouseLocationCommand(keyword)) return null;
  return keyword;
}
__name(parseWarehouseSearchCommand, "parseWarehouseSearchCommand");
function warehouseSearchScore(item, keyword) {
  const query = normalizeWarehouseSearchText(keyword);
  const sku = normalizeWarehouseSearchText(item?.sku);
  const name = normalizeWarehouseSearchText(item?.name);
  if (!query || !sku.includes(query) && !name.includes(query)) return null;
  if (sku === query) return 0;
  if (name === query) return 1;
  if (name.startsWith(query)) return 2;
  if (name.includes(query)) return 3;
  return 4;
}
__name(warehouseSearchScore, "warehouseSearchScore");
function lineHelpText() {
  return [
    "\u{1F4D6} \u6587\u6848\u5C0F\u5E6B\u624B\u6307\u4EE4\u8AAA\u660E",
    "",
    "\u3010\u67E5\u770B\u8AAA\u660E\u3011",
    "@\u6587\u6848\u5C0F\u5E6B\u624B",
    "\u986F\u793A\u9019\u4EFD\u5B8C\u6574\u6307\u4EE4\u6E05\u55AE\u3002",
    "",
    "\u3010\u55AE\u652F\u5546\u54C1\u6587\u6848\u3011",
    "\u7FA4\u7D44\uFF1A@\u6587\u6848\u5C0F\u5E6B\u624B \u5F8C\uFF0C10 \u79D2\u5167\u8CBC\u8766\u76AE\u9023\u7D50\uFF1B\u4E5F\u53EF\u4EE5\u5728\u540C\u4E00\u5247\u8A0A\u606F\u76F4\u63A5 @\u4E26\u8CBC\u9023\u7D50\u3002",
    "\u79C1\u8A0A\uFF1A\u76F4\u63A5\u8CBC\u8766\u76AE\u9023\u7D50\u3002",
    "\u529F\u80FD\uFF1A\u7522\u751F 40 \u79D2\u6A19\u6E96\u7248\u6587\u6848\uFF0C\u62CD\u651D\u91CD\u9EDE\u7531 AI \u81EA\u52D5\u5224\u65B7\u3002",
    "",
    "\u3010\u5EE3\u544A\u5F71\u7247\u6392\u7A0B\u3011",
    "\u6240\u6709\u7FA4\u7D44\u8207\u79C1\u8A0A\u5171\u7528\u540C\u4E00\u4EFD\u5F85\u62CD\u3001\u5DF2\u62CD\u5B8C\u6E05\u55AE\u3002",
    "\u5EE3\u544A\u5F71\u7247\u6392\u7A0B\uFF0B\u5546\u54C1\u9023\u7D50",
    "\u4E00\u6B21\u65B0\u589E\u4E00\u500B\u6216\u591A\u500B\u8766\u76AE\u5546\u54C1\u5230\u5F85\u62CD\u6E05\u55AE\u3002",
    "",
    "\u8981\u62CD\u4EC0\u9EBC",
    "\u5217\u51FA\u76EE\u524D\u6240\u6709\u5F85\u62CD\u5546\u54C1\u8207\u7DE8\u865F\u3002",
    "",
    "1\u30012\u30013\u2026",
    "\u76F4\u63A5\u8B80\u53D6\u8A72\u7DE8\u865F\u5DF2\u5132\u5B58\u7684\u5546\u54C1\u7DB2\u5740\u4E26\u7522\u751F\u6587\u6848\uFF0C\u4E0D\u5FC5\u91CD\u8CBC\u9023\u7D50\u3002",
    "",
    "\u5B8C\u62101\u3001\u5B8C\u62102\u2026",
    "\u628A\u5F85\u62CD\u6E05\u55AE\u4E2D\u7684\u8A72\u7DE8\u865F\u79FB\u5230\u5DF2\u62CD\u5B8C\u3002",
    "",
    "\u5DF2\u62CD\u5B8C",
    "\u5217\u51FA\u5B8C\u6210\u6642\u9593\u3001\u62CD\u651D\u54E1\u5DE5\u3001\u5546\u54C1\u8207\u5DF2\u62CD\u5B8C\u7DE8\u865F\u3002",
    "",
    "\u53D6\u6D88\u5B8C\u62101\u3001\u53D6\u6D88\u5B8C\u62102\u2026",
    "\u4F9D\u7167\u300E\u5DF2\u62CD\u5B8C\u300F\u6E05\u55AE\u7DE8\u865F\uFF0C\u5C07\u8AA4\u6A19\u5B8C\u6210\u7684\u5546\u54C1\u9000\u56DE\u5F85\u62CD\u6E05\u55AE\u3002",
    "",
    "\u3010\u67E5\u8A62 ERP \u8A02\u55AE\u3011",
    "\u50C5\u9650\u6388\u6B0A\u79C1\u8A0A\uFF1A\u76F4\u63A5\u8F38\u5165\u51FA\u8CA8\u55AE\u53F3\u4E0A\u89D2\u7DE8\u865F\uFF0C\u4F8B\u5982\uFF1A0350000-10747554\u3002",
    "\u4E5F\u53EF\u4EE5\u8F38\u5165\u300C\u8A02\u55AE 0350000-10747554\u300D\u3002",
    "\u56DE\u8986\u72C0\u614B\u3001\u5E73\u53F0\u55AE\u865F\u3001\u54C1\u9805\u3001\u6578\u91CF\u3001\u55AE\u50F9\u8207\u4EA4\u6613\u7E3D\u8A08\uFF1B\u4E0D\u986F\u793A\u59D3\u540D\u3001\u96FB\u8A71\u3001\u5730\u5740\u3002",
    "",
    "\u3010\u67E5\u8A62 ERP \u4E3B\u5009\u5132\u4F4D\u3011",
    "\u76F4\u63A5\u8F38\u5165\u8CA8\u865F\uFF0C\u4F8B\u5982\uFF1AA12345",
    "\u539F\u672C\u7684\u300C\u5132\u4F4D A12345\u300D\u4E5F\u53EF\u4EE5\u4F7F\u7528\u3002",
    "\u56DE\u8986\u5546\u54C1\u5716\u7247\u3001\u8CA8\u865F\u3001\u5546\u54C1\u540D\u7A31\u3001\u4E3B\u8981\u5132\u4F4D\u8207\u4E3B\u5009\u53EF\u7528\u5EAB\u5B58\u3002",
    "\u9EDE\u5361\u7247\u4E2D\u7684\u300C\u5B8C\u6574\u5132\u4F4D\u300D\u53EF\u67E5\u770B\u6240\u6709\u898F\u683C\u660E\u7D30\u3002",
    "",
    "\u79C1\u8A0A\u76F4\u63A5\u8F38\u5165\u5B8C\u6574\u5132\u4F4D\uFF0C\u4F8B\u5982\uFF1A04-R05-02/T5\u300105-R04-03\u3002",
    "\u4E5F\u53EF\u4EE5\u8F38\u5165\u300C\u5132\u4F4D 04-R05-02/T5\u300D\u3002",
    "\u56DE\u8986\u8A72\u5132\u4F4D\u6240\u6709\u54C1\u9805\uFF0C\u6BCF\u9801 10 \u7B46\uFF1B\u5EAB\u5B58 0 \u6216\u8CA0\u6578\u4ECD\u6703\u5217\u51FA\u4E26\u6A19\u793A\u3002",
    "",
    "\u76F4\u63A5\u8F38\u5165\u5546\u54C1\u95DC\u9375\u5B57\uFF0C\u4F8B\u5982\uFF1A\u6D17\u8863\u888B",
    "\u300C\u67E5 \u6D17\u8863\u888B\u300D\u6216\u300C\u5132\u4F4D \u6D17\u8863\u888B\u300D\u4E5F\u53EF\u4EE5\u4F7F\u7528\u3002",
    "\u56DE\u8986\u76F8\u95DC\u5546\u54C1\u5716\u7247\u3001\u8CA8\u865F\u3001\u4E3B\u8981\u5132\u4F4D\u8207\u5EAB\u5B58\uFF1B\u9EDE\u300E\u5B8C\u6574\u5132\u4F4D\u300F\u53EF\u67E5\u770B\u6240\u6709\u898F\u683C\u3002",
    "",
    "\u3010\u5132\u4F4D\u4FEE\u6539\u6F14\u7DF4\u3011",
    "\u529F\u80FD\u9078\u55AE\uFF1A\u9EDE\u300E\u{1F4E6} \u6539\u5132\u4F4D\u300F\u5F8C\uFF0C\u5728 8 \u79D2\u5167\u56DE\u8986\u8CA8\u865F\u3002",
    "\u50C5\u9650\u79C1\u8A0A\uFF1A\u6539\u5132\u4F4D A12345",
    "\u63A5\u8457\u7528\u6309\u9215\u9078\u64C7 B\u5009\u3001\u5340\u865F\u3001\u5DE6\u53F3\u5C64\u67B6\u3001\u5C64\u4F4D\u8207\u7BB1\u4F4D\uFF1BA\u5009\u6309\u9215\u5148\u4FDD\u7559\u4F46\u5C1A\u672A\u958B\u653E\u3002",
    "A\uFF0FB \u5009\u9078\u9805\u53EA\u8B80\u53D6\u4E3B\u5009\u5FEB\u7167\u4E26\u986F\u793A\u4FEE\u6539\u9810\u89BD\uFF0C\u4E0D\u6703\u5BEB\u5165 ERP\u3002",
    "\u300C\u81EA\u8A02\u300D\u53EF\u5728 2 \u5206\u9418\u5167\u624B\u6253\u672A\u5217\u51FA\u7684\u5132\u4F4D\uFF1B\u50C5\u9650\u5DF2\u6388\u6B0A\u5E33\u865F\uFF0C\u5099\u4EFD\u5F8C\u4ECD\u8981\u6309\u78BA\u8A8D\u624D\u6703\u5BEB\u5165\u3002",
    "\u591A\u898F\u683C\u5546\u54C1\u53EF\u9078\u55AE\u4E00\u5B50\u8CA8\u865F\uFF0C\u6216\u9078\u300E\u5168\u90E8\u300F\u2192\u300E\u81EA\u8A02\u300F\u5C07\u540C\u4E00\u4E3B\u8CA8\u865F\u5168\u90E8\u5B50\u8CA8\u865F\u6539\u70BA\u76F8\u540C\u5132\u4F4D\uFF0C\u4E00\u6B21\u4E0A\u9650 30 \u7B46\u3002",
    "\u5B50\u8CA8\u865F\u7A7A\u767D\u3001\u91CD\u8907\u6216\u8CC7\u6599\u5DF2\u66F4\u65B0\u6642\u6703\u5B89\u5168\u505C\u6B62\uFF0C\u4E0D\u6703\u81EA\u884C\u731C\u6E2C\u3002",
    "",
    "\u3010ERP \u5132\u4F4D\u5BE6\u969B\u5BEB\u5165\u3011",
    "\u50C5\u9650\u53E6\u884C\u6838\u51C6\u7684 @059hdfyo \u79C1\u8A0A\u5E33\u865F\uFF1A\u6539\u5132\u4F4D <\u5B8C\u6574\u5B50\u8CA8\u865F> <\u65B0\u5132\u4F4D>",
    "\u5FC5\u9808\u8F38\u5165\u5B8C\u6574\u5B50\u8CA8\u865F\uFF1B\u6A5F\u5668\u5148\u8B80\u53D6 ERP \u5373\u6642\u8CC7\u6599\u4E26\u5099\u4EFD\uFF0C\u56DE\u8986\u78BA\u8A8D\u6309\u9215\u3002",
    "\u6309\u78BA\u8A8D\u5F8C\u624D\u5BEB\u5165\u55AE\u4E00\u4E3B\u5009\u5132\u4F4D\uFF0C\u4E26\u56DE\u8B80\u6AA2\u67E5\uFF1B\u6309\u9215 2 \u5206\u9418\u904E\u671F\u4E14\u53EA\u80FD\u4F7F\u7528\u4E00\u6B21\u3002",
    "\u672A\u6838\u51C6\u7684\u5E33\u865F\u53EF\u50B3\u300C\u5132\u4F4D\u5BEB\u5165\u6388\u6B0A\u78BC\u300D\u7D66\u7BA1\u7406\u8005\u8A2D\u5B9A\u767D\u540D\u55AE\uFF1B\u6B64\u6307\u4EE4\u4E0D\u6703\u5BEB\u5165 ERP\u3002",
    "",
    "\u6392\u7A0B\u76F8\u95DC\u6307\u4EE4\u4E0D\u9700\u8981 @\u6587\u6848\u5C0F\u5E6B\u624B\u3002",
    "\u8CA8\u865F\u8207\u5546\u54C1\u95DC\u9375\u5B57\u67E5\u8A62\u4E0D\u9700\u8981 @\u6587\u6848\u5C0F\u5E6B\u624B\uFF1B\u5B8C\u6574\u5132\u4F4D\u53CD\u67E5\u53EA\u9650\u79C1\u8A0A\u3002"
  ].join("\n");
}
__name(lineHelpText, "lineHelpText");
function lineHelpQuickReplyItems() {
  return [
    { label: "\u{1F50D} \u67E5\u5546\u54C1", text: "\u67E5" },
    { label: "\u{1F4CD} \u67E5\u5132\u4F4D", text: "\u5132\u4F4D" },
    { label: "\u{1F3AC} \u8981\u62CD\u4EC0\u9EBC", text: "\u8981\u62CD\u4EC0\u9EBC" },
    { label: "\u{1F4E6} \u6539\u5132\u4F4D", text: "\u6539\u5132\u4F4D" },
    { label: "\u2705 \u5DF2\u62CD\u5B8C", text: "\u5DF2\u62CD\u5B8C" },
    { label: "\u{1F4DD} \u7522\u751F\u6587\u6848", text: "\u7522\u751F\u6587\u6848" }
  ].map((item) => ({
    type: "action",
    action: {
      type: "message",
      label: item.label,
      text: item.text
    }
  }));
}
__name(lineHelpQuickReplyItems, "lineHelpQuickReplyItems");
function createLineHelpMessage() {
  return {
    type: "text",
    text: lineHelpText().slice(0, 5e3),
    quickReply: { items: lineHelpQuickReplyItems() }
  };
}
__name(createLineHelpMessage, "createLineHelpMessage");
function normalizeWarehouseLocationItem(rawItem) {
  const sku = String(rawItem?.sku || "").replace(/\s+/g, "").trim().toUpperCase().slice(0, 80);
  if (!sku) return null;
  const variants = [];
  for (const rawVariant of Array.isArray(rawItem?.variants) ? rawItem.variants.slice(0, 120) : []) {
    const location = String(rawVariant?.location || "").replace(/\s+/g, " ").trim().slice(0, 160);
    const style = String(rawVariant?.style || "").replace(/\s+/g, " ").trim().slice(0, 100);
    const size = String(rawVariant?.size || "").replace(/\s+/g, " ").trim().slice(0, 100);
    const barcode = String(rawVariant?.barcode || "").replace(/\s+/g, "").trim().slice(0, 100);
    variants.push({
      location,
      style,
      size,
      barcode,
      available: Math.trunc(Number(rawVariant?.available) || 0)
    });
  }
  const item = {
    sku,
    name: String(rawItem?.name || "ERP \u5546\u54C1").replace(/\s+/g, " ").trim().slice(0, 200) || "ERP \u5546\u54C1",
    available: Math.trunc(Number(rawItem?.available) || 0),
    priceMin: normalizeWarehouseMoney(rawItem?.priceMin),
    priceMax: normalizeWarehouseMoney(rawItem?.priceMax),
    variants
  };
  if (isNasLocalImageSku(sku)) {
    item.costMin = normalizeWarehouseUnitCost(rawItem?.costMin);
    item.costMax = normalizeWarehouseUnitCost(rawItem?.costMax);
  }
  return item;
}
__name(normalizeWarehouseLocationItem, "normalizeWarehouseLocationItem");
function normalizeWarehouseMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 1e4) / 1e4 : 0;
}
__name(normalizeWarehouseMoney, "normalizeWarehouseMoney");
function normalizeWarehouseUnitCost(value) {
  return normalizeWarehouseMoney(value);
}
__name(normalizeWarehouseUnitCost, "normalizeWarehouseUnitCost");
function formatWarehouseMoney(value) {
  const rounded = Math.round(normalizeWarehouseMoney(value) * 100) / 100;
  return Number.isInteger(rounded) ? `NT$${rounded}` : `NT$${rounded.toFixed(2)}`;
}
__name(formatWarehouseMoney, "formatWarehouseMoney");
function formatWarehouseUnitCost(value) {
  return formatWarehouseMoney(value);
}
__name(formatWarehouseUnitCost, "formatWarehouseUnitCost");
function normalizeErpOrderAlias(value) {
  return String(value || "").normalize("NFKC").toUpperCase().replace(/\s+/g, "").replace(/[‐‑‒–—―]/g, "-").slice(0, 160);
}
__name(normalizeErpOrderAlias, "normalizeErpOrderAlias");
function erpOrderSkuKeys(value) {
  const sku = normalizeWarehouseSku(value);
  const isSku = /^(?=[A-Z0-9._-]{2,80}$)(?=[A-Z0-9._-]*[A-Z])(?=[A-Z0-9._-]*\d)[A-Z0-9._-]+$/u.test(sku);
  if (!isSku) return [];
  const keys = /* @__PURE__ */ new Set([sku]);
  const parent = sku.match(/^([A-Z]+\d+)[._-].+$/u)?.[1] || "";
  if (parent) keys.add(parent);
  return [...keys];
}
__name(erpOrderSkuKeys, "erpOrderSkuKeys");
function normalizeErpOrderSkuStatusRequest(value) {
  const sku = erpOrderSkuKeys(value?.sku)?.[0] || "";
  const status = String(value?.status || "").normalize("NFKC").replace(/\s+/gu, "").trim();
  return {
    sku,
    status: erpOrderSkuStatuses.includes(status) ? status : "",
    page: Math.max(1, Math.trunc(Number(value?.page) || 1))
  };
}
__name(normalizeErpOrderSkuStatusRequest, "normalizeErpOrderSkuStatusRequest");
function erpOrderSkuStatusIndexKey(status, sku) {
  return `${status}${sku}`;
}
__name(erpOrderSkuStatusIndexKey, "erpOrderSkuStatusIndexKey");
function erpOrderMatchesSku(item, sku) {
  return erpOrderSkuKeys(item?.sku).includes(sku);
}
__name(erpOrderMatchesSku, "erpOrderMatchesSku");
function erpOrderSkuStatusRows(order, sku) {
  const base = {
    transactionNo: order.transactionNo,
    platform: order.platform,
    status: order.status,
    createdAt: order.createdAt
  };
  const printableOrders = Array.isArray(order?.printableOrders) ? order.printableOrders : [];
  const rows = [];
  for (const printable of printableOrders) {
    const matchedItems2 = collapseErpOrderItems(printable?.items).filter((item) => erpOrderMatchesSku(item, sku));
    if (!matchedItems2.length) continue;
    rows.push({
      ...base,
      number: normalizeErpOrderAlias(printable?.number) || order.transactionNo,
      matchedItems: matchedItems2,
      matchedQuantity: matchedItems2.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0),
      detailsIncomplete: Boolean(printable?.itemsTruncated || order?.printableOrdersTruncated)
    });
  }
  if (rows.length) return rows;
  const matchedItems = collapseErpOrderItems(order?.items).filter((item) => erpOrderMatchesSku(item, sku));
  if (!matchedItems.length) return [];
  const printableNumbers = erpOrderPrintableNumbers(order);
  return [{
    ...base,
    number: printableNumbers.length === 1 ? printableNumbers[0] : order.transactionNo,
    matchedItems,
    matchedQuantity: matchedItems.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0),
    detailsIncomplete: Boolean(order?.itemsTruncated || order?.printableOrdersTruncated || printableNumbers.length > 1)
  }];
}
__name(erpOrderSkuStatusRows, "erpOrderSkuStatusRows");
function erpOrderLookupCandidates(value) {
  const normalized = normalizeErpOrderAlias(value);
  if (!normalized) return [];
  if (/^\d{4,10}-\d{6,12}$/.test(normalized)) return [normalized];
  const candidates = /* @__PURE__ */ new Set([normalized]);
  if (/^\d{12,24}$/.test(normalized)) {
    candidates.add(normalized.slice(-8));
  }
  return [...candidates];
}
__name(erpOrderLookupCandidates, "erpOrderLookupCandidates");
function collectErpOrderAliases(values) {
  const aliases = [];
  const seen = /* @__PURE__ */ new Set();
  for (const value of values) {
    for (const alias of erpOrderLookupCandidates(value)) {
      if (!alias || seen.has(alias)) continue;
      if (aliases.length >= erpOrderMaxAliases) {
        return { aliases, limitExceeded: true };
      }
      seen.add(alias);
      aliases.push(alias);
    }
  }
  return { aliases, limitExceeded: false };
}
__name(collectErpOrderAliases, "collectErpOrderAliases");
function compareErpOrderAliases(left, right) {
  return String(left || "").localeCompare(String(right || ""), "en", {
    numeric: true,
    sensitivity: "base"
  });
}
__name(compareErpOrderAliases, "compareErpOrderAliases");
function parseLineOrderLookupRequest(text) {
  let normalized = normalizeScheduleDigits(text).normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  let page = 1;
  const pageMatch = normalized.match(/\s+第\s*(\d{1,4})\s*頁$/u);
  if (pageMatch) {
    page = Math.max(1, Number.parseInt(pageMatch[1], 10) || 1);
    normalized = normalized.slice(0, pageMatch.index).trim();
  }
  const explicitOrder = /^訂單(?:編號)?(?:\s*[+＋:：]\s*|\s+)/u.test(normalized);
  if (explicitOrder) {
    normalized = normalized.replace(/^訂單(?:編號)?(?:\s*[+＋:：]\s*|\s+)/u, "").trim();
  }
  let mode = "auto";
  if (/^全部(?:\s*[+＋:：]\s*|\s+)/u.test(normalized)) {
    mode = "all";
    normalized = normalized.replace(/^全部(?:\s*[+＋:：]\s*|\s+)/u, "").trim();
  }
  const query = normalizeErpOrderAlias(normalized);
  if (!query) return null;
  const explicitLookup = explicitOrder || mode === "all";
  const isPrintable = /^\d{4,10}-\d{6,12}$/u.test(query);
  const isTransaction = /^\d{7,12}$/u.test(query);
  const isExplicitAlias = explicitLookup && /^[A-Z0-9-]{6,160}$/u.test(query);
  if (!isPrintable && !isTransaction && !isExplicitAlias) return null;
  return { query, mode, page };
}
__name(parseLineOrderLookupRequest, "parseLineOrderLookupRequest");
function parseLineOrderLookupCommand(text) {
  return parseLineOrderLookupRequest(text)?.query || "";
}
__name(parseLineOrderLookupCommand, "parseLineOrderLookupCommand");
function isLineOrderPromptCommand(text) {
  return /^訂單(?:編號)?\s*[+＋:：]?\s*$/u.test(
    normalizeScheduleDigits(text).normalize("NFKC").trim()
  );
}
__name(isLineOrderPromptCommand, "isLineOrderPromptCommand");
function normalizeErpOrderMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 1e4) / 1e4 : 0;
}
__name(normalizeErpOrderMoney, "normalizeErpOrderMoney");
function hasErpOrderMoney(value) {
  return value !== null && value !== void 0 && String(value).trim() !== "" && Number.isFinite(Number(value));
}
__name(hasErpOrderMoney, "hasErpOrderMoney");
function normalizeErpOrderItem(rawItem) {
  const quantity = normalizeErpOrderMoney(rawItem?.quantity);
  const unitPrice = normalizeErpOrderMoney(rawItem?.unitPrice);
  const rawSubtotal = rawItem?.subtotalAmount;
  const hasSubtotal = hasErpOrderMoney(rawSubtotal);
  return {
    orderNo: String(rawItem?.orderNo || "").replace(/\s+/g, "").slice(0, 120),
    subOrderNo: String(rawItem?.subOrderNo || "").replace(/\s+/g, "").slice(0, 120),
    sku: normalizeWarehouseSku(rawItem?.sku),
    name: String(rawItem?.name || "\u5546\u54C1").replace(/\s+/g, " ").trim().slice(0, 240) || "\u5546\u54C1",
    style: String(rawItem?.style || "").replace(/\s+/g, " ").trim().slice(0, 120),
    quantity,
    unitPrice,
    subtotalAmount: hasSubtotal ? normalizeErpOrderMoney(rawSubtotal) : normalizeErpOrderMoney(quantity * unitPrice),
    warehouseArea: String(rawItem?.warehouseArea || "").replace(/\s+/g, " ").trim().slice(0, 160)
  };
}
__name(normalizeErpOrderItem, "normalizeErpOrderItem");
function normalizeErpOrderItems(rawItems) {
  const source = Array.isArray(rawItems) ? rawItems : [];
  const normalized = source.slice(0, erpOrderMaxInputItems).map(normalizeErpOrderItem);
  const collapsed = collapseErpOrderItems(normalized);
  return {
    items: collapsed.slice(0, erpOrderMaxStoredItems),
    itemsTruncated: source.length > erpOrderMaxInputItems || collapsed.length > erpOrderMaxStoredItems,
    aliases: normalized.flatMap((item) => [item.orderNo, item.subOrderNo])
  };
}
__name(normalizeErpOrderItems, "normalizeErpOrderItems");
function normalizeErpPrintableOrder(rawPrintable) {
  const number = normalizeErpOrderAlias(rawPrintable?.number).slice(0, 120);
  if (!number) return null;
  const normalizedItems = normalizeErpOrderItems(rawPrintable?.items);
  const derivedQuantity = normalizedItems.items.reduce(
    (sum, item) => sum + (Number(item?.quantity) || 0),
    0
  );
  const derivedAmount = normalizedItems.items.reduce(
    (sum, item) => sum + erpOrderItemSubtotal(item),
    0
  );
  return {
    number,
    subOrderNo: String(rawPrintable?.subOrderNo || "").replace(/\s+/g, "").slice(0, 120),
    totalQuantity: hasErpOrderMoney(rawPrintable?.totalQuantity) ? normalizeErpOrderMoney(rawPrintable.totalQuantity) : derivedQuantity,
    subtotalAmount: hasErpOrderMoney(rawPrintable?.subtotalAmount) ? normalizeErpOrderMoney(rawPrintable.subtotalAmount) : derivedAmount,
    items: normalizedItems.items,
    itemsTruncated: Boolean(rawPrintable?.itemsTruncated) || normalizedItems.itemsTruncated,
    aliases: normalizedItems.aliases
  };
}
__name(normalizeErpPrintableOrder, "normalizeErpPrintableOrder");
function normalizeErpOrder(rawOrder) {
  const transactionNo = normalizeErpOrderAlias(rawOrder?.transactionNo).slice(0, 80);
  if (!/^\d{7,12}$/.test(transactionNo)) return null;
  const uniqueStrings = /* @__PURE__ */ __name((values, limit = 100) => [...new Set(
    (Array.isArray(values) ? values : []).map((value) => String(value || "").replace(/\s+/g, " ").trim().slice(0, 160)).filter(Boolean)
  )].slice(0, limit), "uniqueStrings");
  const order = {
    transactionNo,
    orderNumbers: uniqueStrings(rawOrder?.orderNumbers),
    printableOrderNumbers: uniqueStrings(rawOrder?.printableOrderNumbers),
    platformOrderNumbers: uniqueStrings(rawOrder?.platformOrderNumbers),
    platform: String(rawOrder?.platform || "").replace(/\s+/g, " ").trim().slice(0, 80),
    status: String(rawOrder?.status || "").replace(/\s+/g, " ").trim().slice(0, 80),
    cancelReason: String(rawOrder?.cancelReason || "").replace(/\s+/g, " ").trim().slice(0, 160),
    shipmentType: String(rawOrder?.shipmentType || "").replace(/\s+/g, " ").trim().slice(0, 80),
    shipmentNo: String(rawOrder?.shipmentNo || "").replace(/\s+/g, " ").trim().slice(0, 120),
    shippingStatus: String(rawOrder?.shippingStatus || "").replace(/\s+/g, " ").trim().slice(0, 80),
    createdAt: String(rawOrder?.createdAt || "").replace(/\s+/g, " ").trim().slice(0, 80),
    shippedAt: String(rawOrder?.shippedAt || "").replace(/\s+/g, " ").trim().slice(0, 80),
    dispatchAt: String(rawOrder?.dispatchAt || "").replace(/\s+/g, " ").trim().slice(0, 80),
    pickedAt: String(rawOrder?.pickedAt || "").replace(/\s+/g, " ").trim().slice(0, 80),
    totalAmount: normalizeErpOrderMoney(rawOrder?.totalAmount),
    totalAmountAvailable: rawOrder?.totalAmountAvailable === false ? false : hasErpOrderMoney(rawOrder?.totalAmount),
    totalQuantity: normalizeErpOrderMoney(rawOrder?.totalQuantity),
    totalQuantityAvailable: rawOrder?.totalQuantityAvailable === false ? false : hasErpOrderMoney(rawOrder?.totalQuantity),
    // lastSeenAt is a NAS retention timestamp; exclude it from stored business blocks.
    items: []
  };
  const normalizedItems = normalizeErpOrderItems(rawOrder?.items);
  order.items = normalizedItems.items;
  order.itemsTruncated = Boolean(rawOrder?.itemsTruncated) || normalizedItems.itemsTruncated;
  const printableAliases = [];
  if (Array.isArray(rawOrder?.printableOrders)) {
    const printableByNumber = /* @__PURE__ */ new Map();
    for (const rawPrintable of rawOrder.printableOrders.slice(0, erpOrderMaxPrintableOrders)) {
      const printable = normalizeErpPrintableOrder(rawPrintable);
      if (!printable || printableByNumber.has(printable.number)) continue;
      printableByNumber.set(printable.number, printable);
      printableAliases.push(printable.number, printable.subOrderNo, ...printable.aliases);
    }
    order.printableOrders = [...printableByNumber.values()].map(({ aliases, ...printable }) => printable).sort((left, right) => compareErpOrderAliases(left.number, right.number));
    order.printableOrdersTruncated = Boolean(rawOrder?.printableOrdersTruncated) || rawOrder.printableOrders.length > erpOrderMaxPrintableOrders || Array.isArray(rawOrder?.printableOrderNumbers) && rawOrder.printableOrderNumbers.length > erpOrderMaxPrintableOrders;
    order.printableOrderNumbers = uniqueStrings([
      ...order.printableOrderNumbers,
      ...order.printableOrders.map((printable) => printable.number)
    ]).sort(compareErpOrderAliases);
  }
  const collectedAliases = collectErpOrderAliases([
    transactionNo,
    ...order.orderNumbers,
    ...order.printableOrderNumbers,
    ...order.platformOrderNumbers,
    ...normalizedItems.aliases,
    ...printableAliases
  ]);
  order.aliases = collectedAliases.aliases;
  if (collectedAliases.limitExceeded) order.aliasLimitExceeded = true;
  return order;
}
__name(normalizeErpOrder, "normalizeErpOrder");
function normalizeStoredErpOrder(rawOrder, expectedTransactionNo, matchedAlias) {
  const order = normalizeErpOrder(rawOrder);
  const expected = normalizeErpOrderAlias(expectedTransactionNo).slice(0, 80);
  const alias = normalizeErpOrderAlias(matchedAlias);
  if (!order || order.aliasLimitExceeded || order.transactionNo !== expected || !alias || !order.aliases.includes(alias)) {
    return null;
  }
  const { aliases, aliasLimitExceeded, ...safeOrder } = order;
  return safeOrder;
}
__name(normalizeStoredErpOrder, "normalizeStoredErpOrder");
function buildErpOrderChunks(orders) {
  const chunks = [];
  let chunk = {};
  let chunkBytes = 2;
  for (const order of orders) {
    const entryBytes = encoder.encode(JSON.stringify({ [order.transactionNo]: order })).byteLength;
    if (Object.keys(chunk).length && chunkBytes + entryBytes > erpOrderChunkTargetBytes) {
      chunks.push(chunk);
      chunk = {};
      chunkBytes = 2;
    }
    chunk[order.transactionNo] = order;
    chunkBytes += entryBytes;
  }
  if (Object.keys(chunk).length) chunks.push(chunk);
  return chunks;
}
__name(buildErpOrderChunks, "buildErpOrderChunks");
function buildErpOrderIndexChunks(buckets, arrayValues = false) {
  return buckets.map((bucket) => {
    const chunks = [];
    let chunk = {}, bytes = 2, entries = 0;
    const flush = /* @__PURE__ */ __name(() => {
      if (entries) chunks.push(chunk);
      chunk = {};
      bytes = 2;
      entries = 0;
    }, "flush");
    const append = /* @__PURE__ */ __name((key, value) => {
      const entryBytes = encoder.encode(`${JSON.stringify(key)}:${JSON.stringify(value)}`).byteLength;
      if (entryBytes + 2 > erpOrderChunkTargetBytes) throw new Error("ORDER_INDEX_ENTRY_TOO_LARGE");
      if (Object.hasOwn(chunk, key) || entries && bytes + 1 + entryBytes > erpOrderChunkTargetBytes) flush();
      bytes += entryBytes + (entries ? 1 : 0);
      chunk[key] = value;
      entries += 1;
    }, "append");
    for (const [key, value] of Object.entries(bucket)) {
      if (!arrayValues) {
        append(key, value);
        continue;
      }
      const overhead = encoder.encode(JSON.stringify(key)).byteLength + 5;
      let segment = [], segmentBytes = overhead;
      for (const location of value) {
        const entryBytes = encoder.encode(JSON.stringify(location)).byteLength;
        if (segment.length && segmentBytes + 1 + entryBytes > erpOrderChunkTargetBytes) {
          append(key, segment);
          segment = [];
          segmentBytes = overhead;
        }
        segmentBytes += entryBytes + (segment.length ? 1 : 0);
        segment.push(location);
      }
      if (segment.length) append(key, segment);
    }
    flush();
    return chunks;
  });
}
__name(buildErpOrderIndexChunks, "buildErpOrderIndexChunks");
function erpOrderIndexPageKeys(metadata, kind, bucketIndex) {
  const prefix = `erp-order-${kind}:${metadata.version}:${bucketIndex}`;
  if (!metadata.indexFormat) return [prefix];
  const counts = kind === "alias" ? metadata.aliasChunkCounts : metadata.skuStatusChunkCounts;
  const bucketCount = kind === "alias" ? metadata.aliasBucketCount : metadata.skuStatusBucketCount;
  const count = counts?.[bucketIndex];
  if (metadata.indexFormat !== 2 || !Array.isArray(counts) || counts.length !== bucketCount || !Number.isInteger(count) || count < 0 || count > 5e3) throw new Error("UNSAFE_STORED_ORDER_INDEX");
  return Array.from({ length: count }, (_, page) => `${prefix}:${page}`);
}
__name(erpOrderIndexPageKeys, "erpOrderIndexPageKeys");
function formatErpOrderMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "NT$0";
  const rounded = Math.round(amount * 100) / 100;
  return `NT$${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)}`;
}
__name(formatErpOrderMoney, "formatErpOrderMoney");
function groupErpOrderItemsByName(items) {
  const groups = [];
  const byName = /* @__PURE__ */ new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const name = String(item?.name || "\u672A\u547D\u540D\u54C1\u9805").trim() || "\u672A\u547D\u540D\u54C1\u9805";
    let group = byName.get(name);
    if (!group) {
      group = { name, items: [] };
      byName.set(name, group);
      groups.push(group);
    }
    group.items.push(item || {});
  }
  return groups;
}
__name(groupErpOrderItemsByName, "groupErpOrderItemsByName");
function erpOrderItemStyle(item) {
  const style = String(item?.displayStyle || item?.style || "").trim();
  return style && style !== item?.name ? style : "\u672A\u6A19\u793A\u898F\u683C";
}
__name(erpOrderItemStyle, "erpOrderItemStyle");
function normalizeErpOrderItemSpecification(value) {
  return String(value || "").normalize("NFKC").toUpperCase().replace(/[‐‑‒–—―−﹘﹣－]/gu, "-").replace(/／/gu, "/").replace(/\s+/gu, "").slice(0, 240);
}
__name(normalizeErpOrderItemSpecification, "normalizeErpOrderItemSpecification");
function resolveErpOrderItemWarehouseDetails(item, warehouseItems) {
  const suppliedSku = normalizeWarehouseSku(item?.sku);
  const itemStyle = normalizeErpOrderItemSpecification(item?.style);
  const itemLocation = normalizeWarehouseStorageLocation(item?.warehouseArea);
  const matches = [];
  for (const warehouseItem of Array.isArray(warehouseItems) ? warehouseItems : []) {
    const parentSku2 = normalizeWarehouseSku(warehouseItem?.sku);
    if (!parentSku2) continue;
    for (const variant2 of Array.isArray(warehouseItem?.variants) ? warehouseItem.variants : []) {
      const barcode2 = normalizeWarehouseSku(variant2?.barcode);
      const skuMatches = !suppliedSku || suppliedSku === parentSku2 || suppliedSku === barcode2;
      if (!skuMatches) continue;
      const variantStyle = normalizeErpOrderItemSpecification(variant2?.style);
      const variantStyleAndSize = normalizeErpOrderItemSpecification(
        [variant2?.style, variant2?.size].filter(Boolean).join("-")
      );
      const styleMatches = !itemStyle || itemStyle === variantStyle || itemStyle === variantStyleAndSize;
      const locationMatches = !itemLocation || itemLocation === normalizeWarehouseStorageLocation(variant2?.location);
      if (styleMatches && locationMatches) matches.push({ parentSku: parentSku2, variant: variant2, barcode: barcode2 });
    }
  }
  if (matches.length !== 1) return { ...item, sku: suppliedSku };
  const [{ parentSku, variant, barcode }] = matches;
  const resolvedSku = suppliedSku || (barcode && (barcode === parentSku || barcode.startsWith(`${parentSku}-`)) ? barcode : parentSku);
  const variantSize = String(variant?.size || "").replace(/\s+/g, " ").trim();
  const displayStyle = variantSize === "1" ? String(variant?.style || item?.style || "") : String(item?.style || [variant?.style, variantSize].filter(Boolean).join("-") || "");
  return {
    ...item,
    sku: resolvedSku,
    displayStyle: displayStyle.replace(/\s+/g, " ").trim().slice(0, 120),
    warehouseArea: String(item?.warehouseArea || variant?.location || "").replace(/\s+/g, " ").trim().slice(0, 160)
  };
}
__name(resolveErpOrderItemWarehouseDetails, "resolveErpOrderItemWarehouseDetails");
function collapseErpOrderItems(items) {
  const collapsed = [];
  const indexes = /* @__PURE__ */ new Map();
  for (const rawItem of Array.isArray(items) ? items : []) {
    const item = rawItem || {};
    const key = JSON.stringify([
      normalizeWarehouseSku(item.sku),
      String(item.name || "\u5546\u54C1").trim(),
      String(item.style || "").trim(),
      Number(item.unitPrice) || 0,
      String(item.warehouseArea || "").trim()
    ]);
    const existingIndex = indexes.get(key);
    if (existingIndex === void 0) {
      indexes.set(key, collapsed.length);
      collapsed.push({
        ...item,
        quantity: Number(item.quantity) || 0,
        subtotalAmount: erpOrderItemSubtotal(item)
      });
    } else {
      collapsed[existingIndex].quantity += Number(item.quantity) || 0;
      collapsed[existingIndex].subtotalAmount += erpOrderItemSubtotal(item);
    }
  }
  return collapsed;
}
__name(collapseErpOrderItems, "collapseErpOrderItems");
function joinErpOrderMessageLines(lines, limit = 4900, footerCount = 0) {
  const normalizedLines = lines.map((line) => String(line));
  const message = normalizedLines.join("\n");
  if (message.length <= limit) return message;
  const notice = "\u2026\u5167\u5BB9\u904E\u9577\uFF0C\u5F8C\u7E8C\u54C1\u9805\u5DF2\u7701\u7565";
  const safeFooterCount = Math.min(normalizedLines.length, Math.max(0, Math.trunc(footerCount)));
  const body = safeFooterCount ? normalizedLines.slice(0, -safeFooterCount) : normalizedLines;
  const footer = safeFooterCount ? normalizedLines.slice(-safeFooterCount) : [];
  const kept = [];
  for (const line of body) {
    const candidate = [...kept, line, notice, ...footer].join("\n");
    if (candidate.length > limit) break;
    kept.push(line);
  }
  return [...kept, notice, ...footer].join("\n");
}
__name(joinErpOrderMessageLines, "joinErpOrderMessageLines");
function normalizeErpOrderLookupRequest(value) {
  if (value && typeof value === "object") {
    return {
      query: normalizeErpOrderAlias(value.query),
      mode: value.mode === "all" ? "all" : "auto",
      page: Math.max(1, Math.trunc(Number(value.page) || 1))
    };
  }
  return {
    query: normalizeErpOrderAlias(value),
    mode: "auto",
    page: 1
  };
}
__name(normalizeErpOrderLookupRequest, "normalizeErpOrderLookupRequest");
function erpOrderPrintableNumbers(order) {
  return [...new Set([
    ...Array.isArray(order?.printableOrderNumbers) ? order.printableOrderNumbers : [],
    ...Array.isArray(order?.printableOrders) ? order.printableOrders.map((printable) => printable?.number) : []
  ].map(normalizeErpOrderAlias).filter(Boolean))].sort(compareErpOrderAliases);
}
__name(erpOrderPrintableNumbers, "erpOrderPrintableNumbers");
function erpOrderItemSubtotal(item) {
  const subtotal = item?.subtotalAmount;
  if (hasErpOrderMoney(subtotal)) {
    return Number(subtotal);
  }
  return (Number(item?.unitPrice) || 0) * (Number(item?.quantity) || 0);
}
__name(erpOrderItemSubtotal, "erpOrderItemSubtotal");
function erpOrderPlatformNumberLine(order, limit = 3) {
  const numbers = [...new Set(
    (Array.isArray(order?.platformOrderNumbers) ? order.platformOrderNumbers : []).map((value) => String(value || "").trim()).filter(Boolean)
  )];
  if (!numbers.length) return "";
  const shown = numbers.slice(0, limit);
  const omitted = numbers.length - shown.length;
  return `\u5E73\u53F0\u55AE\u865F\uFF1A${shown.join("\u3001")}${omitted > 0 ? `\uFF08\u53E6 ${omitted} \u7B46\uFF09` : ""}`;
}
__name(erpOrderPlatformNumberLine, "erpOrderPlatformNumberLine");
function erpOrderSummaryView(order, printable = null, all = false) {
  const sourceItems = printable?.items ?? order?.items;
  const items = collapseErpOrderItems(sourceItems);
  const derivedQuantity = items.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0);
  const derivedAmount = items.reduce((sum, item) => sum + erpOrderItemSubtotal(item), 0);
  const transactionItems = collapseErpOrderItems(order?.items);
  const transactionDerivedAmount = transactionItems.reduce(
    (sum, item) => sum + erpOrderItemSubtotal(item),
    0
  );
  const printableQuantity = Number(printable?.totalQuantity);
  const printableAmount = Number(printable?.subtotalAmount);
  const transactionTotalProvided = order?.totalAmountAvailable === true || order?.totalAmountAvailable !== false && hasErpOrderMoney(order?.totalAmount) && Number(order.totalAmount) !== 0;
  const transactionTotalAmount = transactionTotalProvided ? Number(order.totalAmount) : transactionDerivedAmount;
  return {
    kind: "summary",
    all,
    isPrintable: Boolean(printable),
    displayNo: all ? `\u5168\u90E8\u8A02\u55AE\uFF5C\u4EA4\u6613 ${order.transactionNo}` : printable?.number || erpOrderPrintableNumbers(order)[0] || order.transactionNo,
    items,
    totalQuantity: printable && hasErpOrderMoney(printable?.totalQuantity) ? printableQuantity : Number(order?.totalQuantity) || derivedQuantity,
    totalAmount: printable && hasErpOrderMoney(printable?.subtotalAmount) ? printableAmount : printable ? derivedAmount : transactionTotalAmount,
    transactionTotalAmount,
    transactionTotalKnown: Boolean(order?.totalAmountAvailable) || Number(order?.totalAmount) !== 0 || transactionItems.length > 0,
    itemsTruncated: Boolean(printable?.itemsTruncated || !printable && order?.itemsTruncated)
  };
}
__name(erpOrderSummaryView, "erpOrderSummaryView");
function selectErpOrderView(order, lookup) {
  if (lookup.mode === "all") return erpOrderSummaryView(order, null, true);
  const printableNumbers = erpOrderPrintableNumbers(order);
  const printableDetailsAvailable = Array.isArray(order?.printableOrders);
  const printableByNumber = new Map(
    (printableDetailsAvailable ? order.printableOrders : []).filter((printable) => printable?.number).map((printable) => [normalizeErpOrderAlias(printable.number), printable])
  );
  const exactPrintable = printableByNumber.get(lookup.query);
  if (exactPrintable) return erpOrderSummaryView(order, exactPrintable);
  if (order?.printableOrdersTruncated) {
    return { kind: "pending", printableNumbers };
  }
  if (printableNumbers.length <= 1) {
    const onlyPrintable = printableByNumber.get(printableNumbers[0]);
    return erpOrderSummaryView(order, onlyPrintable || null);
  }
  const detailsComplete = printableDetailsAvailable && printableNumbers.every((number) => printableByNumber.has(number));
  if (!detailsComplete) {
    return { kind: "pending", printableNumbers };
  }
  return { kind: "list", printableNumbers };
}
__name(selectErpOrderView, "selectErpOrderView");
function createErpOrderSelectionMessage(order, view, lookup, updatedLine, options = {}) {
  if (view.kind === "pending") {
    return joinErpOrderMessageLines([
      "\u26A0\uFE0F \u8A02\u55AE\u660E\u7D30\u5F85\u66F4\u65B0",
      `\u4EA4\u6613\u5E8F\u865F\uFF1A${order.transactionNo}`,
      `\u9019\u7B46\u4EA4\u6613\u6709 ${view.printableNumbers.length} \u5F35\u5B8C\u6574\u51FA\u8CA8\u55AE\uFF0C\u76EE\u524D\u5FEB\u7167\u5C1A\u672A\u5305\u542B\u9010\u5F35\u54C1\u9805\uFF0C\u7121\u6CD5\u5B89\u5168\u5224\u65B7\u6307\u5B9A\u51FA\u8CA8\u55AE\u5167\u5BB9\u3002`,
      "\u8ACB\u7B49 NAS \u4E0B\u4E00\u6B21\u540C\u6B65\u5F8C\u518D\u67E5\u5B8C\u6574\u865F\u3002",
      `\u5982\u8981\u67E5\u770B\u6574\u7B46\u4EA4\u6613\u5F59\u7E3D\uFF1A\u5168\u90E8 ${order.transactionNo}`,
      updatedLine
    ], 4900, 1);
  }
  const totalPages = Math.max(1, Math.ceil(view.printableNumbers.length / erpOrderPrintablePageSize));
  const page = Math.min(totalPages, lookup.page);
  const start = (page - 1) * erpOrderPrintablePageSize;
  const shown = view.printableNumbers.slice(start, start + erpOrderPrintablePageSize);
  const lines = [
    `\u{1F4E6} \u4EA4\u6613 ${order.transactionNo}\uFF5C${view.printableNumbers.length} \u5F35\u5B8C\u6574\u51FA\u8CA8\u55AE`
  ];
  lines.push(`\u5E73\u53F0\uFF1A${order.platform || "\u672A\u63D0\u4F9B"}`);
  const platformNumberLine = erpOrderPlatformNumberLine(order);
  if (platformNumberLine) lines.push(platformNumberLine);
  const statusAndShipment = [
    order.status ? `\u72C0\u614B\uFF1A${order.status}` : "",
    order.shippedAt ? `\u51FA\u8CA8\uFF1A${order.shippedAt}` : "\u51FA\u8CA8\uFF1A\u672A\u63D0\u4F9B"
  ].filter(Boolean).join("\uFF5C");
  if (statusAndShipment) lines.push(statusAndShipment);
  lines.push(`\u7B2C ${page}/${totalPages} \u9801`);
  shown.forEach((number, index) => lines.push(`${start + index + 1}. ${number}`));
  lines.push(
    "",
    options.numericSelectionAvailable ? "\u8ACB\u76F4\u63A5\u8F38\u5165\u4E0A\u65B9\u5DE6\u5074\u7DE8\u865F\uFF08\u4F8B\u5982\uFF1A11\uFF09\uFF0C\u6216\u8907\u88FD\u5B8C\u6574\u865F\u78BC\u67E5\u8A62\u5176\u4E2D\u4E00\u5F35\u3002" : "\u8ACB\u8907\u88FD\u5B8C\u6574\u865F\u78BC\u67E5\u8A62\u5176\u4E2D\u4E00\u5F35\u3002"
  );
  if (page > 1) lines.push(`\u4E0A\u4E00\u9801\uFF1A\u8A02\u55AE ${order.transactionNo} \u7B2C${page - 1}\u9801`);
  if (page < totalPages) lines.push(`\u4E0B\u4E00\u9801\uFF1A\u8A02\u55AE ${order.transactionNo} \u7B2C${page + 1}\u9801`);
  lines.push(`\u67E5\u770B\u6574\u7B46\u4EA4\u6613\uFF1A\u5168\u90E8 ${order.transactionNo}`, updatedLine);
  return joinErpOrderMessageLines(lines, 4900, 1);
}
__name(createErpOrderSelectionMessage, "createErpOrderSelectionMessage");
function createErpOrderSummaryMessage(order, view, updatedLine) {
  const itemGroups = groupErpOrderItemsByName(view.items);
  const lines = [`\u{1F4E6} ${view.displayNo}`];
  lines.push(`\u5E73\u53F0\uFF1A${order.platform || "\u672A\u63D0\u4F9B"}`);
  const platformNumberLine = erpOrderPlatformNumberLine(order);
  if (platformNumberLine) lines.push(platformNumberLine);
  const statusAndShipment = [
    order.status ? `\u72C0\u614B\uFF1A${order.status}` : "",
    order.shippedAt ? `\u51FA\u8CA8\uFF1A${order.shippedAt}` : "\u51FA\u8CA8\uFF1A\u672A\u63D0\u4F9B"
  ].filter(Boolean).join("\uFF5C");
  if (statusAndShipment) lines.push(statusAndShipment);
  if (order.shippingStatus) lines.push(`\u914D\u9001\uFF1A${order.shippingStatus}`);
  if (order.shipmentType) lines.push(`\u51FA\u8CA8\u65B9\u5F0F\uFF1A${order.shipmentType}`);
  if (order.shipmentNo) lines.push(`\u51FA\u8CA8\u55AE\u865F\uFF1A${order.shipmentNo}`);
  const differsFromTransaction = view.isPrintable && view.transactionTotalKnown && Math.abs(Number(view.totalAmount) - Number(view.transactionTotalAmount)) > 1e-4;
  lines.push(
    `\u5546\u54C1 ${itemGroups.length} \u6B3E\uFF5C\u898F\u683C ${view.items.length} \u9805\uFF5C\u5171 ${view.totalQuantity || 0} \u4EF6\uFF5C${differsFromTransaction ? "\u672C\u5F35\u5546\u54C1\u5C0F\u8A08" : "\u7E3D\u984D"} ${formatErpOrderMoney(view.totalAmount)}`
  );
  if (differsFromTransaction) {
    lines.push(`\u6574\u7B46\u4EA4\u6613\u7E3D\u8A08\uFF1A${formatErpOrderMoney(view.transactionTotalAmount)}`);
  }
  lines.push("");
  if (!itemGroups.length) lines.push("\u76EE\u524D\u6C92\u6709\u53EF\u986F\u793A\u7684\u5546\u54C1\u660E\u7D30\u3002");
  for (const [index, group] of itemGroups.slice(0, 12).entries()) {
    lines.push(`${index + 1}. ${group.name}`);
    for (const item of group.items) {
      const sku = normalizeWarehouseSku(item?.sku) || "\u672A\u63D0\u4F9B\u8CA8\u865F";
      lines.push(`   ${sku}\uFF5C${erpOrderItemStyle(item)}\uFF5C\xD7${Number(item?.quantity) || 0}`);
      lines.push(
        `   \u{1F4CD}${item?.warehouseArea || "\u672A\u63D0\u4F9B"}\uFF5C\u55AE\u50F9 ${formatErpOrderMoney(item?.unitPrice)}\uFF5C\u5C0F\u8A08 ${formatErpOrderMoney(erpOrderItemSubtotal(item))}`
      );
    }
  }
  if (itemGroups.length > 12) lines.push(`\u2026\u53E6\u6709 ${itemGroups.length - 12} \u6B3E\u672A\u986F\u793A`);
  if (view.itemsTruncated) lines.push(`\u26A0\uFE0F \u54C1\u9805\u904E\u591A\uFF0C\u50C5\u4FDD\u7559\u524D ${erpOrderMaxStoredItems} \u500B\u5408\u4F75\u898F\u683C`);
  if (order.cancelReason) lines.push(`\u53D6\u6D88\u539F\u56E0\uFF1A${order.cancelReason}`);
  lines.push(`\u5EFA\u7ACB\uFF1A${order.createdAt || "\u672A\u63D0\u4F9B"}`, updatedLine);
  return joinErpOrderMessageLines(lines, 4900, 2);
}
__name(createErpOrderSummaryMessage, "createErpOrderSummaryMessage");
function erpOrderRecentSelectionContext(result, query, now = Date.now()) {
  const metadata = result?.metadata || null;
  const snapshotVersion = String(metadata?.version || "").trim();
  const updatedAt = Date.parse(String(metadata?.updatedAt || ""));
  const stale = !Number.isFinite(updatedAt) || Number(now) - updatedAt > erpOrderMaxSnapshotAgeMs || updatedAt > Number(now) + 5 * 6e4;
  const order = result?.order;
  if (!snapshotVersion || stale || !order) return null;
  const lookup = normalizeErpOrderLookupRequest(query);
  const view = selectErpOrderView(order, lookup);
  if (view.kind !== "list") return null;
  return {
    snapshotVersion,
    transactionNo: order.transactionNo,
    printableNumbers: view.printableNumbers,
    savedAt: Number(now)
  };
}
__name(erpOrderRecentSelectionContext, "erpOrderRecentSelectionContext");
function erpOrderSkuStatusSelectionContext(result, request, now = Date.now()) {
  const lookup = normalizeErpOrderSkuStatusRequest(request);
  const metadata = result?.metadata || null;
  const snapshotVersion = String(metadata?.version || "").trim();
  const updatedAt = Date.parse(String(metadata?.updatedAt || ""));
  const stale = !Number.isFinite(updatedAt) || Number(now) - updatedAt > erpOrderMaxSnapshotAgeMs || updatedAt > Number(now) + 5 * 6e4;
  const orders = Array.isArray(result?.orders) ? result.orders : [];
  const page = Math.max(1, Number(result?.page) || lookup.page);
  const queries = orders.map((order) => normalizeErpOrderAlias(order?.number));
  if (!snapshotVersion || stale || !lookup.sku || !lookup.status || !queries.length || queries.length > erpOrderSkuStatusPageSize || queries.some((query) => !/^(?:\d{7,12}|\d{4,10}-\d{6,12})$/u.test(query)) || new Set(queries).size !== queries.length) return null;
  return {
    kind: "sku-status",
    snapshotVersion,
    sku: lookup.sku,
    status: lookup.status,
    page,
    firstIndex: (page - 1) * erpOrderSkuStatusPageSize + 1,
    queries,
    savedAt: Number(now)
  };
}
__name(erpOrderSkuStatusSelectionContext, "erpOrderSkuStatusSelectionContext");
function normalizeErpOrderRecentSelectionRecord(rawRecord) {
  const snapshotVersion = String(rawRecord?.snapshotVersion || "").trim();
  const kind = rawRecord?.kind === "sku-status" ? "sku-status" : "transaction-list";
  const savedAt = Number(rawRecord?.savedAt);
  const expiresAt = Number(rawRecord?.expiresAt);
  if (!snapshotVersion || snapshotVersion.length > 160 || !Number.isFinite(savedAt) || !Number.isFinite(expiresAt) || expiresAt <= savedAt) return null;
  if (kind === "sku-status") {
    const sku = erpOrderSkuKeys(rawRecord?.sku)?.[0] || "";
    const status = String(rawRecord?.status || "").normalize("NFKC").replace(/\s+/gu, "").trim();
    const page = Number(rawRecord?.page);
    const firstIndex = Number(rawRecord?.firstIndex);
    const rawQueries = Array.isArray(rawRecord?.queries) ? rawRecord.queries : [];
    const queries = rawQueries.map(normalizeErpOrderAlias);
    if (!sku || !erpOrderSkuStatuses.includes(status) || !Number.isInteger(page) || page < 1 || !Number.isInteger(firstIndex) || firstIndex !== (page - 1) * erpOrderSkuStatusPageSize + 1 || rawQueries.length < 1 || rawQueries.length > erpOrderSkuStatusPageSize || queries.some((query) => !/^(?:\d{7,12}|\d{4,10}-\d{6,12})$/u.test(query)) || new Set(queries).size !== queries.length || expiresAt - savedAt > erpOrderSkuStatusSelectionTtlMs) return null;
    return {
      kind,
      snapshotVersion,
      sku,
      status,
      page,
      firstIndex,
      queries,
      savedAt,
      expiresAt
    };
  }
  const transactionNo = normalizeErpOrderAlias(rawRecord?.transactionNo).slice(0, 80);
  const rawNumbers = Array.isArray(rawRecord?.printableNumbers) ? rawRecord.printableNumbers : [];
  const printableNumbers = rawNumbers.map(normalizeErpOrderAlias);
  if (!/^\d{7,12}$/u.test(transactionNo) || rawNumbers.length < 2 || rawNumbers.length > erpOrderMaxPrintableOrders || printableNumbers.some((number) => !/^\d{4,10}-\d{6,12}$/u.test(number) || !number.endsWith(`-${transactionNo}`)) || new Set(printableNumbers).size !== printableNumbers.length || expiresAt - savedAt > erpOrderRecentSelectionTtlMs) return null;
  return {
    kind,
    snapshotVersion,
    transactionNo,
    printableNumbers,
    savedAt,
    expiresAt
  };
}
__name(normalizeErpOrderRecentSelectionRecord, "normalizeErpOrderRecentSelectionRecord");
function createErpOrderMessage(result, query, now = Date.now(), options = {}) {
  const metadata = result?.metadata || null;
  const updatedAt = Date.parse(String(metadata?.updatedAt || ""));
  const updatedLine = Number.isFinite(updatedAt) ? `ERP \u66F4\u65B0\uFF1A${formatTaipeiDate(updatedAt)}` : "ERP \u66F4\u65B0\uFF1A\u6642\u9593\u4E0D\u660E";
  const stale = !Number.isFinite(updatedAt) || Number(now) - updatedAt > erpOrderMaxSnapshotAgeMs || updatedAt > Number(now) + 5 * 6e4;
  if (stale) {
    return `\u26A0\uFE0F \u8A02\u55AE\u67E5\u8A62\u66AB\u505C

ERP \u8A02\u55AE\u8CC7\u6599\u5DF2\u8D85\u904E 30 \u5206\u9418\u6216\u6642\u9593\u7121\u6548\uFF0C\u70BA\u907F\u514D\u56DE\u8986\u820A\u8CC7\u6599\uFF0C\u8ACB\u5148\u78BA\u8A8D NAS \u540C\u6B65\u3002
${updatedLine}`;
  }
  const lookup = normalizeErpOrderLookupRequest(query);
  const order = result?.order;
  if (!order) return `\u{1F50E} \u67E5\u7121\u8A02\u55AE\u300C${lookup.query.slice(0, 160)}\u300D
${updatedLine}`;
  const view = selectErpOrderView(order, lookup);
  if (view.kind !== "summary") {
    return createErpOrderSelectionMessage(order, view, lookup, updatedLine, options);
  }
  return createErpOrderSummaryMessage(order, view, updatedLine);
}
__name(createErpOrderMessage, "createErpOrderMessage");
function warehouseUnitCostText(item) {
  if (!isNasLocalImageSku(item?.sku)) return "";
  const minimum = normalizeWarehouseUnitCost(item?.costMin);
  const maximum = normalizeWarehouseUnitCost(item?.costMax);
  if (!minimum && !maximum) return "\u{1F512} \u55AE\u500B\u5B58\u8CA8\u6210\u672C\uFF1A\u672A\u8A2D\u5B9A";
  const low = minimum || maximum;
  const high = maximum || minimum;
  if (low === high) return `\u{1F512} \u55AE\u500B\u5B58\u8CA8\u6210\u672C\uFF1A${formatWarehouseUnitCost(low)}\uFF0F\u500B`;
  return `\u{1F512} \u55AE\u500B\u5B58\u8CA8\u6210\u672C\uFF1A${formatWarehouseUnitCost(low)}\uFF5E${formatWarehouseUnitCost(high)}\uFF0F\u500B`;
}
__name(warehouseUnitCostText, "warehouseUnitCostText");
function warehouseSalePriceText(item) {
  const minimum = normalizeWarehouseMoney(item?.priceMin);
  const maximum = normalizeWarehouseMoney(item?.priceMax);
  if (!minimum && !maximum) return "\u{1F4B0} ERP \u552E\u50F9\uFF1A\u672A\u8A2D\u5B9A";
  const low = minimum || maximum;
  const high = maximum || minimum;
  if (low === high) return `\u{1F4B0} ERP \u552E\u50F9\uFF1A${formatWarehouseMoney(low)}\uFF0F\u500B`;
  return `\u{1F4B0} ERP \u552E\u50F9\uFF1A${formatWarehouseMoney(low)}\uFF5E${formatWarehouseMoney(high)}\uFF0F\u500B`;
}
__name(warehouseSalePriceText, "warehouseSalePriceText");
function warehouseLocationBucket(sku, bucketCount = 64) {
  let hash = 2166136261;
  for (const char of String(sku || "")) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % bucketCount;
}
__name(warehouseLocationBucket, "warehouseLocationBucket");
function warehouseStorageLocationRow(item, variant) {
  return {
    sku: String(item?.sku || "").slice(0, 80),
    name: String(item?.name || "ERP \u5546\u54C1").slice(0, 200),
    style: String(variant?.style || "").slice(0, 100),
    size: String(variant?.size || "").slice(0, 100),
    barcode: String(variant?.barcode || "").slice(0, 100),
    available: Math.trunc(Number(variant?.available) || 0)
  };
}
__name(warehouseStorageLocationRow, "warehouseStorageLocationRow");
function finalizeWarehouseStorageLocationRecord(location, rows) {
  const unique = [];
  const seen = /* @__PURE__ */ new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = JSON.stringify([row.sku, row.name, row.style, row.size, row.barcode, row.available]);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  unique.sort(
    (a, b) => a.sku.localeCompare(b.sku, "zh-TW", { numeric: true }) || a.style.localeCompare(b.style, "zh-TW", { numeric: true }) || a.size.localeCompare(b.size, "zh-TW", { numeric: true }) || a.barcode.localeCompare(b.barcode, "zh-TW", { numeric: true })
  );
  return {
    location,
    items: unique,
    skuCount: new Set(unique.map((row) => row.sku)).size,
    itemCount: unique.length
  };
}
__name(finalizeWarehouseStorageLocationRecord, "finalizeWarehouseStorageLocationRecord");
function createWarehouseStorageLocationMessage(result, now = Date.now()) {
  const metadata = result?.metadata || {};
  const location = normalizeWarehouseStorageLocation(result?.location);
  const updatedAt = Date.parse(metadata.updatedAt || "");
  const updatedLine = Number.isFinite(updatedAt) ? `ERP \u66F4\u65B0\uFF1A${formatTaipeiDate(updatedAt)}` : "ERP \u66F4\u65B0\uFF1A\u6642\u9593\u4E0D\u660E";
  const stale = !Number.isFinite(updatedAt) || Math.max(0, Number(now) - updatedAt) > warehousePositionDryRunMaxSnapshotAgeMs;
  const staleLine = stale ? "\u26A0\uFE0F \u5132\u4F4D\u8CC7\u6599\u5DF2\u8D85\u904E 30 \u5206\u9418\uFF0C\u8ACB\u5148\u78BA\u8A8D NAS \u540C\u6B65\u72C0\u614B\u3002" : "";
  const totalCount = Math.max(0, Number(result?.totalCount) || 0);
  const allTotalCount = Math.max(totalCount, Number(result?.allTotalCount) || 0);
  const skuCount = Math.max(0, Number(result?.skuCount) || 0);
  const includeUnavailable = result?.includeUnavailable !== false;
  const items = Array.isArray(result?.items) ? result.items : [];
  if (!totalCount) {
    if (!includeUnavailable && allTotalCount) {
      return {
        type: "text",
        text: [
          `\u{1F4CD} ${metadata.warehouseName || "\u4E3B\u5009"}\uFF5C${location}`,
          "\u76EE\u524D\u6C92\u6709\u53EF\u7528\u5EAB\u5B58\u5927\u65BC 0 \u7684\u54C1\u9805\u3002",
          `\u5982\u9700\u67E5\u770B\u7121\u5EAB\u5B58\uFF0C\u8ACB\u8F38\u5165\u300C${location} \u986F\u793A\u7121\u5EAB\u5B58\u300D\u3002`,
          updatedLine,
          staleLine
        ].filter(Boolean).join("\n").slice(0, 4900)
      };
    }
    return {
      type: "text",
      text: [
        `\u{1F50E} \u4E3B\u5009\u67E5\u7121\u5132\u4F4D\u300C${location}\u300D\u7684\u54C1\u9805\u3002`,
        "\u8ACB\u78BA\u8A8D\u5132\u4F4D\u662F\u5426\u5B8C\u6574\uFF0C\u4F8B\u5982\uFF1A04-R05-02/T5\u3002",
        updatedLine,
        staleLine
      ].filter(Boolean).join("\n").slice(0, 4900)
    };
  }
  const totalPages = Math.max(1, Number(result?.totalPages) || Math.ceil(totalCount / warehouseStorageLocationPageSize));
  const page = Math.min(totalPages, Math.max(1, Number(result?.page) || 1));
  const start = (page - 1) * warehouseStorageLocationPageSize;
  const lines = [
    `\u{1F4CD} ${metadata.warehouseName || "\u4E3B\u5009"}\uFF5C${location}`,
    `\u5171 ${skuCount} \u500B\u8CA8\u865F\u3001${totalCount} \u500B${includeUnavailable ? "" : "\u6709\u5EAB\u5B58"}\u54C1\u9805\uFF5C\u7B2C ${page}/${totalPages} \u9801`,
    `\u7BE9\u9078\uFF1A${includeUnavailable ? "\u986F\u793A\u7121\u5EAB\u5B58" : "\u53EA\u770B\u6709\u5EAB\u5B58"}`,
    ""
  ];
  items.forEach((item, index) => {
    const sku = String(item.sku || "").slice(0, 80);
    const name = String(item.name || "ERP \u5546\u54C1").slice(0, 120);
    const specification = ([item.style, item.size].filter(Boolean).join("\uFF0F") || "\u4E00\u822C\u898F\u683C").slice(0, 120);
    const available = Math.trunc(Number(item.available) || 0);
    const stock = available <= 0 ? `\u26A0\uFE0F \u53EF\u7528 ${available}` : `\u53EF\u7528 ${available}`;
    lines.push(`${start + index + 1}. ${sku}\uFF5C${name}`);
    lines.push(`   ${specification}\uFF5C${stock}`);
  });
  lines.push("", updatedLine);
  if (staleLine) lines.push(staleLine);
  const quickReplyItems = [];
  for (const [label, targetPage] of [["\u2B05\uFE0F \u4E0A\u4E00\u9801", page - 1], ["\u27A1\uFE0F \u4E0B\u4E00\u9801", page + 1]]) {
    if (targetPage < 1 || targetPage > totalPages) continue;
    const data = new URLSearchParams({
      action: warehouseStorageLocationAction,
      location,
      page: String(targetPage),
      includeUnavailable: includeUnavailable ? "1" : "0"
    }).toString();
    quickReplyItems.push({
      type: "action",
      action: {
        type: "postback",
        label,
        data,
        displayText: `${label.replace(/[⬅️➡️]\s*/gu, "")}\uFF5C${location}`
      }
    });
  }
  const message = { type: "text", text: lines.join("\n").slice(0, 4900) };
  if (quickReplyItems.length) message.quickReply = { items: quickReplyItems };
  return message;
}
__name(createWarehouseStorageLocationMessage, "createWarehouseStorageLocationMessage");
function createWarehouseStorageLocationFilterPrompt(result) {
  const metadata = result?.metadata || {};
  const location = normalizeWarehouseStorageLocation(result?.location);
  const totalCount = Math.max(0, Number(result?.totalCount) || 0);
  const skuCount = Math.max(0, Number(result?.skuCount) || 0);
  const choices = [
    { label: "\u53EA\u770B\u6709\u5EAB\u5B58", includeUnavailable: false },
    { label: "\u986F\u793A\u7121\u5EAB\u5B58", includeUnavailable: true }
  ].map((choice) => ({
    type: "action",
    action: {
      type: "postback",
      label: choice.label,
      data: new URLSearchParams({
        action: warehouseStorageLocationAction,
        location,
        page: "1",
        includeUnavailable: choice.includeUnavailable ? "1" : "0"
      }).toString(),
      displayText: `${location} ${choice.label}`
    }
  }));
  return {
    type: "text",
    text: [
      `\u{1F4CD} ${metadata.warehouseName || "\u4E3B\u5009"}\uFF5C${location}`,
      `\u6B64\u5132\u4F4D\u5171\u6709 ${skuCount} \u500B\u8CA8\u865F\u3001${totalCount} \u500B\u54C1\u9805\u3002`,
      "\u662F\u5426\u986F\u793A\u7121\u5EAB\u5B58\u54C1\u9805\uFF1F"
    ].join("\n"),
    quickReply: { items: choices }
  };
}
__name(createWarehouseStorageLocationFilterPrompt, "createWarehouseStorageLocationFilterPrompt");
function formatWarehouseLocation(item, metadata = {}, options = {}) {
  if (!item) {
    const updated = metadata.updatedAt ? `
\u5132\u4F4D\u8CC7\u6599\u66F4\u65B0\uFF1A${formatTaipeiDate(Date.parse(metadata.updatedAt))}` : "";
    return `\u{1F50E} ERP \u4E3B\u5009\u67E5\u7121\u6B64\u8CA8\u865F\u3002
\u8ACB\u78BA\u8A8D\u8CA8\u865F\u662F\u5426\u5B8C\u6574\uFF0C\u4F8B\u5982\uFF1AA12345${updated}`;
  }
  const lines = [
    `\u{1F4E6} ${item.sku}\uFF5C${item.name}`,
    `\u4E3B\u5009\u53EF\u7528\u5EAB\u5B58\uFF1A${Number(item.available) || 0}`
  ];
  const costText = options.showCost === true ? warehouseUnitCostText(item) : "";
  if (costText) lines.push(costText);
  const priceText = options.showPrice === true ? warehouseSalePriceText(item) : "";
  if (priceText) lines.push(priceText);
  lines.push("\u5132\u4F4D\uFF1A");
  const variants = Array.isArray(item.variants) ? item.variants : [];
  if (!variants.length) {
    lines.push("\u5C1A\u672A\u8A2D\u5B9A\u5132\u4F4D");
  } else {
    const shown = variants.slice(0, 40);
    for (const variant of shown) {
      const specification = [variant.style, variant.size].filter(Boolean).join("\uFF0F");
      const prefix = specification ? `${specification}\uFF1A` : "";
      const location = String(variant.location || "").trim() || "\u672A\u8A2D\u5B9A\u5132\u4F4D";
      lines.push(`- ${prefix}${location}\uFF08\u53EF\u7528 ${Number(variant.available) || 0}\uFF09`);
    }
    if (variants.length > shown.length) lines.push(`\u53E6\u6709 ${variants.length - shown.length} \u7B46\u898F\u683C\u672A\u5217\u51FA\u3002`);
  }
  if (metadata.updatedAt) lines.push(`\u66F4\u65B0\uFF1A${formatTaipeiDate(Date.parse(metadata.updatedAt))}`);
  return lines.join("\n");
}
__name(formatWarehouseLocation, "formatWarehouseLocation");
function warehouseSearchLocations(item) {
  const unique = [];
  for (const variant of Array.isArray(item?.variants) ? item.variants : []) {
    const location = String(variant?.location || "").replace(/\s+/g, " ").trim();
    if (location && !unique.includes(location)) unique.push(location);
    if (unique.length >= 2) break;
  }
  return unique;
}
__name(warehouseSearchLocations, "warehouseSearchLocations");
function createWarehouseSearchMessage(items, keyword, totalCount = items.length, options = {}) {
  const shown = (Array.isArray(items) ? items : []).slice(0, 10);
  const bubbles = shown.map((item) => {
    const imageUrl = normalizeShopeeImageUrl(item?.imageUrl);
    const locations = warehouseSearchLocations(item);
    const costText = options.showCost === true ? warehouseUnitCostText(item) : "";
    const priceText = options.showPrice === true ? warehouseSalePriceText(item) : "";
    const bodyContents = [
      { type: "text", text: `\u3010${item.sku}\u3011`, weight: "bold", color: "#174B3A", size: "lg" },
      { type: "text", text: String(item.name || "ERP \u5546\u54C1"), wrap: true, maxLines: 3, weight: "bold", size: "md" },
      { type: "separator", margin: "md" },
      { type: "text", text: `\u4E3B\u5009\u53EF\u7528\uFF1A${Number(item.available) || 0}`, margin: "md", size: "sm" },
      {
        type: "text",
        text: locations.length ? `\u4E3B\u8981\u5132\u4F4D\uFF1A${locations.join("\u3001")}` : "\u4E3B\u8981\u5132\u4F4D\uFF1A\u5C1A\u672A\u8A2D\u5B9A",
        wrap: true,
        maxLines: 2,
        size: "sm",
        color: "#555555"
      }
    ];
    const privatePricingContents = [];
    if (costText) {
      privatePricingContents.push({
        type: "text",
        text: costText,
        wrap: true,
        size: "sm",
        color: "#9A6700"
      });
    }
    if (priceText) {
      privatePricingContents.push({
        type: "text",
        text: priceText,
        wrap: true,
        size: "sm",
        color: "#9A6700"
      });
    }
    if (privatePricingContents.length) bodyContents.splice(4, 0, ...privatePricingContents);
    const bubble = {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: bodyContents
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [{
          type: "button",
          style: "primary",
          color: "#174B3A",
          height: "sm",
          action: { type: "message", label: "\u5B8C\u6574\u5132\u4F4D", text: `\u5B8C\u6574\u5132\u4F4D ${item.sku}` }
        }]
      }
    };
    if (item.productUrl) {
      bubble.footer.contents.push({
        type: "button",
        style: "link",
        height: "sm",
        action: { type: "uri", label: "\u67E5\u770B\u8766\u76AE\u5546\u54C1", uri: item.productUrl }
      });
    }
    if (imageUrl) {
      bubble.hero = {
        type: "image",
        url: imageUrl,
        size: "full",
        aspectRatio: "1:1",
        aspectMode: "cover"
      };
    } else {
      bubble.header = {
        type: "box",
        layout: "vertical",
        backgroundColor: "#E9F2EE",
        paddingAll: "16px",
        contents: [{ type: "text", text: "\u{1F4E6} ERP \u5546\u54C1", align: "center", color: "#174B3A", weight: "bold" }]
      };
    }
    return bubble;
  });
  const extra = totalCount > shown.length ? `\uFF0C\u986F\u793A\u524D ${shown.length} \u9805` : "";
  return {
    type: "flex",
    altText: `\u300C${keyword}\u300D\u627E\u5230 ${totalCount} \u9805\u5546\u54C1${extra}`.slice(0, 1500),
    contents: { type: "carousel", contents: bubbles }
  };
}
__name(createWarehouseSearchMessage, "createWarehouseSearchMessage");
function parseLineFollowup(text) {
  const match = String(text || "").trim().match(/^(?:約\s*)?(\d{2})(?:\s*秒)?(?:\s*[；;、,，:]?\s*(.*))?$/u);
  if (!match) return null;
  const seconds = Number.parseInt(match[1], 10);
  if (seconds < 10 || seconds > 60) return null;
  return { seconds, focus: String(match[2] || "").trim().slice(0, 300) };
}
__name(parseLineFollowup, "parseLineFollowup");
function linePendingKey(event) {
  const source = event?.source || {};
  const chatId = source.groupId || source.roomId || source.userId || "unknown-chat";
  const userId = source.userId || "unknown-user";
  return `line-pending:${chatId}:${userId}`;
}
__name(linePendingKey, "linePendingKey");
function lineActivationKey(event) {
  const source = event?.source || {};
  const chatId = source.groupId || source.roomId || "unknown-chat";
  return `line-armed:${chatId}`;
}
__name(lineActivationKey, "lineActivationKey");
var LineActivation = class {
  static {
    __name(this, "LineActivation");
  }
  constructor(state, env) {
    this.storage = state.storage;
    this.env = env || {};
    this.readerSocket = null;
    this.readerHello = null;
    this.readerPending = /* @__PURE__ */ new Map();
    this.erpWritebackSocket = null;
    this.erpWritebackPending = /* @__PURE__ */ new Map();
  }
  readerAuthorized(request) {
    const token = String(this.env.SHOPEE_READER_TOKEN || "");
    return Boolean(token) && request.headers.get("Authorization") === `Bearer ${token}`;
  }
  erpWritebackAuthorized(request) {
    const token = String(this.env.ERP_SYNC_TOKEN || "");
    return Boolean(token) && request.headers.get("X-Erp-Sync-Token") === token;
  }
  clearErpWriteback(error = "ERP_WRITEBACK_DISCONNECTED") {
    this.erpWritebackSocket = null;
    for (const pending of this.erpWritebackPending.values()) {
      clearTimeout(pending.timer);
      pending.resolve(Response.json({ ok: false, error }, { status: 503 }));
    }
    this.erpWritebackPending.clear();
  }
  acceptErpWriteback(request) {
    if (!this.erpWritebackAuthorized(request)) return new Response("Unauthorized", { status: 401 });
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.erpWritebackSocket?.close(1012, "Replaced by a new ERP client");
    this.clearErpWriteback("ERP_WRITEBACK_REPLACED");
    this.erpWritebackSocket = server;
    server.accept();
    server.addEventListener("message", (event) => this.handleErpWritebackMessage(event));
    server.addEventListener("close", () => {
      if (this.erpWritebackSocket === server) this.clearErpWriteback();
    });
    server.addEventListener("error", () => {
      if (this.erpWritebackSocket === server) this.clearErpWriteback();
    });
    return new Response(null, { status: 101, webSocket: client });
  }
  handleErpWritebackMessage(event) {
    let message;
    try {
      message = JSON.parse(String(event.data || ""));
    } catch {
      return;
    }
    const pending = this.erpWritebackPending.get(String(message?.id || ""));
    if (!pending) return;
    clearTimeout(pending.timer);
    this.erpWritebackPending.delete(String(message.id));
    pending.resolve(Response.json(message, { status: message.ok ? 200 : 503 }));
  }
  dispatchErpWritebackJob(request) {
    if (!this.erpWritebackSocket || this.erpWritebackSocket.readyState !== WebSocket.OPEN) {
      return Response.json({ ok: false, error: "ERP_WRITEBACK_OFFLINE" }, { status: 503 });
    }
    return request.json().then((job) => {
      if (!["plan", "apply", "plan_batch", "apply_batch"].includes(job?.type) || job.type.endsWith("_batch") && !warehousePositionBatchTarget(job.goodId, job.itemUIDs)) {
        return Response.json({ ok: false, error: "ERP_WRITEBACK_JOB_INVALID" }, { status: 400 });
      }
      const id = crypto.randomUUID();
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          this.erpWritebackPending.delete(id);
          resolve(Response.json({ ok: false, error: "ERP_WRITEBACK_TIMEOUT" }, { status: 504 }));
        }, 35e3);
        this.erpWritebackPending.set(id, { resolve, timer });
        try {
          this.erpWritebackSocket.send(JSON.stringify({ ...job, id }));
        } catch {
          clearTimeout(timer);
          this.erpWritebackPending.delete(id);
          resolve(Response.json({ ok: false, error: "ERP_WRITEBACK_SEND_FAILED" }, { status: 503 }));
        }
      });
    });
  }
  async saveErpWritebackConfirmation(request) {
    const pending = await request.json();
    const batch = pending?.scope === "all_variants";
    const batchTarget = batch ? warehousePositionBatchTarget(
      pending.goodId,
      Array.isArray(pending.items) ? pending.items.map((item) => item?.itemUID) : null
    ) : null;
    if (!/^[0-9a-f-]{36}$/u.test(String(pending?.id || "")) || !/^[0-9a-f]{64}$/u.test(String(pending?.expectedProductSha256 || "")) || !/^[0-9a-f]{64}$/u.test(String(pending?.actorHash || "")) || !pending?.goodId || !pending?.newLocation || (batch ? !warehousePositionBatchRowsValid(pending.items, batchTarget, pending.newLocation) : !pending?.itemUID) || !Number.isFinite(pending.createdAt) || !Number.isFinite(pending.expiresAt) || pending.expiresAt - pending.createdAt !== warehousePositionWriteConfirmTtlMs) {
      return Response.json({ saved: false }, { status: 400 });
    }
    await this.storage.put("erp-writeback-confirmation", pending);
    return Response.json({ saved: true });
  }
  async takeErpWritebackConfirmation(request) {
    const { id, now, cancel } = await request.json();
    const result = await this.storage.transaction(async (txn) => {
      const pending = await txn.get("erp-writeback-confirmation");
      if (!pending || pending.id !== id) return null;
      await txn.delete("erp-writeback-confirmation");
      if (cancel || Number(now) > Number(pending.expiresAt) || Number(now) < Number(pending.createdAt)) return null;
      return pending;
    });
    return Response.json({ found: Boolean(result), pending: result });
  }
  clearReader(error = "SHOPEE_READER_DISCONNECTED") {
    this.readerSocket = null;
    this.readerHello = null;
    for (const pending of this.readerPending.values()) {
      clearTimeout(pending.timer);
      pending.resolve(Response.json({ ok: false, error }, { status: 503 }));
    }
    this.readerPending.clear();
  }
  clearReaderIfCurrent(socket, error = "SHOPEE_READER_DISCONNECTED") {
    if (this.readerSocket !== socket) return;
    this.clearReader(error);
  }
  acceptReader(request) {
    if (!this.readerAuthorized(request)) return new Response("Unauthorized", { status: 401 });
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.readerSocket?.close(1012, "Replaced by a new reader connection");
    this.clearReader("SHOPEE_READER_REPLACED");
    this.readerSocket = server;
    server.accept();
    server.addEventListener("message", (event) => this.handleReaderMessage(event));
    server.addEventListener("close", () => this.clearReaderIfCurrent(server));
    server.addEventListener("error", () => this.clearReaderIfCurrent(server));
    return new Response(null, { status: 101, webSocket: client });
  }
  handleReaderMessage(event) {
    let message;
    try {
      message = JSON.parse(String(event.data || ""));
    } catch {
      return;
    }
    if (message?.type === "hello") {
      this.readerHello = { receivedAt: Date.now(), browser: message.browser || null };
      return;
    }
    if (!message?.id) return;
    const pending = this.readerPending.get(message.id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.readerPending.delete(message.id);
    pending.resolve(Response.json(message, { status: message.ok ? 200 : 503 }));
  }
  dispatchReaderJob(payload, timeoutMs = 35e3) {
    if (!this.readerSocket || this.readerSocket.readyState !== WebSocket.OPEN) {
      return Response.json({ ok: false, error: "SHOPEE_READER_OFFLINE" }, { status: 503 });
    }
    const id = crypto.randomUUID();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.readerPending.delete(id);
        resolve(Response.json({ ok: false, error: "SHOPEE_READER_TIMEOUT" }, { status: 504 }));
      }, Math.min(45e3, Math.max(1e3, Number(timeoutMs) || 35e3)));
      this.readerPending.set(id, { resolve, timer });
      try {
        this.readerSocket.send(JSON.stringify({ ...payload, id }));
      } catch {
        clearTimeout(timer);
        this.readerPending.delete(id);
        resolve(Response.json({ ok: false, error: "SHOPEE_READER_SEND_FAILED" }, { status: 503 }));
      }
    });
  }
  extractWithReader(request) {
    return request.json().then(({ url }) => this.dispatchReaderJob({ type: "extract", url }, 35e3));
  }
  async cacheNasImage(request) {
    const { sku: rawSku } = await request.json();
    const sku = normalizeWarehouseSku(rawSku);
    if (!isNasLocalImageSku(sku)) {
      return Response.json({ ok: false, error: "NAS_IMAGE_SKU_INVALID" }, { status: 400 });
    }
    let cached = await this.warehouseImageCacheRecord(sku);
    if (!cached?.imageUrl) cached = await this.warehouseImageObjectRecord(sku);
    if (cached?.source === "nas" && normalizeShopeeImageUrl(cached.imageUrl)) {
      return Response.json({ ok: true, item: cached, cached: true });
    }
    const readerResponse = await this.dispatchReaderJob({ type: "local-image", sku }, 35e3);
    let result = null;
    try {
      result = await readerResponse.json();
    } catch {
    }
    if (!readerResponse.ok || !result?.ok || !normalizeShopeeImageUrl(result?.image?.imageUrl)) {
      return Response.json(
        { ok: false, error: String(result?.error || `NAS_IMAGE_READER_HTTP_${readerResponse.status}`).slice(0, 160) },
        { status: readerResponse.status || 503 }
      );
    }
    const record = {
      sku,
      productId: `nas:${sku}`,
      productUrl: "",
      imageUrl: result.image.imageUrl,
      cachedAt: Number(result.image.cachedAt) || Date.now(),
      contentType: String(result.image.contentType || "image/jpeg").slice(0, 80),
      source: "nas",
      fileName: String(result.image.fileName || "").slice(0, 300),
      folderName: String(result.image.folderName || "").slice(0, 300),
      sourceWidth: Number(result.image.sourceWidth) || 0,
      sourceHeight: Number(result.image.sourceHeight) || 0,
      candidateCount: Number(result.image.candidateCount) || 0,
      score: Number(result.image.score) || 0
    };
    await this.putWarehouseImageCacheRecord(record);
    return Response.json({ ok: true, item: record, cached: false });
  }
  async addScheduleItems(request) {
    const body = await request.json();
    const pendingValue = await this.storage.get("schedule-pending");
    const pending = Array.isArray(pendingValue) ? pendingValue : [];
    const existing = new Set(pending.map((item) => item.productUrl));
    const added = [];
    let duplicateCount = 0;
    let fullCount = 0;
    for (const rawItem of Array.isArray(body?.items) ? body.items.slice(0, 50) : []) {
      const productUrl = String(rawItem?.productUrl || "").slice(0, 500);
      const productName = String(rawItem?.productName || "\u8766\u76AE\u5546\u54C1").replace(/\s+/g, " ").trim().slice(0, 160);
      if (!productUrl) continue;
      if (existing.has(productUrl)) {
        duplicateCount += 1;
        continue;
      }
      if (pending.length + added.length >= 100) {
        fullCount += 1;
        continue;
      }
      existing.add(productUrl);
      added.push({
        productUrl,
        productName: productName || "\u8766\u76AE\u5546\u54C1",
        addedAt: Number(body?.addedAt) || Date.now(),
        addedBy: String(body?.addedBy || "").slice(0, 120)
      });
    }
    const updated = [...pending, ...added];
    if (added.length) await this.storage.put("schedule-pending", updated);
    return Response.json({ added, duplicateCount, fullCount, pendingCount: updated.length });
  }
  async listScheduleItems() {
    const pending = await this.storage.get("schedule-pending");
    const completed = await this.storage.get("schedule-completed");
    return Response.json({
      pending: Array.isArray(pending) ? pending : [],
      completed: Array.isArray(completed) ? completed : []
    });
  }
  async importScheduleItems(request) {
    const body = await request.json();
    const sourceScope = String(body?.sourceScope || "").slice(0, 200);
    const importedValue = await this.storage.get("schedule-imported-scopes");
    const importedScopes = Array.isArray(importedValue) ? importedValue : [];
    if (sourceScope && importedScopes.includes(sourceScope)) {
      return Response.json({ imported: false, alreadyImported: true });
    }
    const pendingValue = await this.storage.get("schedule-pending");
    const completedValue = await this.storage.get("schedule-completed");
    const pending = Array.isArray(pendingValue) ? pendingValue : [];
    const completed = Array.isArray(completedValue) ? completedValue : [];
    const pendingUrls = new Set(pending.map((item) => item.productUrl));
    let pendingImported = 0;
    for (const item of Array.isArray(body?.pending) ? body.pending : []) {
      const productUrl = String(item?.productUrl || "").slice(0, 500);
      if (!productUrl || pendingUrls.has(productUrl) || pending.length >= 100) continue;
      pendingUrls.add(productUrl);
      pending.push({
        productUrl,
        productName: String(item?.productName || "\u8766\u76AE\u5546\u54C1").slice(0, 160),
        addedAt: Number(item?.addedAt) || Date.now(),
        addedBy: String(item?.addedBy || "").slice(0, 120)
      });
      pendingImported += 1;
    }
    const completedKeys = new Set(completed.map((item) => `${item.productUrl}|${Number(item.completedAt) || 0}`));
    let completedImported = 0;
    for (const item of Array.isArray(body?.completed) ? body.completed : []) {
      const productUrl = String(item?.productUrl || "").slice(0, 500);
      const completedAt = Number(item?.completedAt) || 0;
      const key = `${productUrl}|${completedAt}`;
      if (!productUrl || completedKeys.has(key)) continue;
      completedKeys.add(key);
      completed.push({
        ...item,
        productUrl,
        productName: String(item?.productName || "\u8766\u76AE\u5546\u54C1").slice(0, 160),
        completedAt: completedAt || Date.now(),
        completedBy: String(item?.completedBy || "\u7FA4\u7D44\u6210\u54E1").slice(0, 120),
        completedById: String(item?.completedById || "").slice(0, 80)
      });
      completedImported += 1;
    }
    completed.sort((a, b) => Number(b.completedAt) - Number(a.completedAt));
    await this.storage.put("schedule-pending", pending);
    await this.storage.put("schedule-completed", completed.slice(0, 200));
    if (sourceScope) {
      await this.storage.put("schedule-imported-scopes", [...importedScopes, sourceScope].slice(-1e3));
    }
    return Response.json({ imported: true, alreadyImported: false, pendingImported, completedImported });
  }
  async getScheduleItem(request) {
    const { index } = await request.json();
    const pending = await this.storage.get("schedule-pending");
    const items = Array.isArray(pending) ? pending : [];
    const selectedIndex = Number.parseInt(index, 10) - 1;
    return Response.json({
      item: selectedIndex >= 0 && selectedIndex < items.length ? items[selectedIndex] : null,
      pendingCount: items.length
    });
  }
  async acquireScheduleGeneration(request) {
    const body = await request.json();
    const key = "schedule-generation-lock";
    const now = Date.now();
    const current = await this.storage.get(key);
    if (current?.expiresAt > now) {
      return Response.json({
        acquired: false,
        retryAfterSeconds: Math.max(1, Math.ceil((current.expiresAt - now) / 1e3))
      });
    }
    const token = crypto.randomUUID();
    const ttlMs = Math.min(6e4, Math.max(5e3, Number(body?.ttlMs) || 3e4));
    await this.storage.put(key, { token, expiresAt: now + ttlMs });
    return Response.json({ acquired: true, token });
  }
  async releaseScheduleGeneration(request) {
    const body = await request.json();
    const key = "schedule-generation-lock";
    const current = await this.storage.get(key);
    if (current?.token && current.token === String(body?.token || "")) {
      await this.storage.delete(key);
      return Response.json({ released: true });
    }
    return Response.json({ released: false });
  }
  async completeScheduleItem(request) {
    const body = await request.json();
    const productUrl = String(body?.productUrl || "");
    const pendingValue = await this.storage.get("schedule-pending");
    const pending = Array.isArray(pendingValue) ? pendingValue : [];
    const selectedIndex = pending.findIndex((item) => item.productUrl === productUrl);
    if (selectedIndex < 0) {
      return Response.json({ completed: null, pendingCount: pending.length, alreadyCompleted: true });
    }
    const [selected] = pending.splice(selectedIndex, 1);
    const completedValue = await this.storage.get("schedule-completed");
    const completed = Array.isArray(completedValue) ? completedValue : [];
    const record = {
      ...selected,
      productName: String(body?.productName || selected.productName || "\u8766\u76AE\u5546\u54C1").slice(0, 160),
      completedAt: Number(body?.completedAt) || Date.now(),
      completedBy: String(body?.completedBy || "\u7FA4\u7D44\u6210\u54E1").slice(0, 120),
      completedById: String(body?.completedById || "").slice(0, 80)
    };
    await this.storage.put("schedule-pending", pending);
    await this.storage.put("schedule-completed", [record, ...completed].slice(0, 200));
    return Response.json({ completed: record, pendingCount: pending.length, alreadyCompleted: false });
  }
  async reopenScheduleItem(request) {
    const { index } = await request.json();
    const pendingValue = await this.storage.get("schedule-pending");
    const completedValue = await this.storage.get("schedule-completed");
    const pending = Array.isArray(pendingValue) ? pendingValue : [];
    const completed = Array.isArray(completedValue) ? completedValue : [];
    const selectedIndex = Number.parseInt(index, 10) - 1;
    if (selectedIndex < 0 || selectedIndex >= completed.length) {
      return Response.json({
        restored: null,
        pendingCount: pending.length,
        completedCount: completed.length,
        full: false
      });
    }
    const selected = completed[selectedIndex];
    const alreadyPending = pending.some((item) => item.productUrl === selected.productUrl);
    if (!alreadyPending && pending.length >= 100) {
      return Response.json({
        restored: null,
        pendingCount: pending.length,
        completedCount: completed.length,
        full: true
      });
    }
    completed.splice(selectedIndex, 1);
    const restored = {
      productUrl: selected.productUrl,
      productName: selected.productName || "\u8766\u76AE\u5546\u54C1",
      addedAt: Date.now(),
      addedBy: selected.completedById || selected.addedBy || ""
    };
    if (!alreadyPending) pending.push(restored);
    await this.storage.put("schedule-pending", pending);
    await this.storage.put("schedule-completed", completed);
    return Response.json({
      restored,
      pendingCount: pending.length,
      completedCount: completed.length,
      alreadyPending,
      full: false
    });
  }
  warehouseImageCacheKey(sku) {
    return `warehouse-image-cache:${warehouseLocationBucket(sku, warehouseImageCacheBucketCount)}`;
  }
  async warehouseImageCacheRecord(sku) {
    const bucket = await this.storage.get(this.warehouseImageCacheKey(sku));
    return bucket && typeof bucket === "object" ? bucket[normalizeWarehouseSku(sku)] || null : null;
  }
  async putWarehouseImageCacheRecord(record) {
    const sku = normalizeWarehouseSku(record?.sku);
    if (!sku) return;
    const key = this.warehouseImageCacheKey(sku);
    const current = await this.storage.get(key);
    const bucket = current && typeof current === "object" ? current : {};
    bucket[sku] = { ...record, sku };
    await this.storage.put(key, bucket);
  }
  async warehouseImageObjectRecord(rawSku) {
    const sku = normalizeWarehouseSku(rawSku);
    if (!isNasLocalImageSku(sku) || !this.env.PRODUCT_IMAGES) return null;
    const object = await this.env.PRODUCT_IMAGES.getWithMetadata(warehouseImageObjectKey(sku), {
      type: "arrayBuffer",
      cacheTtl: 300
    });
    if (!object?.value) return null;
    const metadata = object.metadata && typeof object.metadata === "object" ? object.metadata : {};
    const cachedAt = Math.max(0, Number(metadata.cachedAt) || Date.now());
    const record = {
      sku,
      productId: String(metadata.productId || `nas:${sku}`).slice(0, 120),
      productUrl: "",
      imageUrl: warehouseImagePublicUrl(sku, cachedAt),
      cachedAt,
      contentType: String(metadata.contentType || "image/jpeg").slice(0, 80),
      source: "nas",
      fileName: String(metadata.fileName || "").slice(0, 300),
      folderName: String(metadata.folderName || "").slice(0, 300),
      sourceWidth: Math.max(0, Number(metadata.width) || 0),
      sourceHeight: Math.max(0, Number(metadata.height) || 0),
      candidateCount: Math.max(0, Number(metadata.candidateCount) || 0),
      score: Number(metadata.score) || 0
    };
    await this.putWarehouseImageCacheRecord(record);
    return record;
  }
  async recordNasImage(request) {
    const raw = await request.json();
    const sku = normalizeWarehouseSku(raw?.sku);
    const imageUrl = normalizeShopeeImageUrl(raw?.imageUrl);
    if (!isNasLocalImageSku(sku) || !imageUrl) {
      return Response.json({ ok: false, error: "NAS_IMAGE_RECORD_INVALID" }, { status: 400 });
    }
    const record = {
      sku,
      productId: `nas:${sku}`,
      productUrl: "",
      imageUrl,
      cachedAt: Math.max(0, Number(raw?.cachedAt) || Date.now()),
      contentType: String(raw?.contentType || "image/jpeg").slice(0, 80),
      source: "nas",
      fileName: String(raw?.fileName || "").slice(0, 300),
      folderName: String(raw?.folderName || "").slice(0, 300),
      sourceWidth: Math.max(0, Number(raw?.sourceWidth) || 0),
      sourceHeight: Math.max(0, Number(raw?.sourceHeight) || 0),
      candidateCount: Math.max(0, Number(raw?.candidateCount) || 0),
      score: Number(raw?.score) || 0
    };
    await this.putWarehouseImageCacheRecord(record);
    return Response.json({ ok: true, item: record });
  }
  async localWarehouseImageSkus() {
    const metadata = await loadSnapshot(this.storage, await this.storage.get("warehouse-location-active"));
    if (!metadata?.version) {
      return Response.json({ ok: true, skus: [], itemCount: 0, metadata: metadata || null });
    }
    const skus = /* @__PURE__ */ new Set();
    const searchChunkCount = Math.min(1e3, Math.max(0, Number(metadata.searchChunkCount) || 0));
    if (searchChunkCount) {
      const chunks = await Promise.all(Array.from(
        { length: searchChunkCount },
        (_, index) => readSnapshotBlock(this.storage, metadata, `warehouse-location-search:${metadata.version}:${index}`)
      ));
      for (const chunk of chunks) {
        for (const item of Array.isArray(chunk) ? chunk : []) {
          const sku = normalizeWarehouseSku(item?.sku);
          if (isNasLocalImageSku(sku)) skus.add(sku);
        }
      }
    } else {
      const bucketCount = Math.min(256, Math.max(1, Number(metadata.bucketCount) || 64));
      const buckets = await Promise.all(Array.from(
        { length: bucketCount },
        (_, index) => readSnapshotBlock(this.storage, metadata, `warehouse-location:${metadata.version}:${index}`)
      ));
      for (const bucket of buckets) {
        for (const item of Object.values(bucket && typeof bucket === "object" ? bucket : {})) {
          const sku = normalizeWarehouseSku(item?.sku);
          if (isNasLocalImageSku(sku)) skus.add(sku);
        }
      }
    }
    return Response.json({
      ok: true,
      skus: [...skus].sort(),
      itemCount: skus.size,
      sourceVersion: metadata.version,
      metadata
    });
  }
  async reconcileNasImagePrecache(request) {
    const body = await request.json();
    const skus = [...new Set((Array.isArray(body?.skus) ? body.skus : []).slice(0, 2e4).map(normalizeWarehouseSku).filter(isNasLocalImageSku))].sort();
    const current = await this.storage.get("nas-image-precache-queue");
    const currentActive = current?.version && Number(current.nextIndex) < Number(current.itemCount);
    if (!body?.force && currentActive) {
      return Response.json({ ok: true, alreadyRunning: true, queue: current });
    }
    if (!body?.force && current?.sourceVersion && current.sourceVersion === String(body?.sourceVersion || "")) {
      return Response.json({ ok: true, alreadyCompleted: true, queue: current });
    }
    const version = crypto.randomUUID();
    const chunkCount = Math.ceil(skus.length / nasImagePrecacheChunkSize);
    for (let index = 0; index < chunkCount; index += 1) {
      await this.storage.put(
        `nas-image-precache-queue:${version}:${index}`,
        skus.slice(index * nasImagePrecacheChunkSize, (index + 1) * nasImagePrecacheChunkSize)
      );
    }
    const queue = {
      version,
      sourceVersion: String(body?.sourceVersion || "").slice(0, 100),
      itemCount: skus.length,
      chunkCount,
      nextIndex: 0,
      cachedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      completedAt: ""
    };
    await this.storage.put("nas-image-precache-queue", queue);
    await this.storage.delete("nas-image-precache-runtime");
    if (current?.version && current.version !== version) {
      const previousChunkCount = Math.min(1e3, Math.max(0, Number(current.chunkCount) || 0));
      for (let index = 0; index < previousChunkCount; index += 1) {
        await this.storage.delete(`nas-image-precache-queue:${current.version}:${index}`);
      }
    }
    if (skus.length) await this.scheduleWarehouseImageAlarm(1e3, true);
    return Response.json({ ok: true, queued: skus.length, chunkCount, queue });
  }
  async currentNasImagePrecacheSku() {
    const queue = await this.storage.get("nas-image-precache-queue");
    if (!queue?.version || Number(queue.nextIndex) >= Number(queue.itemCount)) {
      return { sku: "", queue };
    }
    const index = Math.max(0, Number(queue.nextIndex) || 0);
    const chunkIndex = Math.floor(index / nasImagePrecacheChunkSize);
    const chunk = await this.storage.get(`nas-image-precache-queue:${queue.version}:${chunkIndex}`);
    return {
      sku: normalizeWarehouseSku(Array.isArray(chunk) ? chunk[index % nasImagePrecacheChunkSize] : ""),
      queue,
      index
    };
  }
  async advanceNasImagePrecache(current, outcome) {
    const latest = await this.storage.get("nas-image-precache-queue");
    if (latest?.version !== current.queue?.version || Number(latest.nextIndex) !== current.index) return;
    latest.nextIndex = current.index + 1;
    if (outcome === "cached") latest.cachedCount = Number(latest.cachedCount) + 1;
    if (outcome === "skipped") latest.skippedCount = Number(latest.skippedCount) + 1;
    if (outcome === "failed") latest.failedCount = Number(latest.failedCount) + 1;
    latest.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (latest.nextIndex >= Number(latest.itemCount)) latest.completedAt = latest.updatedAt;
    await this.storage.put("nas-image-precache-queue", latest);
  }
  async processNasImagePrecacheQueue() {
    let current = await this.currentNasImagePrecacheSku();
    if (!current.sku) return;
    for (let skipped = 0; skipped < 20 && current.sku; skipped += 1) {
      const cached = await this.warehouseImageObjectRecord(current.sku);
      if (!cached?.imageUrl) break;
      await this.advanceNasImagePrecache(current, "skipped");
      current = await this.currentNasImagePrecacheSku();
    }
    if (!current.sku) return;
    const runtimeValue = await this.storage.get("nas-image-precache-runtime");
    const runtime = runtimeValue && typeof runtimeValue === "object" ? runtimeValue : {};
    if (!this.readerSocket || this.readerSocket.readyState !== WebSocket.OPEN) {
      runtime.lastError = "SHOPEE_READER_OFFLINE";
      runtime.lastFailureAt = (/* @__PURE__ */ new Date()).toISOString();
      await this.storage.put("nas-image-precache-runtime", runtime);
      await this.scheduleWarehouseImageAlarm(nasImagePrecacheOfflineDelayMs, true);
      return;
    }
    try {
      const response = await this.cacheNasImage(new Request("https://shopee-reader/warehouse-images/cache-nas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku: current.sku })
      }));
      let result = null;
      try {
        result = await response.json();
      } catch {
      }
      if (!response.ok || !result?.ok || !normalizeShopeeImageUrl(result?.item?.imageUrl)) {
        throw new Error(String(result?.error || `NAS_IMAGE_CACHE_HTTP_${response.status}`).slice(0, 160));
      }
      await this.advanceNasImagePrecache(current, "cached");
      runtime.lastSku = current.sku;
      runtime.lastSuccessAt = (/* @__PURE__ */ new Date()).toISOString();
      runtime.lastError = "";
      await this.storage.put("nas-image-precache-runtime", runtime);
      await this.scheduleWarehouseImageAlarm(warehouseImageDelay(), true);
    } catch (error) {
      const message = String(error?.message || error).slice(0, 200);
      runtime.lastSku = current.sku;
      runtime.lastError = message;
      runtime.lastFailureAt = (/* @__PURE__ */ new Date()).toISOString();
      await this.storage.put("nas-image-precache-runtime", runtime);
      if (/SHOPEE_READER_(?:OFFLINE|TIMEOUT|DISCONNECTED|SEND_FAILED)/u.test(message)) {
        await this.scheduleWarehouseImageAlarm(nasImagePrecacheOfflineDelayMs, true);
        return;
      }
      await this.advanceNasImagePrecache(current, "failed");
      console.error("NAS_IMAGE_PRECACHE", current.sku, message);
      await this.scheduleWarehouseImageAlarm(warehouseImageDelay(), true);
    }
  }
  async nasImagePrecacheStatus() {
    const [queue, runtime] = await Promise.all([
      this.storage.get("nas-image-precache-queue"),
      this.storage.get("nas-image-precache-runtime")
    ]);
    return Response.json({ ok: true, queue: queue || null, runtime: runtime || null });
  }
  async scheduleWarehouseImageAlarm(delayMs, force = false) {
    if (typeof this.storage.setAlarm !== "function") return;
    const target = Date.now() + Math.max(1e3, Number(delayMs) || warehouseImageFetchMinDelayMs);
    if (!force && typeof this.storage.getAlarm === "function") {
      const current = await this.storage.getAlarm();
      if (current && Number(current) <= target) return;
    }
    await this.storage.setAlarm(target);
  }
  async reconcileWarehouseImages(request) {
    const body = await request.json();
    const candidatesBySku = /* @__PURE__ */ new Map();
    for (const raw of Array.isArray(body?.candidates) ? body.candidates.slice(0, 2e4) : []) {
      const candidate = normalizeWarehouseImageCandidate(raw);
      if (candidate) candidatesBySku.set(candidate.sku, candidate);
    }
    const candidates = [...candidatesBySku.values()];
    const previous = await this.storage.get("warehouse-image-queue");
    const version = crypto.randomUUID();
    const chunkCount = Math.ceil(candidates.length / warehouseImageQueueChunkSize);
    for (let index = 0; index < chunkCount; index += 1) {
      await this.storage.put(
        `warehouse-image-queue:${version}:${index}`,
        candidates.slice(index * warehouseImageQueueChunkSize, (index + 1) * warehouseImageQueueChunkSize)
      );
    }
    const metadata = {
      version,
      itemCount: candidates.length,
      chunkCount,
      nextIndex: 0,
      cachedCount: 0,
      failedCount: 0,
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await this.storage.put("warehouse-image-queue", metadata);
    if (previous?.version && previous.version !== version) {
      const previousChunkCount = Math.min(1e3, Math.max(0, Number(previous.chunkCount) || 0));
      for (let index = 0; index < previousChunkCount; index += 1) {
        await this.storage.delete(`warehouse-image-queue:${previous.version}:${index}`);
      }
    }
    if (candidates.length) {
      await this.scheduleWarehouseImageAlarm(warehouseImageDelay(), false);
    }
    return Response.json({ ok: true, queued: candidates.length, chunkCount });
  }
  async enqueueWarehouseImages(request) {
    const body = await request.json();
    const candidatesBySku = /* @__PURE__ */ new Map();
    for (const raw of Array.isArray(body?.candidates) ? body.candidates.slice(0, 50) : []) {
      const candidate = normalizeWarehouseImageCandidate(raw);
      if (candidate) candidatesBySku.set(candidate.sku, candidate);
    }
    const existingValue = await this.storage.get("warehouse-image-priority");
    const existing = Array.isArray(existingValue) ? existingValue : [];
    const queued = new Map(existing.map((item) => [`${item.sku}:${item.productId}`, item]));
    let added = 0;
    for (const candidate of candidatesBySku.values()) {
      const cached = await this.warehouseImageCacheRecord(candidate.sku);
      if (cached?.productId === candidate.productId && normalizeShopeeImageUrl(cached.imageUrl)) continue;
      const key = `${candidate.sku}:${candidate.productId}`;
      if (!queued.has(key)) added += 1;
      queued.set(key, candidate);
    }
    const priority = [...queued.values()].slice(-100);
    if (added) {
      await this.storage.put("warehouse-image-priority", priority);
      await this.scheduleWarehouseImageAlarm(warehouseImageDelay(), false);
    }
    return Response.json({ ok: true, added, pending: priority.length });
  }
  async downloadWarehouseImage(candidate) {
    if (!this.env?.PRODUCT_IMAGES) throw new Error("PRODUCT_IMAGE_STORAGE_NOT_CONFIGURED");
    let sourceImageUrl = normalizeShopeeImageUrl(candidate.sourceImageUrl);
    if (!sourceImageUrl) {
      const product = await withAbortTimeout(
        (signal) => fetchFromNasReader(candidate.productUrl, this.env, signal),
        35e3,
        "NAS \u5546\u54C1\u5716\u7247\u8B80\u53D6\u903E\u6642"
      );
      sourceImageUrl = normalizeShopeeImageUrl(product.imageUrl);
    }
    if (!sourceImageUrl) throw new Error("SHOPEE_IMAGE_NOT_FOUND");
    const image = await withAbortTimeout(async (signal) => {
      const response = await fetch(sourceImageUrl, {
        headers: { "Accept": "image/avif,image/webp,image/*,*/*;q=0.8" },
        redirect: "follow",
        signal
      });
      if (!response.ok) throw new Error(`IMAGE_HTTP_${response.status}`);
      const contentType = String(response.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
      if (!contentType.startsWith("image/")) throw new Error("IMAGE_CONTENT_TYPE_INVALID");
      const declaredSize = Number(response.headers.get("Content-Length")) || 0;
      if (declaredSize > warehouseImageMaxBytes) throw new Error("IMAGE_TOO_LARGE");
      const bytes = await response.arrayBuffer();
      if (!bytes.byteLength || bytes.byteLength > warehouseImageMaxBytes) throw new Error("IMAGE_SIZE_INVALID");
      return { bytes, contentType };
    }, 2e4, "\u5546\u54C1\u5716\u7247\u4E0B\u8F09\u903E\u6642");
    const cachedAt = Date.now();
    await this.env.PRODUCT_IMAGES.put(warehouseImageObjectKey(candidate.sku), image.bytes, {
      metadata: {
        contentType: image.contentType,
        sku: candidate.sku,
        productId: candidate.productId,
        cachedAt: String(cachedAt)
      }
    });
    const record = {
      sku: candidate.sku,
      productId: candidate.productId,
      productUrl: candidate.productUrl,
      imageUrl: warehouseImagePublicUrl(candidate.sku, cachedAt),
      cachedAt
    };
    await this.putWarehouseImageCacheRecord(record);
    return record;
  }
  async currentWarehouseImageCandidate() {
    const priorityValue = await this.storage.get("warehouse-image-priority");
    const priority = Array.isArray(priorityValue) ? priorityValue : [];
    if (priority.length) return { candidate: priority[0], source: "priority", priority };
    const metadata = await this.storage.get("warehouse-image-queue");
    if (!metadata?.version || Number(metadata.nextIndex) >= Number(metadata.itemCount)) {
      return { candidate: null, source: "none", metadata };
    }
    const index = Math.max(0, Number(metadata.nextIndex) || 0);
    const chunkIndex = Math.floor(index / warehouseImageQueueChunkSize);
    const chunk = await this.storage.get(`warehouse-image-queue:${metadata.version}:${chunkIndex}`);
    const candidate = Array.isArray(chunk) ? chunk[index % warehouseImageQueueChunkSize] || null : null;
    return { candidate, source: "queue", metadata, index };
  }
  async advanceWarehouseImageCandidate(current, cached, failed = false) {
    if (current.source === "priority") {
      const latestValue = await this.storage.get("warehouse-image-priority");
      const latest2 = Array.isArray(latestValue) ? latestValue : [];
      const first = latest2[0];
      if (first?.sku === current.candidate.sku && first?.productId === current.candidate.productId) {
        latest2.shift();
        if (latest2.length) await this.storage.put("warehouse-image-priority", latest2);
        else await this.storage.delete("warehouse-image-priority");
      }
      return;
    }
    if (current.source !== "queue") return;
    const latest = await this.storage.get("warehouse-image-queue");
    if (latest?.version !== current.metadata?.version || Number(latest.nextIndex) !== current.index) return;
    latest.nextIndex = current.index + 1;
    latest.cachedCount = Number(latest.cachedCount) + (cached ? 1 : 0);
    latest.failedCount = Number(latest.failedCount) + (failed ? 1 : 0);
    latest.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await this.storage.put("warehouse-image-queue", latest);
  }
  async processWarehouseImageQueue() {
    const now = Date.now();
    const today = taipeiDayKey(now);
    const rateValue = await this.storage.get("warehouse-image-rate");
    const rate = rateValue?.day === today ? rateValue : { day: today, attempts: 0 };
    if (Number(rate.attempts) >= warehouseImageFetchDailyLimit) {
      await this.scheduleWarehouseImageAlarm(
        Math.max(6e4, nextTaipeiDayStart(now) - now + warehouseImageDelay(5 * 6e4, 15 * 6e4)),
        true
      );
      return;
    }
    let current;
    for (let skipped = 0; skipped < 500; skipped += 1) {
      current = await this.currentWarehouseImageCandidate();
      if (!current.candidate) return;
      const cached = await this.warehouseImageCacheRecord(current.candidate.sku);
      if (cached?.productId !== current.candidate.productId || !normalizeShopeeImageUrl(cached.imageUrl)) break;
      await this.advanceWarehouseImageCandidate(current, false);
      current = null;
    }
    if (!current?.candidate) {
      await this.scheduleWarehouseImageAlarm(1e3, true);
      return;
    }
    rate.attempts = Number(rate.attempts) + 1;
    rate.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await this.storage.put("warehouse-image-rate", rate);
    const runtimeValue = await this.storage.get("warehouse-image-runtime");
    const runtime = runtimeValue && typeof runtimeValue === "object" ? runtimeValue : {};
    try {
      await this.downloadWarehouseImage(current.candidate);
      await this.advanceWarehouseImageCandidate(current, true);
      runtime.consecutiveFailures = 0;
      runtime.failureKey = "";
      runtime.candidateFailures = 0;
      runtime.lastSuccessAt = (/* @__PURE__ */ new Date()).toISOString();
      runtime.lastError = "";
      await this.storage.put("warehouse-image-runtime", runtime);
      const delay = rate.attempts % warehouseImageFetchBatchSize === 0 ? warehouseImageFetchBatchPauseMs : warehouseImageDelay();
      await this.scheduleWarehouseImageAlarm(delay, true);
    } catch (error) {
      const failureKey = `${current.candidate.sku}:${current.candidate.productId}`;
      runtime.candidateFailures = runtime.failureKey === failureKey ? Math.min(3, Number(runtime.candidateFailures) + 1) : 1;
      runtime.failureKey = failureKey;
      runtime.consecutiveFailures = Math.min(8, Number(runtime.consecutiveFailures) + 1);
      runtime.lastFailureAt = (/* @__PURE__ */ new Date()).toISOString();
      runtime.lastError = String(error?.message || error).slice(0, 200);
      if (runtime.candidateFailures >= 3) {
        await this.advanceWarehouseImageCandidate(current, false, true);
        runtime.failureKey = "";
        runtime.candidateFailures = 0;
        runtime.consecutiveFailures = 0;
      }
      await this.storage.put("warehouse-image-runtime", runtime);
      const delay = Math.min(
        6 * 60 * 6e4,
        warehouseImageFailureBaseDelayMs * 2 ** Math.max(0, runtime.consecutiveFailures - 1)
      ) + warehouseImageDelay(6e4, 5 * 6e4);
      console.error("WAREHOUSE_IMAGE_CACHE", current.candidate.sku, runtime.lastError);
      await this.scheduleWarehouseImageAlarm(delay, true);
    }
  }
  async warehouseImageStatus() {
    const [queue, priority, rate, runtime] = await Promise.all([
      this.storage.get("warehouse-image-queue"),
      this.storage.get("warehouse-image-priority"),
      this.storage.get("warehouse-image-rate"),
      this.storage.get("warehouse-image-runtime")
    ]);
    return Response.json({
      ok: true,
      queue: queue || null,
      priorityCount: Array.isArray(priority) ? priority.length : 0,
      rate: rate || null,
      runtime: runtime || null
    });
  }
  async alarm() {
    const nasQueue = await this.storage.get("nas-image-precache-queue");
    if (nasQueue?.version && Number(nasQueue.nextIndex) < Number(nasQueue.itemCount)) {
      await this.processNasImagePrecacheQueue();
      return;
    }
    await this.processWarehouseImageQueue();
  }
  async syncWarehouseLocations(request) {
    if (this.warehouseSyncInProgress) return Response.json({ ok: false, error: "LOCATION_SYNC_BUSY" }, { status: 409 });
    this.warehouseSyncInProgress = true;
    try { return await this.publishWarehouseLocations(request); }
    finally { this.warehouseSyncInProgress = false; }
  }
  async publishWarehouseLocations(request) {
    const body = await request.json();
    if (!Array.isArray(body?.items) || !body.items.length) {
      return Response.json({ ok: false, error: "EMPTY_LOCATION_DATA" }, { status: 400 });
    }
    const bucketCount = 64;
    const buckets = Array.from({ length: bucketCount }, () => ({}));
    const reverseMaps = Array.from({ length: warehouseStorageLocationBucketCount }, () => /* @__PURE__ */ new Map());
    const searchItems = [];
    let itemCount = 0;
    for (const rawItem of body.items.slice(0, 2e4).sort((a, b) => String(a?.sku || "").localeCompare(String(b?.sku || "")))) {
      const item = normalizeWarehouseLocationItem(rawItem);
      if (!item) continue;
      buckets[warehouseLocationBucket(item.sku, bucketCount)][item.sku] = item;
      searchItems.push({ sku: item.sku, name: item.name });
      for (const variant of item.variants) {
        const normalizedLocation = normalizeWarehouseStorageLocation(variant.location);
        if (!normalizedLocation) continue;
        const reverseMap = reverseMaps[warehouseLocationBucket(normalizedLocation, warehouseStorageLocationBucketCount)];
        const record = reverseMap.get(normalizedLocation) || {
          location: String(variant.location || normalizedLocation).trim().slice(0, 160) || normalizedLocation,
          rows: []
        };
        record.rows.push(warehouseStorageLocationRow(item, variant));
        reverseMap.set(normalizedLocation, record);
      }
      itemCount += 1;
    }
    if (!itemCount) {
      return Response.json({ ok: false, error: "EMPTY_LOCATION_DATA" }, { status: 400 });
    }
    const previous = await loadSnapshot(this.storage, await this.storage.get("warehouse-location-active"));
    const blocks = [];
    const addBlock = (slot, value) => blocks.push({ slot, value, legacyKey: previous?.version ? legacySnapshotKey(previous, slot) : undefined });
    for (let index = 0; index < bucketCount; index += 1) {
      addBlock(`warehouse-location:${index}`, buckets[index]);
    }
    let locationCount = 0;
    let locatedItemCount = 0;
    const reverseItemChunkCounts = Array.from({ length: warehouseStorageLocationBucketCount }, () => 0);
    for (let index = 0; index < warehouseStorageLocationBucketCount; index += 1) {
      const reverseBucket = {};
      const reverseItems = [];
      for (const [normalizedLocation, rawRecord] of [...reverseMaps[index]].sort(([a], [b]) => a.localeCompare(b))) {
        const record = finalizeWarehouseStorageLocationRecord(rawRecord.location, rawRecord.rows);
        reverseBucket[normalizedLocation] = {
          location: record.location,
          skuCount: record.skuCount,
          itemCount: record.itemCount,
          offset: reverseItems.length
        };
        reverseItems.push(...record.items);
        locationCount += 1;
        locatedItemCount += record.itemCount;
      }
      const itemChunkCount = Math.ceil(reverseItems.length / warehouseStorageLocationIndexChunkSize);
      reverseItemChunkCounts[index] = itemChunkCount;
      for (let chunkIndex = 0; chunkIndex < itemChunkCount; chunkIndex += 1) {
        addBlock(
          `warehouse-location-reverse-items:${index}:${chunkIndex}`,
          reverseItems.slice(
            chunkIndex * warehouseStorageLocationIndexChunkSize,
            (chunkIndex + 1) * warehouseStorageLocationIndexChunkSize
          )
        );
      }
      addBlock(`warehouse-location-reverse:${index}`, reverseBucket);
    }
    const searchChunkSize = 300;
    const searchChunkCount = Math.ceil(searchItems.length / searchChunkSize);
    for (let index = 0; index < searchChunkCount; index += 1) {
      addBlock(
        `warehouse-location-search:${index}`,
        searchItems.slice(index * searchChunkSize, (index + 1) * searchChunkSize)
      );
    }
    const metadata = {
      bucketCount,
      itemCount,
      searchChunkCount,
      reverseBucketCount: warehouseStorageLocationBucketCount,
      reverseItemChunkSize: warehouseStorageLocationIndexChunkSize,
      reverseItemChunkCounts,
      locationCount,
      locatedItemCount,
      warehouseId: Number(body?.warehouseId) || 1,
      warehouseName: String(body?.warehouseName || "\u4E3B\u5009").slice(0, 80),
      updatedAt: String(body?.updatedAt || (/* @__PURE__ */ new Date()).toISOString()).slice(0, 80)
    };
    try {
      const result = await publishSnapshot(this.storage, { activeKey: "warehouse-location-active", metadata, blocks, legacyKeys: warehouseSnapshotKeys });
      logSnapshotSavings("warehouse", result);
      return Response.json({ ok: true, itemCount, locationCount, locatedItemCount, updatedAt: result.metadata.updatedAt, unchanged: !result.changed, syncStats: snapshotSavings(result) });
    } catch (error) {
      console.warn("LOCATION_SNAPSHOT_STORE_FAILED", error?.message);
      return Response.json({ ok: false, error: "LOCATION_SNAPSHOT_STORE_FAILED" }, { status: 503 });
    }
  }

  async syncErpOrders(request) {
    if (this.erpOrderSyncInProgress) {
      return Response.json({ ok: false, error: "ORDER_SYNC_BUSY" }, { status: 409 });
    }
    this.erpOrderSyncInProgress = true;
    try {
      return await this.publishErpOrders(request);
    } finally {
      this.erpOrderSyncInProgress = false;
    }
  }
  async publishErpOrders(request) {
    const body = await request.json();
    if (!Array.isArray(body?.orders)) {
      return Response.json({ ok: false, error: "INVALID_ORDER_DATA" }, { status: 400 });
    }
    if (body.orders.length > 2e4) {
      return Response.json({
        ok: false,
        error: "ORDER_LIMIT_EXCEEDED",
        limit: 2e4,
        received: body.orders.length
      }, { status: 413 });
    }
    if (!body.orders.length) {
      return Response.json({ ok: false, error: "EMPTY_ORDER_DATA" }, { status: 400 });
    }
    const byTransaction = /* @__PURE__ */ new Map();
    for (let index = 0; index < body.orders.length; index += 1) {
      const rawOrder = body.orders[index];
      const order = normalizeErpOrder(rawOrder);
      if (!order) {
        return Response.json({
          ok: false,
          error: "INVALID_ORDER_DATA",
          index
        }, { status: 400 });
      }
      if (order.aliasLimitExceeded) {
        return Response.json({
          ok: false,
          error: "ORDER_ALIAS_LIMIT_EXCEEDED",
          transactionNo: order.transactionNo,
          limit: erpOrderMaxAliases
        }, { status: 413 });
      }
      if (byTransaction.has(order.transactionNo)) {
        return Response.json({
          ok: false,
          error: "DUPLICATE_TRANSACTION",
          transactionNo: order.transactionNo
        }, { status: 409 });
      }
      byTransaction.set(order.transactionNo, order);
    }
    const orders = [...byTransaction.values()].sort(
      (a, b) => a.transactionNo.localeCompare(b.transactionNo, "en", { numeric: true })
    );
    for (const order of orders) {
      const entryBytes = encoder.encode(JSON.stringify({ [order.transactionNo]: order })).byteLength;
      if (entryBytes > erpOrderChunkTargetBytes) {
        return Response.json({
          ok: false,
          error: "ORDER_TOO_LARGE",
          transactionNo: order.transactionNo,
          limitBytes: erpOrderChunkTargetBytes,
          receivedBytes: entryBytes
        }, { status: 413 });
      }
    }
    const chunks = buildErpOrderChunks(orders);
    const chunkByTransaction = /* @__PURE__ */ new Map();
    chunks.forEach((chunk, index) => {
      for (const transactionNo of Object.keys(chunk)) chunkByTransaction.set(transactionNo, index);
    });
    const aliases = Array.from({ length: erpOrderAliasBucketCount }, () => ({}));
    const skuStatusBuckets = Array.from({ length: erpOrderSkuStatusBucketCount }, () => ({}));
    let aliasCount = 0;
    let skuStatusEntryCount = 0;
    for (const order of orders) {
      const chunkIndex = chunkByTransaction.get(order.transactionNo);
      for (const alias of order.aliases) {
        const bucket = aliases[warehouseLocationBucket(alias, erpOrderAliasBucketCount)];
        const existing = bucket[alias];
        if (existing && existing.transactionNo !== order.transactionNo) {
          return Response.json({
            ok: false,
            error: "ORDER_ALIAS_COLLISION",
            alias,
            transactionNos: [existing.transactionNo, order.transactionNo]
          }, { status: 409 });
        }
        if (!existing) aliasCount += 1;
        bucket[alias] = { transactionNo: order.transactionNo, chunkIndex };
      }
      if (erpOrderSkuStatuses.includes(order.status)) {
        const orderSkuKeys = new Set([
          ...Array.isArray(order.items) ? order.items : [],
          ...Array.isArray(order.printableOrders) ? order.printableOrders.flatMap((printable) => Array.isArray(printable?.items) ? printable.items : []) : []
        ].flatMap((item) => erpOrderSkuKeys(item?.sku)));
        for (const sku of orderSkuKeys) {
          const indexKey = erpOrderSkuStatusIndexKey(order.status, sku);
          const bucket = skuStatusBuckets[warehouseLocationBucket(indexKey, erpOrderSkuStatusBucketCount)];
          const locations = Array.isArray(bucket[indexKey]) ? bucket[indexKey] : [];
          locations.push([order.transactionNo, chunkIndex]);
          bucket[indexKey] = locations;
          skuStatusEntryCount += 1;
        }
      }
    }
    let aliasChunks, skuStatusChunks;
    try {
      aliasChunks = buildErpOrderIndexChunks(aliases);
      skuStatusChunks = buildErpOrderIndexChunks(skuStatusBuckets, true);
    } catch {
      return Response.json({
        ok: false,
        error: "ORDER_INDEX_ENTRY_TOO_LARGE",
        limitBytes: erpOrderChunkTargetBytes
      }, { status: 413 });
    }
    const previous = await loadSnapshot(this.storage, await this.storage.get("erp-order-active"));
    const metadata = {
      orderCount: orders.length,
      aliasCount,
      chunkCount: chunks.length,
      aliasBucketCount: erpOrderAliasBucketCount,
      skuStatusBucketCount: erpOrderSkuStatusBucketCount,
      indexFormat: 2,
      aliasChunkCounts: aliasChunks.map((pages) => pages.length),
      skuStatusChunkCounts: skuStatusChunks.map((pages) => pages.length),
      skuStatusEntryCount,
      retentionDays: Math.min(365, Math.max(1, Number(body?.retentionDays) || 90)),
      updatedAt: String(body?.updatedAt || (/* @__PURE__ */ new Date()).toISOString()).slice(0, 80)
    };
    const blocks = [];
    const addBlock = (slot, value) => blocks.push({ slot, value, legacyKey: previous?.version ? legacySnapshotKey(previous, slot) : undefined });
    for (let index = 0; index < chunks.length; index += 1) addBlock(`erp-order:${index}`, chunks[index]);
    for (const [kind, buckets] of [["alias", aliasChunks], ["sku-status", skuStatusChunks]]) {
      for (let index = 0; index < buckets.length; index += 1) {
        for (let page = 0; page < buckets[index].length; page += 1) {
          addBlock(`erp-order-${kind}:${index}:${page}`, buckets[index][page]);
        }
      }
    }
    try {
      const result = await publishSnapshot(this.storage, { activeKey: "erp-order-active", metadata, blocks, legacyKeys: orderSnapshotKeys });
      logSnapshotSavings("orders", result);
      return Response.json({ ok: true, orderCount: metadata.orderCount, aliasCount: metadata.aliasCount, skuStatusEntryCount: metadata.skuStatusEntryCount, updatedAt: result.metadata.updatedAt, unchanged: !result.changed, syncStats: snapshotSavings(result) });
    } catch (error) {
      console.warn("ORDER_SNAPSHOT_STORE_FAILED", error?.message);
      return Response.json({ ok: false, error: "ORDER_SNAPSHOT_STORE_FAILED" }, { status: 503 });
    }
  }

  async resolveErpOrderWarehouseSkus(order) {
    const items = Array.isArray(order?.items) ? order.items : [];
    const printableOrders = Array.isArray(order?.printableOrders) ? order.printableOrders : null;
    const allItems = [
      ...items,
      ...printableOrders ? printableOrders.flatMap(
        (printable) => Array.isArray(printable?.items) ? printable.items : []
      ) : []
    ];
    const metadata = await loadSnapshot(this.storage, await this.storage.get("warehouse-location-active"));
    if (!allItems.length || !metadata?.version) return order;
    const warehouseUpdatedAt = Date.parse(String(metadata.updatedAt || ""));
    const warehouseName = String(metadata.warehouseName || "").replace(/\s+/g, "").trim();
    const warehouseIsCurrentMain = Number(metadata.warehouseId) === 1 && warehouseName === "\u4E3B\u5009" && Number.isFinite(warehouseUpdatedAt) && Date.now() - warehouseUpdatedAt <= erpOrderMaxSnapshotAgeMs && warehouseUpdatedAt <= Date.now() + 5 * 6e4;
    if (!warehouseIsCurrentMain) return order;
    const directSkus = new Set(allItems.map((item) => normalizeWarehouseSku(item?.sku)).filter(Boolean));
    const unresolvedNames = new Set(allItems.map((item) => normalizeWarehouseSearchText(item?.name)).filter(Boolean));
    const skusByName = new Map([...unresolvedNames].map((name) => [name, /* @__PURE__ */ new Set()]));
    if (unresolvedNames.size) {
      const searchChunkCount = Math.min(1e3, Math.max(0, Number(metadata.searchChunkCount) || 0));
      let searchItems = [];
      if (searchChunkCount) {
        const chunks = await Promise.all(Array.from(
          { length: searchChunkCount },
          (_, index) => readSnapshotBlock(this.storage, metadata, `warehouse-location-search:${metadata.version}:${index}`)
        ));
        searchItems = chunks.flatMap((chunk) => Array.isArray(chunk) ? chunk : []);
      } else {
        const legacyBucketCount = Math.min(256, Math.max(1, Number(metadata.bucketCount) || 64));
        const legacyBuckets = await Promise.all(Array.from(
          { length: legacyBucketCount },
          (_, index) => readSnapshotBlock(this.storage, metadata, `warehouse-location:${metadata.version}:${index}`)
        ));
        searchItems = legacyBuckets.flatMap(
          (bucket) => Object.values(bucket && typeof bucket === "object" ? bucket : {}).map((item) => ({ sku: item?.sku, name: item?.name }))
        );
      }
      for (const searchItem of searchItems) {
        const name = normalizeWarehouseSearchText(searchItem?.name);
        const sku = normalizeWarehouseSku(searchItem?.sku);
        if (sku && skusByName.has(name)) skusByName.get(name).add(sku);
      }
    }
    const candidateSkus = new Set(directSkus);
    for (const skuSet of skusByName.values()) {
      for (const sku of skuSet) candidateSkus.add(sku);
    }
    if (!candidateSkus.size) return order;
    const bucketCount = Math.min(256, Math.max(1, Number(metadata.bucketCount) || 64));
    const bucketIndexes = [...new Set([...candidateSkus].map((sku) => warehouseLocationBucket(sku, bucketCount)))];
    const bucketEntries = await Promise.all(bucketIndexes.map(async (index) => [
      index,
      await readSnapshotBlock(this.storage, metadata, `warehouse-location:${metadata.version}:${index}`)
    ]));
    const buckets = new Map(bucketEntries);
    const warehouseItems = new Map([...candidateSkus].map((sku) => {
      const bucket = buckets.get(warehouseLocationBucket(sku, bucketCount));
      return [sku, bucket && typeof bucket === "object" ? bucket[sku] || null : null];
    }));
    const resolveItem = /* @__PURE__ */ __name((item) => {
      const directSku = normalizeWarehouseSku(item?.sku);
      const directItem = directSku ? warehouseItems.get(directSku) : null;
      const candidateItems = directItem ? [directItem] : [...skusByName.get(normalizeWarehouseSearchText(item?.name)) || []].map((sku) => warehouseItems.get(sku)).filter(Boolean);
      return resolveErpOrderItemWarehouseDetails(item, candidateItems);
    }, "resolveItem");
    const resolvedOrder = {
      ...order,
      items: items.map(resolveItem)
    };
    if (printableOrders) {
      resolvedOrder.printableOrders = printableOrders.map((printable) => ({
        ...printable,
        items: (Array.isArray(printable?.items) ? printable.items : []).map(resolveItem)
      }));
    }
    return resolvedOrder;
  }
  async readErpOrderIndexBucket(metadata, kind, bucketIndex) {
    try {
      const bucket = {};
      for (const key of erpOrderIndexPageKeys(metadata, kind, bucketIndex)) {
        const page = await readSnapshotBlock(this.storage, metadata, key);
        if (!page && !metadata.indexFormat) return {};
        if (!page || typeof page !== "object" || Array.isArray(page)) return null;
        for (const [entryKey, value] of Object.entries(page)) {
          if (kind === "sku-status") {
            if (!Array.isArray(value)) return null;
            bucket[entryKey] = (bucket[entryKey] || []).concat(value);
          } else {
            if (Object.hasOwn(bucket, entryKey)) return null;
            bucket[entryKey] = value;
          }
        }
      }
      return bucket;
    } catch {
      return null;
    }
  }
  async queryErpOrder(request) {
    const { query } = await request.json();
    const metadata = await loadSnapshot(this.storage, await this.storage.get("erp-order-active"));
    if (!metadata?.version) {
      return Response.json({ ok: true, order: null, metadata: metadata || null });
    }
    const aliasBucketCount = Math.min(512, Math.max(1, Number(metadata.aliasBucketCount) || 128));
    for (const alias of erpOrderLookupCandidates(query)) {
      const bucket = await this.readErpOrderIndexBucket(metadata, "alias", warehouseLocationBucket(alias, aliasBucketCount));
      if (!bucket) return Response.json({ ok: false, error: "UNSAFE_STORED_ORDER_INDEX" }, { status: 503 });
      const location = bucket && typeof bucket === "object" ? bucket[alias] : null;
      if (!location) continue;
      const chunk = await readSnapshotBlock(this.storage, metadata, `erp-order:${metadata.version}:${Math.max(0, Number(location.chunkIndex) || 0)}`);
      const rawOrder = chunk && typeof chunk === "object" ? chunk[location.transactionNo] || null : null;
      const order = normalizeStoredErpOrder(rawOrder, location.transactionNo, alias);
      if (!order) {
        return Response.json({ ok: false, error: "UNSAFE_STORED_ORDER" }, { status: 503 });
      }
      return Response.json({
        ok: true,
        order: await this.resolveErpOrderWarehouseSkus(order),
        metadata
      });
    }
    return Response.json({ ok: true, order: null, metadata });
  }
  async queryErpOrdersBySkuStatus(request) {
    const lookup = normalizeErpOrderSkuStatusRequest(await request.json());
    if (!lookup.sku || !lookup.status) {
      return Response.json({ ok: false, error: "INVALID_ORDER_SKU_STATUS_QUERY" }, { status: 400 });
    }
    const metadata = await loadSnapshot(this.storage, await this.storage.get("erp-order-active"));
    if (!metadata?.version) {
      return Response.json({
        ok: true,
        ...lookup,
        orders: [],
        totalCount: 0,
        totalPages: 1,
        metadata: metadata || null
      });
    }
    const storedOrders = [];
    const seenTransactions = /* @__PURE__ */ new Set();
    const skuStatusBucketCount = Math.min(512, Math.max(0, Number(metadata.skuStatusBucketCount) || 0));
    if (skuStatusBucketCount) {
      const indexKey = erpOrderSkuStatusIndexKey(lookup.status, lookup.sku);
      const bucket = await this.readErpOrderIndexBucket(metadata, "sku-status", warehouseLocationBucket(indexKey, skuStatusBucketCount));
      if (!bucket) return Response.json({ ok: false, error: "UNSAFE_STORED_ORDER_INDEX" }, { status: 503 });
      const locations = bucket && typeof bucket === "object" && Array.isArray(bucket[indexKey]) ? bucket[indexKey] : [];
      const chunkIndexes = [...new Set(locations.map((location) => Math.max(0, Number(location?.[1]) || 0)))];
      const chunks = new Map(await Promise.all(chunkIndexes.map(async (chunkIndex) => [
        chunkIndex,
        await readSnapshotBlock(this.storage, metadata, `erp-order:${metadata.version}:${chunkIndex}`)
      ])));
      for (const location of locations) {
        const transactionNo = normalizeErpOrderAlias(location?.[0]).slice(0, 80);
        if (!/^\d{7,12}$/u.test(transactionNo) || seenTransactions.has(transactionNo)) continue;
        const chunkIndex = Math.max(0, Number(location?.[1]) || 0);
        const chunk = chunks.get(chunkIndex);
        const rawOrder = chunk && typeof chunk === "object" ? chunk[transactionNo] : null;
        const order = normalizeStoredErpOrder(rawOrder, transactionNo, transactionNo);
        if (!order) return Response.json({ ok: false, error: "UNSAFE_STORED_ORDER" }, { status: 503 });
        seenTransactions.add(transactionNo);
        storedOrders.push(order);
      }
    } else {
      const chunkCount = Math.min(5e3, Math.max(0, Number(metadata.chunkCount) || 0));
      const chunks = await Promise.all(Array.from(
        { length: chunkCount },
        (_, index) => readSnapshotBlock(this.storage, metadata, `erp-order:${metadata.version}:${index}`)
      ));
      for (const chunk of chunks) {
        for (const [transactionNo, rawOrder] of Object.entries(
          chunk && typeof chunk === "object" ? chunk : {}
        )) {
          const normalizedTransactionNo = normalizeErpOrderAlias(transactionNo).slice(0, 80);
          const order = normalizeStoredErpOrder(rawOrder, normalizedTransactionNo, normalizedTransactionNo);
          if (!order) return Response.json({ ok: false, error: "UNSAFE_STORED_ORDER" }, { status: 503 });
          if (order.status !== lookup.status) continue;
          const hasSku = [
            ...Array.isArray(order.items) ? order.items : [],
            ...Array.isArray(order.printableOrders) ? order.printableOrders.flatMap((printable) => Array.isArray(printable?.items) ? printable.items : []) : []
          ].some((item) => erpOrderMatchesSku(item, lookup.sku));
          if (hasSku) storedOrders.push(order);
        }
      }
    }
    const rows = storedOrders.filter((order) => order.status === lookup.status).flatMap((order) => erpOrderSkuStatusRows(order, lookup.sku)).sort((left, right) => {
      const leftAt = Date.parse(String(left.createdAt || ""));
      const rightAt = Date.parse(String(right.createdAt || ""));
      if (Number.isFinite(leftAt) && Number.isFinite(rightAt) && leftAt !== rightAt) return rightAt - leftAt;
      return compareErpOrderAliases(right.number, left.number);
    });
    const totalCount = rows.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / erpOrderSkuStatusPageSize));
    const page = Math.min(lookup.page, totalPages);
    const start = (page - 1) * erpOrderSkuStatusPageSize;
    return Response.json({
      ok: true,
      sku: lookup.sku,
      status: lookup.status,
      page,
      pageSize: erpOrderSkuStatusPageSize,
      totalPages,
      totalCount,
      partialCount: rows.filter((row) => row.detailsIncomplete).length,
      orders: rows.slice(start, start + erpOrderSkuStatusPageSize),
      metadata
    });
  }
  async erpOrderUserIsAuthorized(userId) {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId || normalizedUserId.length > 120) return false;
    const allowed = new Set(
      String(this.env.LINE_ORDER_ALLOWED_USER_IDS || "").split(",").map((value) => value.trim()).filter(Boolean)
    );
    if (allowed.has(normalizedUserId)) return true;
    const record = await this.storage.get(await lineOrderAuthorizationStorageKey(normalizedUserId));
    return Boolean(record?.authorizedAt);
  }
  async saveErpOrderRecentSelection(request) {
    const body = await request.json();
    const userId = String(body?.userId || "").trim();
    if (!userId || userId.length > 120) {
      return Response.json({ ok: false, error: "INVALID_ORDER_SELECTION_USER" }, { status: 400 });
    }
    if (!await this.erpOrderUserIsAuthorized(userId)) {
      return Response.json({ ok: false, error: "ORDER_SELECTION_NOT_AUTHORIZED" }, { status: 403 });
    }
    const key = await lineOrderRecentSelectionStorageKey(userId);
    await this.storage.delete(key);
    const savedAt = Number.isFinite(Number(body?.savedAt)) ? Number(body.savedAt) : Date.now();
    const kind = body?.kind === "sku-status" ? "sku-status" : "transaction-list";
    const record = normalizeErpOrderRecentSelectionRecord({
      kind,
      snapshotVersion: body?.snapshotVersion,
      transactionNo: body?.transactionNo,
      printableNumbers: body?.printableNumbers,
      sku: body?.sku,
      status: body?.status,
      page: body?.page,
      firstIndex: body?.firstIndex,
      queries: body?.queries,
      savedAt,
      expiresAt: savedAt + (kind === "sku-status" ? erpOrderSkuStatusSelectionTtlMs : erpOrderRecentSelectionTtlMs)
    });
    if (!record) {
      return Response.json({ ok: false, error: "INVALID_ORDER_SELECTION" }, { status: 400 });
    }
    const metadata = await loadSnapshot(this.storage, await this.storage.get("erp-order-active"));
    if (!metadata?.version || String(metadata.version) !== record.snapshotVersion) {
      return Response.json({ ok: false, error: "ORDER_SELECTION_SNAPSHOT_CHANGED" }, { status: 409 });
    }
    const receivedBytes = encoder.encode(JSON.stringify(record)).byteLength;
    if (receivedBytes > erpOrderChunkTargetBytes) {
      return Response.json({
        ok: false,
        error: "ORDER_SELECTION_TOO_LARGE",
        receivedBytes,
        limitBytes: erpOrderChunkTargetBytes
      }, { status: 413 });
    }
    await this.storage.put(key, record);
    return Response.json({
      ok: true,
      saved: true,
      count: record.kind === "sku-status" ? record.queries.length : record.printableNumbers.length,
      expiresAt: record.expiresAt
    });
  }
  async resolveErpOrderRecentSelection(request) {
    const body = await request.json();
    const userId = String(body?.userId || "").trim();
    const index = Number(body?.index);
    if (!userId || userId.length > 120 || !Number.isInteger(index) || index < 1) {
      return Response.json({ ok: false, error: "INVALID_ORDER_SELECTION" }, { status: 400 });
    }
    const key = await lineOrderRecentSelectionStorageKey(userId);
    const rawRecord = await this.storage.get(key);
    if (!rawRecord) return Response.json({ ok: true, found: false });
    if (!await this.erpOrderUserIsAuthorized(userId)) {
      await this.storage.delete(key);
      return Response.json({ ok: false, error: "ORDER_SELECTION_NOT_AUTHORIZED" }, { status: 403 });
    }
    const record = normalizeErpOrderRecentSelectionRecord(rawRecord);
    if (!record) {
      await this.storage.delete(key);
      return Response.json({ ok: false, error: "UNSAFE_ORDER_SELECTION" }, { status: 503 });
    }
    const now = Number.isFinite(Number(body?.now)) ? Number(body.now) : Date.now();
    const metadata = await loadSnapshot(this.storage, await this.storage.get("erp-order-active"));
    const expired = now < record.savedAt - 5 * 6e4 || now > record.expiresAt;
    const snapshotChanged = !metadata?.version || String(metadata.version) !== record.snapshotVersion;
    if (expired || snapshotChanged) {
      await this.storage.delete(key);
      return Response.json({
        ok: true,
        found: false,
        expired,
        snapshotChanged,
        kind: record.kind,
        transactionNo: record.transactionNo,
        sku: record.sku,
        status: record.status
      });
    }
    const firstIndex = record.kind === "sku-status" ? record.firstIndex : 1;
    const selectableQueries = record.kind === "sku-status" ? record.queries : record.printableNumbers;
    const lastIndex = firstIndex + selectableQueries.length - 1;
    if (index < firstIndex || index > lastIndex) {
      return Response.json({
        ok: true,
        found: true,
        valid: false,
        kind: record.kind,
        count: selectableQueries.length,
        firstIndex,
        lastIndex,
        transactionNo: record.transactionNo,
        sku: record.sku,
        status: record.status
      });
    }
    const query = selectableQueries[index - firstIndex];
    await this.storage.delete(key);
    return Response.json({
      ok: true,
      found: true,
      valid: true,
      kind: record.kind,
      query,
      index,
      count: selectableQueries.length,
      firstIndex,
      lastIndex,
      transactionNo: record.transactionNo,
      sku: record.sku,
      status: record.status
    });
  }
  async clearErpOrderRecentSelection(request) {
    const { userId: rawUserId } = await request.json();
    const userId = String(rawUserId || "").trim();
    if (!userId || userId.length > 120) {
      return Response.json({ ok: false, error: "INVALID_ORDER_SELECTION_USER" }, { status: 400 });
    }
    const key = await lineOrderRecentSelectionStorageKey(userId);
    const existed = Boolean(await this.storage.get(key));
    if (existed) await this.storage.delete(key);
    return Response.json({ ok: true, cleared: existed });
  }
  async bindErpOrderUser(request) {
    const { userId, bindToken } = await request.json();
    const normalizedUserId = String(userId || "").trim();
    const normalizedToken = String(bindToken || "").trim();
    if (!normalizedUserId || normalizedUserId.length > 120 || !/^[A-Za-z0-9_-]{8,64}$/u.test(normalizedToken)) {
      return Response.json({ ok: false, error: "INVALID_ORDER_BINDING" }, { status: 400 });
    }
    const tokenKey = await lineOrderBindingTokenStorageKey(normalizedToken);
    if (await this.storage.get(tokenKey)) {
      return Response.json({ ok: false, error: "ORDER_BINDING_ALREADY_USED" }, { status: 409 });
    }
    const userKey = await lineOrderAuthorizationStorageKey(normalizedUserId);
    const authorizedAt = (/* @__PURE__ */ new Date()).toISOString();
    await this.storage.put(userKey, { authorizedAt });
    await this.storage.put(tokenKey, { usedAt: authorizedAt });
    return Response.json({ ok: true, authorized: true });
  }
  async erpOrderUserAuthorized(request) {
    const { userId } = await request.json();
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId || normalizedUserId.length > 120) {
      return Response.json({ ok: true, authorized: false });
    }
    return Response.json({
      ok: true,
      authorized: await this.erpOrderUserIsAuthorized(normalizedUserId)
    });
  }
  async queryWarehouseLocation(request) {
    const { sku: rawSku, includeImage = true } = await request.json();
    const sku = String(rawSku || "").replace(/\s+/g, "").trim().toUpperCase().slice(0, 80);
    const metadata = await loadSnapshot(this.storage, await this.storage.get("warehouse-location-active"));
    if (!metadata?.version || !sku) {
      return Response.json({ ok: true, item: null, metadata: metadata || null });
    }
    const bucketCount = Math.min(256, Math.max(1, Number(metadata.bucketCount) || 64));
    const bucket = await readSnapshotBlock(this.storage, metadata, `warehouse-location:${metadata.version}:${warehouseLocationBucket(sku, bucketCount)}`);
    const locationItem = bucket && typeof bucket === "object" ? bucket[sku] || null : null;
    let cached = includeImage !== false && locationItem ? await this.warehouseImageCacheRecord(sku) : null;
    if (includeImage !== false && locationItem && !cached?.imageUrl && isNasLocalImageSku(sku)) {
      cached = await this.warehouseImageObjectRecord(sku);
    }
    return Response.json({
      ok: true,
      item: cached?.imageUrl ? {
        ...locationItem,
        productId: cached.productId,
        productUrl: cached.productUrl,
        imageUrl: cached.imageUrl
      } : locationItem,
      metadata
    });
  }
  async queryWarehouseStorageLocation(request) {
    const {
      location: rawLocation,
      page: rawPage,
      includeUnavailable: rawIncludeUnavailable = true
    } = await request.json();
    const location = normalizeWarehouseStorageLocation(rawLocation);
    const includeUnavailable = rawIncludeUnavailable !== false;
    const metadata = await loadSnapshot(this.storage, await this.storage.get("warehouse-location-active"));
    if (!metadata?.version || !location) {
      return Response.json({
        ok: true,
        location,
        items: [],
        skuCount: 0,
        totalCount: 0,
        allTotalCount: 0,
        page: 1,
        totalPages: 0,
        includeUnavailable,
        metadata: metadata || null
      });
    }
    let record = null;
    const reverseBucketCount = Math.min(512, Math.max(0, Number(metadata.reverseBucketCount) || 0));
    if (reverseBucketCount) {
      const bucket = await readSnapshotBlock(this.storage, metadata, `warehouse-location-reverse:${metadata.version}:${warehouseLocationBucket(location, reverseBucketCount)}`);
      record = bucket && typeof bucket === "object" ? bucket[location] || null : null;
    } else {
      const bucketCount = Math.min(256, Math.max(1, Number(metadata.bucketCount) || 64));
      const buckets = await Promise.all(Array.from(
        { length: bucketCount },
        (_, index) => readSnapshotBlock(this.storage, metadata, `warehouse-location:${metadata.version}:${index}`)
      ));
      const rows = [];
      let displayLocation = location;
      for (const bucket of buckets) {
        for (const item of Object.values(bucket && typeof bucket === "object" ? bucket : {})) {
          for (const variant of Array.isArray(item?.variants) ? item.variants : []) {
            if (normalizeWarehouseStorageLocation(variant?.location) !== location) continue;
            displayLocation = String(variant.location || location).trim().slice(0, 160) || location;
            rows.push(warehouseStorageLocationRow(item, variant));
          }
        }
      }
      if (rows.length) record = finalizeWarehouseStorageLocationRecord(displayLocation, rows);
    }
    const allTotalCount = Math.max(0, Number(record?.itemCount) || 0);
    let filteredItems = null;
    if (!includeUnavailable && record) {
      let allItems = Array.isArray(record.items) ? record.items : [];
      if (reverseBucketCount && !Array.isArray(record.items) && allTotalCount) {
        const bucketIndex = warehouseLocationBucket(location, reverseBucketCount);
        const chunkSize = Math.min(
          200,
          Math.max(1, Number(metadata.reverseItemChunkSize) || warehouseStorageLocationIndexChunkSize)
        );
        const absoluteStart = Math.max(0, Number(record.offset) || 0);
        const absoluteEnd = absoluteStart + allTotalCount;
        const firstChunk = Math.floor(absoluteStart / chunkSize);
        const lastChunk = Math.floor(Math.max(absoluteStart, absoluteEnd - 1) / chunkSize);
        const chunks = await Promise.all(Array.from(
          { length: lastChunk - firstChunk + 1 },
          (_, offset) => readSnapshotBlock(this.storage, metadata, `warehouse-location-reverse-items:${metadata.version}:${bucketIndex}:${firstChunk + offset}`)
        ));
        allItems = chunks.flatMap((chunk) => Array.isArray(chunk) ? chunk : []).slice(
          absoluteStart - firstChunk * chunkSize,
          absoluteStart - firstChunk * chunkSize + allTotalCount
        );
      }
      filteredItems = allItems.filter((item) => Math.trunc(Number(item?.available) || 0) > 0);
    }
    const totalCount = filteredItems ? filteredItems.length : allTotalCount;
    const totalPages = totalCount ? Math.ceil(totalCount / warehouseStorageLocationPageSize) : 0;
    const page = totalPages ? Math.min(totalPages, Math.max(1, Math.trunc(Number(rawPage) || 1))) : 1;
    const start = (page - 1) * warehouseStorageLocationPageSize;
    let pageItems = filteredItems ? filteredItems.slice(start, start + warehouseStorageLocationPageSize) : record?.items?.slice(start, start + warehouseStorageLocationPageSize) || [];
    if (!filteredItems && record && reverseBucketCount && !Array.isArray(record.items)) {
      const bucketIndex = warehouseLocationBucket(location, reverseBucketCount);
      const chunkSize = Math.min(200, Math.max(1, Number(metadata.reverseItemChunkSize) || warehouseStorageLocationIndexChunkSize));
      const absoluteStart = Math.max(0, Number(record.offset) || 0) + start;
      const absoluteEnd = absoluteStart + Math.min(warehouseStorageLocationPageSize, totalCount - start);
      const firstChunk = Math.floor(absoluteStart / chunkSize);
      const lastChunk = Math.floor(Math.max(absoluteStart, absoluteEnd - 1) / chunkSize);
      const chunks = await Promise.all(Array.from(
        { length: lastChunk - firstChunk + 1 },
        (_, offset) => readSnapshotBlock(this.storage, metadata, `warehouse-location-reverse-items:${metadata.version}:${bucketIndex}:${firstChunk + offset}`)
      ));
      pageItems = chunks.flatMap((chunk) => Array.isArray(chunk) ? chunk : []).slice(
        absoluteStart - firstChunk * chunkSize,
        absoluteStart - firstChunk * chunkSize + warehouseStorageLocationPageSize
      );
    }
    return Response.json({
      ok: true,
      location: record?.location || location,
      items: pageItems,
      skuCount: filteredItems ? new Set(filteredItems.map((item) => String(item?.sku || ""))).size : Math.max(0, Number(record?.skuCount) || 0),
      totalCount,
      allTotalCount,
      page,
      totalPages,
      includeUnavailable,
      metadata,
      indexed: Boolean(reverseBucketCount)
    });
  }
  async searchWarehouseLocations(request) {
    const { keyword: rawKeyword, limit: rawLimit } = await request.json();
    const keyword = String(rawKeyword || "").trim().slice(0, 80);
    const normalizedKeyword = normalizeWarehouseSearchText(keyword);
    const metadata = await loadSnapshot(this.storage, await this.storage.get("warehouse-location-active"));
    if (!metadata?.version || !normalizedKeyword) {
      return Response.json({ ok: true, items: [], totalCount: 0, metadata: metadata || null });
    }
    const chunkCount = Math.min(1e3, Math.max(0, Number(metadata.searchChunkCount) || 0));
    let chunks;
    if (chunkCount) {
      chunks = await Promise.all(Array.from(
        { length: chunkCount },
        (_, index) => readSnapshotBlock(this.storage, metadata, `warehouse-location-search:${metadata.version}:${index}`)
      ));
    } else {
      const bucketCount2 = Math.min(256, Math.max(1, Number(metadata.bucketCount) || 64));
      const legacyBuckets = await Promise.all(Array.from(
        { length: bucketCount2 },
        (_, index) => readSnapshotBlock(this.storage, metadata, `warehouse-location:${metadata.version}:${index}`)
      ));
      chunks = [legacyBuckets.flatMap((bucket) => Object.values(bucket && typeof bucket === "object" ? bucket : {}).map((item) => ({ sku: item.sku, name: item.name })))];
    }
    const matches = [];
    for (const chunk of chunks) {
      for (const item of Array.isArray(chunk) ? chunk : []) {
        const score = warehouseSearchScore(item, normalizedKeyword);
        if (score === null) continue;
        matches.push({ sku: item.sku, name: item.name, score });
      }
    }
    matches.sort((a, b) => a.score - b.score || a.name.length - b.name.length || a.sku.localeCompare(b.sku));
    const limit = Math.min(10, Math.max(1, Number(rawLimit) || 10));
    const selected = matches.slice(0, limit);
    const bucketCount = Math.min(256, Math.max(1, Number(metadata.bucketCount) || 64));
    const bucketIndexes = [...new Set(selected.map((item) => warehouseLocationBucket(item.sku, bucketCount)))];
    const bucketEntries = await Promise.all(bucketIndexes.map(async (index) => [
      index,
      await readSnapshotBlock(this.storage, metadata, `warehouse-location:${metadata.version}:${index}`)
    ]));
    const buckets = new Map(bucketEntries);
    const locationItems = selected.map((match) => {
      const bucket = buckets.get(warehouseLocationBucket(match.sku, bucketCount));
      return bucket && typeof bucket === "object" ? bucket[match.sku] || null : null;
    }).filter(Boolean);
    const imageBucketKeys = [...new Set(locationItems.map((item) => this.warehouseImageCacheKey(item.sku)))];
    const imageBucketEntries = await Promise.all(imageBucketKeys.map(async (key) => [key, await this.storage.get(key)]));
    const imageBuckets = new Map(imageBucketEntries);
    const items = locationItems.map((item) => {
      const bucket = imageBuckets.get(this.warehouseImageCacheKey(item.sku));
      const cached = bucket && typeof bucket === "object" ? bucket[item.sku] : null;
      return cached?.imageUrl ? {
        ...item,
        productId: cached.productId,
        productUrl: cached.productUrl,
        imageUrl: cached.imageUrl
      } : item;
    });
    return Response.json({ ok: true, items, totalCount: matches.length, metadata });
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/erp/writeback/connect" && request.method === "GET") {
      return this.acceptErpWriteback(request);
    }
    if (url.pathname === "/erp/writeback/status" && request.method === "GET") {
      if (!this.erpWritebackAuthorized(request)) return new Response("Unauthorized", { status: 401 });
      return Response.json({ connected: Boolean(this.erpWritebackSocket && this.erpWritebackSocket.readyState === WebSocket.OPEN) });
    }
    if (url.pathname === "/erp/writeback/dispatch" && request.method === "POST") {
      return this.dispatchErpWritebackJob(request);
    }
    if (url.pathname === "/erp/writeback/confirmation/save" && request.method === "POST") {
      return this.saveErpWritebackConfirmation(request);
    }
    if (url.pathname === "/erp/writeback/confirmation/take" && request.method === "POST") {
      return this.takeErpWritebackConfirmation(request);
    }
    if (url.pathname === "/reader/connect" && request.method === "GET") {
      return this.acceptReader(request);
    }
    if (url.pathname === "/reader/status" && request.method === "GET") {
      if (!this.readerAuthorized(request)) return new Response("Unauthorized", { status: 401 });
      return Response.json({
        connected: Boolean(this.readerSocket && this.readerSocket.readyState === WebSocket.OPEN),
        hello: this.readerHello
      });
    }
    if (url.pathname === "/extract" && request.method === "POST") {
      return this.extractWithReader(request);
    }
    if (url.pathname === "/warehouse-images/cache-nas" && request.method === "POST") {
      return this.cacheNasImage(request);
    }
    if (url.pathname === "/warehouse-images/record-nas" && request.method === "POST") {
      return this.recordNasImage(request);
    }
    if (url.pathname === "/schedule/add" && request.method === "POST") {
      return this.addScheduleItems(request);
    }
    if (url.pathname === "/schedule/list" && request.method === "POST") {
      return this.listScheduleItems();
    }
    if (url.pathname === "/schedule/import" && request.method === "POST") {
      return this.importScheduleItems(request);
    }
    if (url.pathname === "/schedule/get" && request.method === "POST") {
      return this.getScheduleItem(request);
    }
    if (url.pathname === "/schedule/generation-acquire" && request.method === "POST") {
      return this.acquireScheduleGeneration(request);
    }
    if (url.pathname === "/schedule/generation-release" && request.method === "POST") {
      return this.releaseScheduleGeneration(request);
    }
    if (url.pathname === "/schedule/complete" && request.method === "POST") {
      return this.completeScheduleItem(request);
    }
    if (url.pathname === "/schedule/reopen" && request.method === "POST") {
      return this.reopenScheduleItem(request);
    }
    if (url.pathname === "/warehouse-locations/sync" && request.method === "POST") {
      return this.syncWarehouseLocations(request);
    }
    if (url.pathname === "/erp-orders/sync" && request.method === "POST") {
      return this.syncErpOrders(request);
    }
    if (url.pathname === "/erp-orders/status" && request.method === "GET") {
      const metadata = await loadSnapshot(this.storage, await this.storage.get("erp-order-active"));
      return Response.json({
        ok: true,
        active: Boolean(metadata?.version),
        version: metadata?.version || null,
        updatedAt: metadata?.updatedAt || null,
        orderCount: metadata?.orderCount || 0,
        aliasCount: metadata?.aliasCount || 0,
        retentionDays: metadata?.retentionDays || null,
        indexFormat: metadata?.indexFormat || 1,
        aliasPageCount: metadata?.aliasChunkCounts?.reduce((a, b) => a + b, 0) || 0,
        skuStatusPageCount: metadata?.skuStatusChunkCounts?.reduce((a, b) => a + b, 0) || 0
      });
    }
    if (url.pathname === "/erp-orders/query" && request.method === "POST") {
      return this.queryErpOrder(request);
    }
    if (url.pathname === "/erp-orders/query-sku-status" && request.method === "POST") {
      return this.queryErpOrdersBySkuStatus(request);
    }
    if (url.pathname === "/erp-orders/recent-selection/save" && request.method === "POST") {
      return this.saveErpOrderRecentSelection(request);
    }
    if (url.pathname === "/erp-orders/recent-selection/resolve" && request.method === "POST") {
      return this.resolveErpOrderRecentSelection(request);
    }
    if (url.pathname === "/erp-orders/recent-selection/clear" && request.method === "POST") {
      return this.clearErpOrderRecentSelection(request);
    }
    if (url.pathname === "/erp-orders/bind-user" && request.method === "POST") {
      return this.bindErpOrderUser(request);
    }
    if (url.pathname === "/erp-orders/user-authorized" && request.method === "POST") {
      return this.erpOrderUserAuthorized(request);
    }
    if (url.pathname === "/warehouse-locations/query" && request.method === "POST") {
      return this.queryWarehouseLocation(request);
    }
    if (url.pathname === "/warehouse-locations/query-storage-location" && request.method === "POST") {
      return this.queryWarehouseStorageLocation(request);
    }
    if (url.pathname === "/warehouse-locations/search" && request.method === "POST") {
      return this.searchWarehouseLocations(request);
    }
    if (url.pathname === "/warehouse-locations/local-image-skus" && request.method === "GET") {
      return this.localWarehouseImageSkus();
    }
    if (url.pathname === "/warehouse-images/reconcile" && request.method === "POST") {
      return this.reconcileWarehouseImages(request);
    }
    if (url.pathname === "/warehouse-images/enqueue" && request.method === "POST") {
      return this.enqueueWarehouseImages(request);
    }
    if (url.pathname === "/warehouse-images/status" && request.method === "GET") {
      return this.warehouseImageStatus();
    }
    if (url.pathname === "/warehouse-images/reconcile-nas" && request.method === "POST") {
      return this.reconcileNasImagePrecache(request);
    }
    if (url.pathname === "/warehouse-images/nas-status" && request.method === "GET") {
      return this.nasImagePrecacheStatus();
    }
    if (url.pathname === "/arm" && request.method === "POST") {
      const { armedAt } = await request.json();
      await this.storage.put("armedAt", Number(armedAt));
      return Response.json({ armed: true });
    }
    if (url.pathname === "/take" && request.method === "POST") {
      const { now } = await request.json();
      const armedAt = await this.storage.get("armedAt");
      await this.storage.delete("armedAt");
      const elapsed = Number(now) - Number(armedAt);
      return Response.json({ valid: Boolean(armedAt) && elapsed >= 0 && elapsed <= 1e4 });
    }
    if (url.pathname === "/warehouse-position-prompt/arm" && request.method === "POST") {
      const { armedAt } = await request.json();
      await this.storage.put("warehousePositionPrompt", { armedAt: Number(armedAt) });
      return Response.json({ armed: true });
    }
    if (url.pathname === "/warehouse-position-prompt/take" && request.method === "POST") {
      const { now } = await request.json();
      const prompt = await this.storage.get("warehousePositionPrompt");
      await this.storage.delete("warehousePositionPrompt");
      if (!prompt?.armedAt) return Response.json({ valid: false, existed: false });
      const elapsed = Number(now) - Number(prompt.armedAt);
      return Response.json({
        valid: elapsed >= 0 && elapsed <= warehousePositionPromptTtlMs,
        existed: true,
        elapsed
      });
    }
    if (url.pathname === "/warehouse-position-custom/save" && request.method === "POST") {
      const { itemUID, itemUIDs, goodId, createdAt } = await request.json();
      const batchTarget = itemUIDs === void 0 ? null : warehousePositionBatchTarget(goodId, itemUIDs);
      if (itemUIDs === void 0 ? !parseWarehousePositionWriteCommand(`\u6539\u5132\u4F4D ${itemUID} TEST`) : !batchTarget) {
        return Response.json({ saved: false }, { status: 400 });
      }
      await this.storage.put("warehousePositionCustomInput", {
        ...batchTarget || { itemUID },
        createdAt: Number(createdAt)
      });
      return Response.json({ saved: true });
    }
    if (url.pathname === "/warehouse-position-custom/take" && request.method === "POST") {
      const { now } = await request.json();
      const pending = await this.storage.get("warehousePositionCustomInput");
      await this.storage.delete("warehousePositionCustomInput");
      if (!pending?.createdAt) return Response.json({ existed: false, valid: false });
      const elapsed = Number(now) - Number(pending.createdAt);
      return Response.json({
        existed: true,
        valid: elapsed >= 0 && elapsed <= warehousePositionCustomInputTtlMs,
        ...pending.itemUIDs ? { goodId: pending.goodId, itemUIDs: pending.itemUIDs } : { itemUID: String(pending.itemUID || "") }
      });
    }
    return new Response("Not found", { status: 404 });
  }
};
async function durableLineActivation(event, env, action, timestamp) {
  if (!env.LINE_ACTIVATION) return null;
  try {
    const id = env.LINE_ACTIVATION.idFromName(lineActivationKey(event));
    const stub = env.LINE_ACTIVATION.get(id);
    const response = await stub.fetch(`https://line-activation/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "arm" ? { armedAt: timestamp } : { now: timestamp })
    });
    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.error("LINE activation Durable Object error", error?.message || error);
    return null;
  }
}
__name(durableLineActivation, "durableLineActivation");
async function armLineGroup(event, env) {
  const key = lineActivationKey(event);
  const armedAt = Number(event.timestamp) || Date.now();
  const durable = await durableLineActivation(event, env, "arm", armedAt);
  if (durable?.armed) {
    console.log("LINE_ARM", JSON.stringify({ storage: "durable", armed: true }));
    return true;
  }
  lineActivations.set(key, armedAt);
  if (lineActivations.size > 1e3) {
    for (const [activationKey, timestamp] of lineActivations) {
      if (armedAt - timestamp > 6e4) lineActivations.delete(activationKey);
    }
  }
  if (env.LINE_PENDING) {
    await env.LINE_PENDING.put(
      key,
      JSON.stringify({ armedAt }),
      { expirationTtl: 60 }
    );
  }
  console.log("LINE_ARM", JSON.stringify({ storage: env.LINE_PENDING ? "memory+kv" : "memory", armed: true }));
  return true;
}
__name(armLineGroup, "armLineGroup");
async function takeLineGroupActivation(event, env) {
  const key = lineActivationKey(event);
  const now = Number(event.timestamp) || Date.now();
  const durable = await durableLineActivation(event, env, "take", now);
  if (typeof durable?.valid === "boolean") {
    console.log("LINE_GATE", JSON.stringify({ storage: "durable", valid: durable.valid }));
    return durable.valid;
  }
  const memoryArmedAt = lineActivations.get(key);
  lineActivations.delete(key);
  if (memoryArmedAt) {
    if (env.LINE_PENDING) await env.LINE_PENDING.delete(key);
    const elapsed2 = now - Number(memoryArmedAt);
    const valid2 = elapsed2 >= 0 && elapsed2 <= 1e4;
    console.log("LINE_GATE", JSON.stringify({ storage: "memory", valid: valid2, elapsed: elapsed2 }));
    return valid2;
  }
  if (!env.LINE_PENDING) return false;
  const value = await env.LINE_PENDING.get(key, "json");
  await env.LINE_PENDING.delete(key);
  if (!value?.armedAt) return false;
  const elapsed = now - Number(value.armedAt);
  const valid = elapsed >= 0 && elapsed <= 1e4;
  console.log("LINE_GATE", JSON.stringify({ storage: "kv", valid, elapsed }));
  return valid;
}
__name(takeLineGroupActivation, "takeLineGroupActivation");
function warehousePositionPromptKey(event) {
  return `line-warehouse-position-prompt:${event?.source?.userId || "unknown-user"}`;
}
__name(warehousePositionPromptKey, "warehousePositionPromptKey");
async function durableWarehousePositionPrompt(event, env, action, timestamp) {
  if (!env.LINE_ACTIVATION || !event?.source?.userId) return null;
  try {
    const id = env.LINE_ACTIVATION.idFromName(warehousePositionPromptKey(event));
    const stub = env.LINE_ACTIVATION.get(id);
    const response = await stub.fetch(`https://line-activation/warehouse-position-prompt/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "arm" ? { armedAt: timestamp } : { now: timestamp })
    });
    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.error("LINE warehouse position prompt Durable Object error", error?.message || error);
    return null;
  }
}
__name(durableWarehousePositionPrompt, "durableWarehousePositionPrompt");
async function armWarehousePositionPrompt(event, env) {
  const key = warehousePositionPromptKey(event);
  const armedAt = Number(event.timestamp) || Date.now();
  const durable = await durableWarehousePositionPrompt(event, env, "arm", armedAt);
  if (durable?.armed) return true;
  warehousePositionPromptActivations.set(key, armedAt);
  if (warehousePositionPromptActivations.size > 1e3) {
    for (const [activationKey, timestamp] of warehousePositionPromptActivations) {
      if (armedAt - timestamp > 6e4) warehousePositionPromptActivations.delete(activationKey);
    }
  }
  return true;
}
__name(armWarehousePositionPrompt, "armWarehousePositionPrompt");
async function takeWarehousePositionPrompt(event, env) {
  const now = Number(event.timestamp) || Date.now();
  const durable = await durableWarehousePositionPrompt(event, env, "take", now);
  if (typeof durable?.valid === "boolean" && typeof durable?.existed === "boolean") return durable;
  const key = warehousePositionPromptKey(event);
  const armedAt = warehousePositionPromptActivations.get(key);
  warehousePositionPromptActivations.delete(key);
  if (!armedAt) return { valid: false, existed: false };
  const elapsed = now - Number(armedAt);
  return {
    valid: elapsed >= 0 && elapsed <= warehousePositionPromptTtlMs,
    existed: true,
    elapsed
  };
}
__name(takeWarehousePositionPrompt, "takeWarehousePositionPrompt");
async function takePendingLineProduct(event, env) {
  if (!env.LINE_PENDING) return null;
  const key = linePendingKey(event);
  const value = await env.LINE_PENDING.get(key, "json");
  if (!value?.productUrl) return null;
  await env.LINE_PENDING.delete(key);
  return value;
}
__name(takePendingLineProduct, "takePendingLineProduct");
function lineScheduleScope(event) {
  const source = event?.source || {};
  return source.groupId || source.roomId || source.userId || "unknown-chat";
}
__name(lineScheduleScope, "lineScheduleScope");
function lineScheduleStub(env, name) {
  const id = env.LINE_ACTIVATION.idFromName(name);
  return env.LINE_ACTIVATION.get(id);
}
__name(lineScheduleStub, "lineScheduleStub");
async function migrateLegacyLineSchedule(event, env, globalStub) {
  const legacyScope = lineScheduleScope(event);
  const legacyName = `line-schedule:${legacyScope}`;
  if (legacyName === globalLineScheduleName) return;
  try {
    const legacyResponse = await lineScheduleStub(env, legacyName).fetch("https://line-schedule/schedule/list", {
      method: "POST"
    });
    if (!legacyResponse.ok) return;
    const legacy = await legacyResponse.json();
    const importResponse = await globalStub.fetch("https://line-schedule/schedule/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceScope: legacyScope,
        pending: legacy.pending || [],
        completed: legacy.completed || []
      })
    });
    if (!importResponse.ok) console.error("LINE schedule migration import failed", importResponse.status);
  } catch (error) {
    console.error("LINE schedule migration error", error?.message || error);
  }
}
__name(migrateLegacyLineSchedule, "migrateLegacyLineSchedule");
async function lineScheduleRequest(event, env, action, body = {}) {
  if (!env.LINE_ACTIVATION) throw httpError("\u5EE3\u544A\u5F71\u7247\u6392\u7A0B\u5132\u5B58\u670D\u52D9\u5C1A\u672A\u8A2D\u5B9A", 503);
  const stub = lineScheduleStub(env, globalLineScheduleName);
  await migrateLegacyLineSchedule(event, env, stub);
  const response = await stub.fetch(`https://line-schedule/schedule/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw httpError("\u5EE3\u544A\u5F71\u7247\u6392\u7A0B\u66AB\u6642\u7121\u6CD5\u4F7F\u7528", 503);
  return response.json();
}
__name(lineScheduleRequest, "lineScheduleRequest");
async function acquireLineScheduleGeneration(env) {
  if (!env.LINE_ACTIVATION) throw httpError("\u5EE3\u544A\u5F71\u7247\u6392\u7A0B\u5132\u5B58\u670D\u52D9\u5C1A\u672A\u8A2D\u5B9A", 503);
  const response = await lineScheduleStub(env, globalLineScheduleName).fetch(
    "https://line-schedule/schedule/generation-acquire",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ttlMs: 3e4 })
    }
  );
  if (!response.ok) throw httpError("\u6587\u6848\u7522\u751F\u9396\u5B9A\u670D\u52D9\u66AB\u6642\u7121\u6CD5\u4F7F\u7528", 503);
  return response.json();
}
__name(acquireLineScheduleGeneration, "acquireLineScheduleGeneration");
async function releaseLineScheduleGeneration(env, token) {
  if (!env.LINE_ACTIVATION || !token) return;
  try {
    await lineScheduleStub(env, globalLineScheduleName).fetch(
      "https://line-schedule/schedule/generation-release",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      }
    );
  } catch (error) {
    console.error("LINE schedule generation release error", error?.message || error);
  }
}
__name(releaseLineScheduleGeneration, "releaseLineScheduleGeneration");
async function warehouseLocationRequest(env, sku, includeImage = true) {
  if (!env.LINE_ACTIVATION) throw httpError("ERP \u5132\u4F4D\u67E5\u8A62\u670D\u52D9\u5C1A\u672A\u8A2D\u5B9A", 503);
  const stub = lineScheduleStub(env, globalLineScheduleName);
  const response = await stub.fetch("https://line-schedule/warehouse-locations/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sku, includeImage })
  });
  if (!response.ok) throw httpError("ERP \u5132\u4F4D\u67E5\u8A62\u66AB\u6642\u7121\u6CD5\u4F7F\u7528", 503);
  return response.json();
}
__name(warehouseLocationRequest, "warehouseLocationRequest");
async function warehouseStorageLocationRequest(env, location, page = 1, includeUnavailable = true) {
  if (!env.LINE_ACTIVATION) throw httpError("ERP \u5132\u4F4D\u67E5\u8A62\u670D\u52D9\u5C1A\u672A\u8A2D\u5B9A", 503);
  const stub = lineScheduleStub(env, globalLineScheduleName);
  const response = await stub.fetch("https://line-schedule/warehouse-locations/query-storage-location", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location, page, includeUnavailable })
  });
  if (!response.ok) throw httpError("ERP \u5132\u4F4D\u53CD\u67E5\u66AB\u6642\u7121\u6CD5\u4F7F\u7528", 503);
  return response.json();
}
__name(warehouseStorageLocationRequest, "warehouseStorageLocationRequest");
async function sha256Hex(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value || ""))));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(sha256Hex, "sha256Hex");
async function lineOrderAuthorizationStorageKey(userId) {
  return `line-order-authorized-user:${await sha256Hex(userId)}`;
}
__name(lineOrderAuthorizationStorageKey, "lineOrderAuthorizationStorageKey");
async function lineOrderRecentSelectionStorageKey(userId) {
  return `line-order-recent-selection:${await sha256Hex(userId)}`;
}
__name(lineOrderRecentSelectionStorageKey, "lineOrderRecentSelectionStorageKey");
async function lineOrderBindingTokenStorageKey(token) {
  return `line-order-binding-token:${await sha256Hex(token)}`;
}
__name(lineOrderBindingTokenStorageKey, "lineOrderBindingTokenStorageKey");
function parseLineOrderBindingCommand(text) {
  const normalized = normalizeScheduleDigits(String(text || "")).normalize("NFKC").trim();
  const match = normalized.match(/^(?:綁定訂單|訂單綁定)(?:\s+(.+))?$/u);
  if (!match) return null;
  const token = String(match[1] || "").trim();
  return /^[A-Za-z0-9_-]{8,64}$/u.test(token) ? token : "";
}
__name(parseLineOrderBindingCommand, "parseLineOrderBindingCommand");
function lineOrderLookupAllowedBySecret(event, env) {
  if (event?.source?.type !== "user" || !event.source.userId) return false;
  const allowed = new Set(
    String(env.LINE_ORDER_ALLOWED_USER_IDS || "").split(",").map((value) => value.trim()).filter(Boolean)
  );
  return allowed.has(String(event.source.userId));
}
__name(lineOrderLookupAllowedBySecret, "lineOrderLookupAllowedBySecret");
async function lineOrderLookupAllowed(event, env) {
  if (lineOrderLookupAllowedBySecret(event, env)) return true;
  if (event?.source?.type !== "user" || !event.source.userId || !env.LINE_ACTIVATION) return false;
  try {
    const response = await lineScheduleStub(env, globalLineScheduleName).fetch(
      "https://line-schedule/erp-orders/user-authorized",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: event.source.userId })
      }
    );
    if (!response.ok) return false;
    return Boolean((await response.json())?.authorized);
  } catch (error) {
    console.error("LINE order authorization check error", error?.message || error);
    return false;
  }
}
__name(lineOrderLookupAllowed, "lineOrderLookupAllowed");
function erpOrderSkuPostback(state = {}) {
  const params = new URLSearchParams({
    action: erpOrderSkuAction,
    step: String(state.step || "menu"),
    sku: String(state.sku || "")
  });
  if (state.status) params.set("status", String(state.status));
  if (state.page) params.set("page", String(state.page));
  return params.toString();
}
__name(erpOrderSkuPostback, "erpOrderSkuPostback");
function erpOrderSkuQuickReplyItem(label, state, displayText = label) {
  return {
    type: "action",
    action: {
      type: "postback",
      label,
      data: erpOrderSkuPostback(state),
      displayText
    }
  };
}
__name(erpOrderSkuQuickReplyItem, "erpOrderSkuQuickReplyItem");
function createErpOrderSkuChoiceMessage(sku) {
  const normalizedSku = erpOrderSkuKeys(sku)[0] || "";
  if (!normalizedSku) return null;
  return {
    type: "text",
    text: `\u{1F4E6} ${normalizedSku}
\u4F60\u8981\u67E5\u4EC0\u9EBC\uFF1F`,
    quickReply: {
      items: [
        erpOrderSkuQuickReplyItem("\u67E5\u5132\u4F4D", { step: "warehouse", sku: normalizedSku }, `\u67E5\u5132\u4F4D ${normalizedSku}`),
        erpOrderSkuQuickReplyItem("\u67E5\u8A02\u55AE", { step: "order", sku: normalizedSku }, `\u67E5\u8A02\u55AE ${normalizedSku}`)
      ]
    }
  };
}
__name(createErpOrderSkuChoiceMessage, "createErpOrderSkuChoiceMessage");
function createErpOrderSkuStatusPrompt(sku) {
  const normalizedSku = erpOrderSkuKeys(sku)[0] || "";
  if (!normalizedSku) return null;
  return {
    type: "text",
    text: `\u{1F4E6} ${normalizedSku}
\u8ACB\u9078\u64C7\u8A02\u55AE\u72C0\u614B\uFF1A`,
    quickReply: {
      items: erpOrderSkuStatuses.map((status) => erpOrderSkuQuickReplyItem(
        status,
        { step: "status", sku: normalizedSku, status, page: 1 },
        `${normalizedSku}\uFF5C${status}`
      ))
    }
  };
}
__name(createErpOrderSkuStatusPrompt, "createErpOrderSkuStatusPrompt");
function erpOrderSkuResultQuickReplies(sku, status, page, totalPages) {
  const items = [];
  if (page > 1) {
    items.push(erpOrderSkuQuickReplyItem(
      "\u2B05\uFE0F \u4E0A\u4E00\u9801",
      { step: "status", sku, status, page: page - 1 },
      `${sku}\uFF5C${status}\uFF5C\u4E0A\u4E00\u9801`
    ));
  }
  if (page < totalPages) {
    items.push(erpOrderSkuQuickReplyItem(
      "\u27A1\uFE0F \u4E0B\u4E00\u9801",
      { step: "status", sku, status, page: page + 1 },
      `${sku}\uFF5C${status}\uFF5C\u4E0B\u4E00\u9801`
    ));
  }
  for (const choice of erpOrderSkuStatuses) {
    items.push(erpOrderSkuQuickReplyItem(
      choice,
      { step: "status", sku, status: choice, page: 1 },
      `${sku}\uFF5C${choice}`
    ));
  }
  return items;
}
__name(erpOrderSkuResultQuickReplies, "erpOrderSkuResultQuickReplies");
function createErpOrderSkuStatusMessage(result, request, now = Date.now()) {
  const lookup = normalizeErpOrderSkuStatusRequest(request);
  const metadata = result?.metadata || null;
  const updatedAt = Date.parse(String(metadata?.updatedAt || ""));
  const updatedLine = Number.isFinite(updatedAt) ? `ERP \u66F4\u65B0\uFF1A${formatTaipeiDate(updatedAt)}` : "ERP \u66F4\u65B0\uFF1A\u6642\u9593\u4E0D\u660E";
  const stale = !Number.isFinite(updatedAt) || Number(now) - updatedAt > erpOrderMaxSnapshotAgeMs || updatedAt > Number(now) + 5 * 6e4;
  if (stale) {
    return {
      type: "text",
      text: `\u26A0\uFE0F \u8A02\u55AE\u67E5\u8A62\u66AB\u505C

ERP \u8A02\u55AE\u8CC7\u6599\u5DF2\u8D85\u904E 30 \u5206\u9418\u6216\u6642\u9593\u7121\u6548\uFF0C\u70BA\u907F\u514D\u56DE\u8986\u820A\u8CC7\u6599\uFF0C\u8ACB\u5148\u78BA\u8A8D NAS \u540C\u6B65\u3002
${updatedLine}`
    };
  }
  const orders = Array.isArray(result?.orders) ? result.orders : [];
  const totalCount = Math.max(0, Number(result?.totalCount) || 0);
  const totalPages = Math.max(1, Number(result?.totalPages) || 1);
  const page = Math.min(totalPages, Math.max(1, Number(result?.page) || lookup.page));
  const lines = [
    `\u{1F4E6} ${lookup.sku}\uFF5C${lookup.status}`,
    totalCount ? `\u627E\u5230 ${totalCount} \u7B46\u7B26\u5408\u7684\u8A02\u55AE\uFF5C\u7B2C ${page}/${totalPages} \u9801` : "\u76EE\u524D\u67E5\u7121\u7B26\u5408\u7684\u8A02\u55AE\u3002"
  ];
  if (orders.length) lines.push("");
  orders.forEach((order, index) => {
    const number = normalizeErpOrderAlias(order?.number);
    const printable = /^\d{4,10}-\d{6,12}$/u.test(number);
    lines.push(`${(page - 1) * erpOrderSkuStatusPageSize + index + 1}. ${printable ? number : `\u4EA4\u6613 ${order?.transactionNo || number || "\u672A\u63D0\u4F9B"}`}`);
    const items = collapseErpOrderItems(order?.matchedItems).slice(0, 5);
    for (const item of items) {
      const itemSku = normalizeWarehouseSku(item?.sku) || lookup.sku;
      const details = [itemSku, String(item?.name || "\u5546\u54C1").trim(), erpOrderItemStyle(item)].filter((value, detailIndex) => value && !(detailIndex === 2 && value === "\u672A\u6A19\u793A\u898F\u683C")).join("\uFF5C");
      lines.push(`   ${details}\uFF5C\xD7${Number(item?.quantity) || 0}`);
    }
    if (Array.isArray(order?.matchedItems) && order.matchedItems.length > items.length) {
      lines.push(`   \u2026\u53E6\u6709 ${order.matchedItems.length - items.length} \u500B\u7B26\u5408\u898F\u683C`);
    }
    if (order?.detailsIncomplete) lines.push("   \u26A0\uFE0F \u6B64\u7B46\u9010\u5F35\u660E\u7D30\u4E0D\u5B8C\u6574\uFF0C\u8ACB\u7528\u55AE\u865F\u518D\u67E5\u4E00\u6B21");
  });
  if (orders.length) lines.push("", "\u23F1\uFE0F 10 \u79D2\u5167\u76F4\u63A5\u8F38\u5165\u4E0A\u65B9\u7DE8\u865F\uFF0C\u53EF\u67E5\u770B\u5B8C\u6574\u8A02\u55AE\u3002");
  const partialCount = Math.max(0, Number(result?.partialCount) || 0);
  if (partialCount) lines.push("", `\u26A0\uFE0F \u5171 ${partialCount} \u7B46\u9010\u5F35\u660E\u7D30\u5C1A\u672A\u5B8C\u6574\u540C\u6B65\u3002`);
  lines.push("", updatedLine);
  const message = { type: "text", text: joinErpOrderMessageLines(lines, 4900, 1) };
  const quickReplyItems = erpOrderSkuResultQuickReplies(lookup.sku, lookup.status, page, totalPages);
  if (quickReplyItems.length) message.quickReply = { items: quickReplyItems };
  return message;
}
__name(createErpOrderSkuStatusMessage, "createErpOrderSkuStatusMessage");
function erpOrderSkuPostbackState(params) {
  if (params.get("action") !== erpOrderSkuAction) return null;
  const sku = erpOrderSkuKeys(params.get("sku"))[0] || "";
  const step = String(params.get("step") || "");
  if (!sku || !["warehouse", "order", "status"].includes(step)) return null;
  const status = String(params.get("status") || "").normalize("NFKC").replace(/\s+/gu, "").trim();
  if (step === "status" && !erpOrderSkuStatuses.includes(status)) return null;
  return {
    sku,
    step,
    status,
    page: Math.max(1, Number.parseInt(params.get("page"), 10) || 1)
  };
}
__name(erpOrderSkuPostbackState, "erpOrderSkuPostbackState");
async function bindLineOrderLookupUser(event, bindToken, env) {
  if (event?.source?.type !== "user" || !event.source.userId || !env.LINE_ACTIVATION) {
    throw httpError("\u8A02\u55AE\u6388\u6B0A\u670D\u52D9\u5C1A\u672A\u8A2D\u5B9A", 503);
  }
  const response = await lineScheduleStub(env, globalLineScheduleName).fetch(
    "https://line-schedule/erp-orders/bind-user",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: event.source.userId, bindToken })
    }
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok && result?.error !== "ORDER_BINDING_ALREADY_USED") {
    throw httpError("\u8A02\u55AE\u6388\u6B0A\u66AB\u6642\u7121\u6CD5\u4F7F\u7528", 503);
  }
  return result;
}
__name(bindLineOrderLookupUser, "bindLineOrderLookupUser");
async function erpOrderRequest(env, lookup) {
  if (!env.LINE_ACTIVATION) throw httpError("ERP \u8A02\u55AE\u67E5\u8A62\u670D\u52D9\u5C1A\u672A\u8A2D\u5B9A", 503);
  const normalizedLookup = normalizeErpOrderLookupRequest(lookup);
  const response = await lineScheduleStub(env, globalLineScheduleName).fetch(
    "https://line-schedule/erp-orders/query",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: normalizedLookup.query })
    }
  );
  if (!response.ok) throw httpError("ERP \u8A02\u55AE\u67E5\u8A62\u66AB\u6642\u7121\u6CD5\u4F7F\u7528", 503);
  return response.json();
}
__name(erpOrderRequest, "erpOrderRequest");
async function erpOrderSkuStatusRequest(env, request) {
  if (!env.LINE_ACTIVATION) throw httpError("ERP \u8A02\u55AE\u67E5\u8A62\u670D\u52D9\u5C1A\u672A\u8A2D\u5B9A", 503);
  const lookup = normalizeErpOrderSkuStatusRequest(request);
  if (!lookup.sku || !lookup.status) throw httpError("\u8CA8\u865F\u6216\u8A02\u55AE\u72C0\u614B\u7121\u6548", 400);
  const response = await lineScheduleStub(env, globalLineScheduleName).fetch(
    "https://line-schedule/erp-orders/query-sku-status",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lookup)
    }
  );
  if (!response.ok) throw httpError("ERP \u8CA8\u865F\u8A02\u55AE\u67E5\u8A62\u66AB\u6642\u7121\u6CD5\u4F7F\u7528", 503);
  return response.json();
}
__name(erpOrderSkuStatusRequest, "erpOrderSkuStatusRequest");
async function replyErpOrderSkuPostback(event, params, env) {
  if (event.source?.type !== "user") return;
  const state = erpOrderSkuPostbackState(params);
  if (!state) return;
  if (state.step === "warehouse") {
    await replyWarehouseLocation(event, state.sku, env);
    return;
  }
  if (!await lineOrderLookupAllowed(event, env)) {
    await replyLine(event.replyToken, "\u{1F512} \u8A02\u55AE\u67E5\u8A62\u53EA\u9650\u5DF2\u6388\u6B0A\u7684 LINE \u79C1\u8A0A\u5E33\u865F\u4F7F\u7528\u3002", env);
    return;
  }
  if (state.step === "order") {
    await replyLine(event.replyToken, [createErpOrderSkuStatusPrompt(state.sku)], env);
    return;
  }
  try {
    const result = await erpOrderSkuStatusRequest(env, state);
    console.log("LINE_ORDER_SKU_STATUS", JSON.stringify({
      authorized: true,
      sku: state.sku,
      status: state.status,
      totalCount: Number(result?.totalCount) || 0,
      page: Number(result?.page) || state.page
    }));
    const orders = Array.isArray(result?.orders) ? result.orders : [];
    const message = createErpOrderSkuStatusMessage(result, state);
    const selectionSaved = await updateLineOrderSkuStatusSelection(event, result, state, env);
    if (orders.length && /10 秒內直接輸入上方編號/u.test(message.text) && !selectionSaved) {
      throw httpError("\u8A02\u55AE\u7DE8\u865F\u9078\u55AE\u66AB\u6642\u7121\u6CD5\u5B89\u5168\u555F\u7528\uFF0C\u8ACB\u91CD\u65B0\u9078\u64C7\u72C0\u614B", 503);
    }
    await replyLine(event.replyToken, [message], env);
  } catch (error) {
    console.error("LINE order SKU status lookup error", error?.message || error);
    await replyLine(event.replyToken, `\u76EE\u524D\u7121\u6CD5\u4F9D\u8CA8\u865F\u67E5\u8A62 ERP \u8A02\u55AE\uFF1A${error?.message || "\u8ACB\u7A0D\u5F8C\u518D\u8A66"}`, env);
  }
}
__name(replyErpOrderSkuPostback, "replyErpOrderSkuPostback");
async function clearLineOrderRecentSelection(event, env) {
  if (event?.source?.type !== "user" || !event.source.userId || !env.LINE_ACTIVATION) return false;
  const response = await lineScheduleStub(env, globalLineScheduleName).fetch(
    "https://line-schedule/erp-orders/recent-selection/clear",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: event.source.userId })
    }
  );
  if (!response.ok) {
    throw httpError("ERP \u8A02\u55AE\u9078\u55AE\u66AB\u6642\u7121\u6CD5\u5B89\u5168\u6E05\u9664", 503);
  }
  return true;
}
__name(clearLineOrderRecentSelection, "clearLineOrderRecentSelection");
async function updateLineOrderRecentSelection(event, result, lookup, env, now = Date.now()) {
  if (event?.source?.type !== "user" || !event.source.userId || !env.LINE_ACTIVATION) return false;
  const context = erpOrderRecentSelectionContext(result, lookup, now);
  if (!context) {
    await clearLineOrderRecentSelection(event, env);
    return false;
  }
  const response = await lineScheduleStub(env, globalLineScheduleName).fetch(
    "https://line-schedule/erp-orders/recent-selection/save",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: event.source.userId, ...context })
    }
  );
  if (!response.ok) throw httpError("ERP \u8A02\u55AE\u9078\u55AE\u66AB\u6642\u7121\u6CD5\u5B89\u5168\u66F4\u65B0", 503);
  return Boolean((await response.json())?.saved);
}
__name(updateLineOrderRecentSelection, "updateLineOrderRecentSelection");
async function updateLineOrderSkuStatusSelection(event, result, request, env, now = Date.now()) {
  if (event?.source?.type !== "user" || !event.source.userId || !env.LINE_ACTIVATION) return false;
  const context = erpOrderSkuStatusSelectionContext(result, request, now);
  if (!context) {
    await clearLineOrderRecentSelection(event, env);
    return false;
  }
  const response = await lineScheduleStub(env, globalLineScheduleName).fetch(
    "https://line-schedule/erp-orders/recent-selection/save",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: event.source.userId, ...context })
    }
  );
  if (!response.ok) throw httpError("ERP \u8A02\u55AE\u7DE8\u865F\u9078\u55AE\u66AB\u6642\u7121\u6CD5\u5B89\u5168\u66F4\u65B0", 503);
  return Boolean((await response.json())?.saved);
}
__name(updateLineOrderSkuStatusSelection, "updateLineOrderSkuStatusSelection");
async function resolveLineOrderRecentSelection(event, index, env, now = Date.now()) {
  if (event?.source?.type !== "user" || !event.source.userId || !env.LINE_ACTIVATION) return null;
  const response = await lineScheduleStub(env, globalLineScheduleName).fetch(
    "https://line-schedule/erp-orders/recent-selection/resolve",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: event.source.userId, index, now })
    }
  );
  if (!response.ok) throw httpError("\u51FA\u8CA8\u55AE\u7DE8\u865F\u9078\u64C7\u66AB\u6642\u7121\u6CD5\u4F7F\u7528", 503);
  return response.json();
}
__name(resolveLineOrderRecentSelection, "resolveLineOrderRecentSelection");
async function lineBotInfo(env) {
  const token = String(env.LINE_CHANNEL_ACCESS_TOKEN || "");
  if (!token) throw httpError("LINE \u5E33\u865F\u5C1A\u672A\u8A2D\u5B9A", 503);
  if (lineBotInfoCache.token === token && lineBotInfoCache.expiresAt > Date.now() && lineBotInfoCache.info) {
    return lineBotInfoCache.info;
  }
  const response = await fetch("https://api.line.me/v2/bot/info", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw httpError("\u7121\u6CD5\u6838\u5C0D\u76EE\u524D LINE \u5B98\u65B9\u5E33\u865F", 503);
  const info = await response.json();
  lineBotInfoCache = { token, info, expiresAt: Date.now() + 10 * 6e4 };
  return info;
}
__name(lineBotInfo, "lineBotInfo");
async function warehousePositionDryRunAccess(event, env) {
  if (event.source?.type !== "user" || !event.source?.userId) {
    return {
      ok: false,
      message: "\u{1F512} \u70BA\u4E86\u907F\u514D\u8AA4\u6539\u8CC7\u6599\uFF0C\u300E\u6539\u5132\u4F4D\u300F\u6F14\u7DF4\u53EA\u80FD\u5728 @059hdfyo \u79C1\u8A0A\u4E2D\u4F7F\u7528\u3002\n\n\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002"
    };
  }
  const info = await lineBotInfo(env);
  if (String(info?.basicId || "").toLowerCase() !== warehousePositionDryRunTargetBasicId.toLowerCase()) {
    return {
      ok: false,
      message: `\u{1F512} \u5132\u4F4D\u529F\u80FD\u5DF2\u505C\u6B62\uFF1A\u76EE\u524D LINE \u5B98\u65B9\u5E33\u865F\u4E0D\u662F ${warehousePositionDryRunTargetBasicId}\u3002

\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002`
    };
  }
  return { ok: true };
}
__name(warehousePositionDryRunAccess, "warehousePositionDryRunAccess");
async function warehousePositionWriteUserCode(event) {
  return (await sha256Hex(event?.source?.userId || "")).slice(0, 20);
}
__name(warehousePositionWriteUserCode, "warehousePositionWriteUserCode");
async function warehousePositionWriteAllowed(event, env) {
  if (event?.source?.type !== "user" || !event.source.userId) return false;
  const allowed = new Set(String(env.LINE_WAREHOUSE_WRITE_ALLOWED_USER_CODES || "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
  return allowed.has(await warehousePositionWriteUserCode(event));
}
__name(warehousePositionWriteAllowed, "warehousePositionWriteAllowed");
function erpWritebackBrokerStub(env) {
  if (!env.LINE_ACTIVATION) throw httpError("ERP \u5132\u4F4D\u5BEB\u5165\u9023\u7DDA\u5C1A\u672A\u8A2D\u5B9A", 503);
  return env.LINE_ACTIVATION.get(env.LINE_ACTIVATION.idFromName("erp-writeback-broker-v1"));
}
__name(erpWritebackBrokerStub, "erpWritebackBrokerStub");
function erpWritebackUserStub(event, env) {
  if (!env.LINE_ACTIVATION || !event?.source?.userId) throw httpError("ERP \u5132\u4F4D\u78BA\u8A8D\u670D\u52D9\u5C1A\u672A\u8A2D\u5B9A", 503);
  return env.LINE_ACTIVATION.get(env.LINE_ACTIVATION.idFromName(
    `erp-writeback-user:${event.source.userId}`
  ));
}
__name(erpWritebackUserStub, "erpWritebackUserStub");
async function saveWarehousePositionCustomInput(event, env, target) {
  const response = await erpWritebackUserStub(event, env).fetch(
    "https://erp-writeback/warehouse-position-custom/save",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...target, createdAt: Date.now() })
    }
  );
  return response.ok && Boolean((await response.json().catch(() => ({})))?.saved);
}
__name(saveWarehousePositionCustomInput, "saveWarehousePositionCustomInput");
async function takeWarehousePositionCustomInput(event, env) {
  if (event?.source?.type !== "user" || !event.source.userId || !env.LINE_ACTIVATION) return null;
  const response = await erpWritebackUserStub(event, env).fetch(
    "https://erp-writeback/warehouse-position-custom/take",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ now: Date.now() })
    }
  );
  if (!response.ok) throw httpError("\u81EA\u8A02\u5132\u4F4D\u670D\u52D9\u66AB\u6642\u7121\u6CD5\u4F7F\u7528", 503);
  return response.json();
}
__name(takeWarehousePositionCustomInput, "takeWarehousePositionCustomInput");
async function dispatchErpWriteback(env, job) {
  const response = await erpWritebackBrokerStub(env).fetch("https://erp-writeback/erp/writeback/dispatch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(job)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.ok) {
    throw httpError(`ERP \u5BEB\u5165\u670D\u52D9\u672A\u5B8C\u6210\uFF1A${String(body?.error || "UNKNOWN").slice(0, 180)}`, 503);
  }
  return body.result;
}
__name(dispatchErpWriteback, "dispatchErpWriteback");
async function saveErpWritebackConfirmation(event, env, pending) {
  const response = await erpWritebackUserStub(event, env).fetch(
    "https://erp-writeback/erp/writeback/confirmation/save",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pending)
    }
  );
  return response.ok && Boolean((await response.json().catch(() => ({})))?.saved);
}
__name(saveErpWritebackConfirmation, "saveErpWritebackConfirmation");
async function takeErpWritebackConfirmation(event, env, id, cancel = false) {
  const response = await erpWritebackUserStub(event, env).fetch(
    "https://erp-writeback/erp/writeback/confirmation/take",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, now: Date.now(), cancel })
    }
  );
  if (!response.ok) throw httpError("ERP \u5132\u4F4D\u78BA\u8A8D\u670D\u52D9\u66AB\u6642\u7121\u6CD5\u4F7F\u7528", 503);
  return response.json();
}
__name(takeErpWritebackConfirmation, "takeErpWritebackConfirmation");
async function replyWarehouseWriteAuthorizationCode(event, env) {
  const access = await warehousePositionDryRunAccess(event, env);
  if (!access.ok) {
    await replyLine(event.replyToken, access.message, env);
    return;
  }
  const code = await warehousePositionWriteUserCode(event);
  await replyLine(
    event.replyToken,
    `\u{1F510} \u4F60\u7684\u5132\u4F4D\u5BEB\u5165\u6388\u6B0A\u78BC\uFF1A${code}

\u9019\u662F\u7528 LINE \u79C1\u8A0A\u8EAB\u5206\u7B97\u51FA\u7684\u8B58\u5225\u78BC\uFF0C\u8ACB\u53EA\u63D0\u4F9B\u7D66\u7BA1\u7406\u8005\u8A2D\u5B9A\u767D\u540D\u55AE\uFF1B\u76EE\u524D\u4E0D\u6703\u5BEB\u5165 ERP\u3002`,
    env
  );
}
__name(replyWarehouseWriteAuthorizationCode, "replyWarehouseWriteAuthorizationCode");
async function replyWarehousePositionWritePreview(event, command, env) {
  try {
    const access = await warehousePositionDryRunAccess(event, env);
    if (!access.ok) throw httpError(access.message, 403);
    if (!await warehousePositionWriteAllowed(event, env)) {
      throw httpError("\u6B64 LINE \u79C1\u8A0A\u5E33\u865F\u5C1A\u672A\u7372\u51C6\u5BEB\u5165\uFF1B\u8ACB\u5148\u50B3\u300C\u5132\u4F4D\u5BEB\u5165\u6388\u6B0A\u78BC\u300D\u7D66\u7BA1\u7406\u8005\u3002", 403);
    }
    const snapshot = await warehouseLocationRequest(env, command.goodId, false);
    const snapshotError = warehousePositionDryRunSnapshotError(snapshot?.item, snapshot?.metadata);
    if (snapshotError) throw httpError(snapshotError, 503);
    const variants = warehousePositionIdentifiedVariants(snapshot.item);
    const selected = variants.filter(({ barcode }) => barcode === command.itemUID);
    if (variants.length !== (snapshot.item.variants || []).length || selected.length !== 1) {
      throw httpError("ERP \u5B50\u8CA8\u865F\u8CC7\u6599\u4E0D\u552F\u4E00\u6216\u4E0D\u5B8C\u6574\uFF0C\u5DF2\u505C\u6B62\u3002", 409);
    }
    const actorHash = await sha256Hex(event.source.userId);
    const result = await dispatchErpWriteback(env, {
      type: "plan",
      ...command,
      actorHash,
      requestId: `line-plan-${crypto.randomUUID()}`
    });
    if (result?.status !== "backup_only_no_erp_write" || result.goodId !== command.goodId || result.itemUID !== command.itemUID || result.warehouseId !== 1 || result.newLocation !== command.newLocation || !/^[0-9a-f]{64}$/u.test(String(result.beforeProductSha256 || "")) || !result.backupRecorded || !result.eventRecorded) throw httpError("ERP \u9810\u89BD\u6216\u5099\u4EFD\u9A57\u8B49\u5931\u6557\uFF0C\u5DF2\u505C\u6B62\u3002", 503);
    const now = Date.now();
    const id = crypto.randomUUID();
    const pending = {
      id,
      createdAt: now,
      expiresAt: now + warehousePositionWriteConfirmTtlMs,
      goodId: command.goodId,
      itemUID: command.itemUID,
      oldLocation: result.oldLocation,
      newLocation: result.newLocation,
      expectedProductSha256: result.beforeProductSha256,
      actorHash
    };
    if (!await saveErpWritebackConfirmation(event, env, pending)) {
      throw httpError("ERP \u5132\u4F4D\u78BA\u8A8D\u8CC7\u6599\u7121\u6CD5\u5B89\u5168\u4FDD\u5B58\uFF0C\u5DF2\u505C\u6B62\u3002", 503);
    }
    const postback = /* @__PURE__ */ __name((decision) => new URLSearchParams({
      action: warehousePositionWriteAction,
      id,
      decision
    }).toString(), "postback");
    await replyLine(event.replyToken, [{
      type: "text",
      text: [
        "\u{1F4E6} ERP \u5132\u4F4D\u4FEE\u6539\u78BA\u8A8D\uFF08\u5C1A\u672A\u5BEB\u5165\uFF09",
        `\u5546\u54C1\uFF1A${snapshot.item.name || command.goodId}`,
        `\u5B50\u8CA8\u865F\uFF1A${command.itemUID}`,
        "\u5009\u5EAB\uFF1A\u4E3B\u5009",
        `ERP \u5373\u6642\u539F\u5132\u4F4D\uFF1A${result.oldLocation || "\u5C1A\u672A\u8A2D\u5B9A"}`,
        `\u9810\u8A08\u65B0\u5132\u4F4D\uFF1A${result.newLocation}`,
        "\u5DF2\u5EFA\u7ACB\u55AE\u7B46\u5B8C\u6574\u5099\u4EFD\u3002\u8ACB\u5728 2 \u5206\u9418\u5167\u78BA\u8A8D\uFF1B\u82E5 ERP \u5546\u54C1\u8CC7\u6599\u8B8A\u52D5\uFF0C\u5BEB\u5165\u6703\u81EA\u52D5\u505C\u6B62\u3002"
      ].join("\n"),
      quickReply: { items: [
        { type: "action", action: { type: "postback", label: "\u78BA\u8A8D\u4FEE\u6539", data: postback("apply"), displayText: "\u78BA\u8A8D\u4FEE\u6539" } },
        { type: "action", action: { type: "postback", label: "\u53D6\u6D88", data: postback("cancel"), displayText: "\u53D6\u6D88\u4FEE\u6539" } }
      ] }
    }], env);
  } catch (error) {
    console.error("LINE warehouse writeback preview failed", error?.message || error);
    await replyLine(
      event.replyToken,
      `\u26A0\uFE0F \u5132\u4F4D\u4FEE\u6539\u672A\u57F7\u884C\uFF1A${error?.message || "\u8ACB\u7A0D\u5F8C\u518D\u8A66"}

\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002`,
      env
    );
  }
}
__name(replyWarehousePositionWritePreview, "replyWarehousePositionWritePreview");
async function replyWarehousePositionBatchWritePreview(event, command, env) {
  try {
    const access = await warehousePositionDryRunAccess(event, env);
    if (!access.ok) throw httpError(access.message, 403);
    if (!await warehousePositionWriteAllowed(event, env)) throw httpError("\u6B64 LINE \u79C1\u8A0A\u5E33\u865F\u5C1A\u672A\u7372\u51C6\u5BEB\u5165\u3002", 403);
    const target = warehousePositionBatchTarget(command.goodId, command.itemUIDs);
    if (!target) throw httpError("\u5168\u90E8\u5BEB\u5165\u9650\u540C\u4E00\u4E3B\u8CA8\u865F\u3001\u6700\u591A 30 \u500B\u4E0D\u91CD\u8907\u5B50\u8CA8\u865F\u3002", 400);
    const snapshot = await warehouseLocationRequest(env, target.goodId, false);
    const snapshotError = warehousePositionDryRunSnapshotError(snapshot?.item, snapshot?.metadata);
    if (snapshotError) throw httpError(snapshotError, 503);
    const variants = warehousePositionIdentifiedVariants(snapshot.item);
    if (variants.length !== (snapshot.item.variants || []).length || variants.length !== target.itemUIDs.length || variants.some(({ barcode }) => !target.itemUIDs.includes(barcode))) {
      throw httpError("\u5168\u90E8\u5B50\u8CA8\u865F\u6E05\u55AE\u5DF2\u8B8A\u52D5\u6216\u4E0D\u5B8C\u6574\uFF0C\u8ACB\u91CD\u65B0\u958B\u59CB\u3002", 409);
    }
    const actorHash = await sha256Hex(event.source.userId);
    const result = await dispatchErpWriteback(env, {
      type: "plan_batch",
      ...target,
      newLocation: command.newLocation,
      actorHash,
      requestId: `line-plan-${crypto.randomUUID()}`
    });
    if (result?.status !== "backup_only_no_erp_write" || !warehousePositionBatchResultValid(result, command)) {
      throw httpError("\u5168\u90E8\u5132\u4F4D\u7684\u9810\u89BD\u6216\u5099\u4EFD\u9A57\u8B49\u5931\u6557\uFF0C\u5DF2\u505C\u6B62\u3002", 503);
    }
    const now = Date.now();
    const id = crypto.randomUUID();
    const pending = {
      id,
      scope: "all_variants",
      createdAt: now,
      expiresAt: now + warehousePositionWriteConfirmTtlMs,
      goodId: target.goodId,
      newLocation: command.newLocation,
      items: result.items,
      expectedProductSha256: result.beforeProductSha256,
      actorHash
    };
    if (!await saveErpWritebackConfirmation(event, env, pending)) throw httpError("\u6279\u6B21\u78BA\u8A8D\u8CC7\u6599\u7121\u6CD5\u5B89\u5168\u4FDD\u5B58\uFF0C\u5DF2\u505C\u6B62\u3002", 503);
    const text = [
      "\u{1F4E6} \u5168\u90E8\u5B50\u8CA8\u865F\u5132\u4F4D\u78BA\u8A8D\uFF08\u5C1A\u672A\u5BEB\u5165\uFF09",
      `\u5546\u54C1\uFF1A${snapshot.item.name || target.goodId}
\u4E3B\u8CA8\u865F\uFF1A${target.goodId}\uFF5C\u4E3B\u5009`,
      `\u5171 ${result.targetCount} \u7B46\uFF08\u4E0A\u9650 30\uFF09\uFF1B\u9700\u8B8A\u66F4 ${result.changedCount} \u7B46\uFF0C\u5DF2\u76F8\u540C ${result.targetCount - result.changedCount} \u7B46\u3002`,
      ...result.items.map((item) => `${item.itemUID}\uFF5C${item.oldLocation || "\u5C1A\u672A\u8A2D\u5B9A"} \u2192 ${item.newLocation}${item.changed ? "" : "\uFF08\u4E0D\u9700\u8B8A\u66F4\uFF09"}`),
      "\u5DF2\u5099\u4EFD\u6574\u500B\u5546\u54C1\u3002\u8ACB\u6838\u5C0D\u4E0A\u9762\u5168\u90E8\u5B50\u8CA8\u865F\uFF0C\u5728 2 \u5206\u9418\u5167\u6309\u78BA\u8A8D\u3002\u8CC7\u6599\u82E5\u6709\u8B8A\u52D5\uFF0C\u6574\u6279\u505C\u6B62\uFF1B\u5BEB\u5165\u5F8C\u6703\u9010\u7B46\u56DE\u8B80\u6AA2\u67E5\u3002"
    ].join("\n");
    const messages = splitLineText(text);
    messages.at(-1).quickReply = { items: [
      { type: "action", action: {
        type: "postback",
        label: `\u78BA\u8A8D\u5168\u90E8 ${result.targetCount} \u7B46`,
        data: new URLSearchParams({ action: warehousePositionWriteAction, id, decision: "apply" }).toString(),
        displayText: `\u78BA\u8A8D\u5168\u90E8 ${result.targetCount} \u7B46`
      } },
      { type: "action", action: {
        type: "postback",
        label: "\u53D6\u6D88",
        data: new URLSearchParams({ action: warehousePositionWriteAction, id, decision: "cancel" }).toString(),
        displayText: "\u53D6\u6D88\u5168\u90E8\u4FEE\u6539"
      } }
    ] };
    await replyLine(event.replyToken, messages, env);
  } catch (error) {
    console.error("LINE warehouse batch preview failed", error?.message || error);
    await replyLine(event.replyToken, `\u26A0\uFE0F \u5168\u90E8\u5132\u4F4D\u4FEE\u6539\u672A\u57F7\u884C\uFF1A${error?.message || "\u8ACB\u7A0D\u5F8C\u518D\u8A66"}

\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002`, env);
  }
}
__name(replyWarehousePositionBatchWritePreview, "replyWarehousePositionBatchWritePreview");
async function applyWarehousePositionBatchConfirmation(event, pending, env) {
  const target = warehousePositionBatchTarget(
    pending.goodId,
    Array.isArray(pending.items) ? pending.items.map((item) => item?.itemUID) : null
  );
  if (!warehousePositionBatchRowsValid(pending.items, target, pending.newLocation)) {
    throw httpError("\u5168\u90E8\u5B50\u8CA8\u865F\u78BA\u8A8D\u8CC7\u6599\u7121\u6548\u6216\u8D85\u904E 30 \u7B46\uFF0C\u5DF2\u505C\u6B62\u3002", 400);
  }
  const expectedOldLocations = Object.fromEntries(pending.items.map((item) => [item.itemUID, item.oldLocation]));
  const command = { ...target, newLocation: pending.newLocation };
  const result = await dispatchErpWriteback(env, {
    type: "apply_batch",
    ...command,
    expectedOldLocations,
    expectedProductSha256: pending.expectedProductSha256,
    actorHash: pending.actorHash,
    requestId: `line-apply-${pending.id}`
  });
  if (!["verified_success", "verified_success_after_uncertain_response"].includes(result?.status) || !warehousePositionBatchResultValid(result, command, expectedOldLocations) || result.beforeProductSha256 !== pending.expectedProductSha256) {
    throw httpError("ERP \u5168\u90E8\u5B50\u8CA8\u865F\u56DE\u8B80\u7D50\u679C\u7121\u6CD5\u9A57\u8B49\uFF0C\u8ACB\u505C\u6B62\u64CD\u4F5C\u4E26\u4EBA\u5DE5\u6AA2\u67E5\u3002", 503);
  }
  await replyLine(
    event.replyToken,
    `\u2705 \u5168\u90E8\u5B50\u8CA8\u865F\u5DF2\u56DE\u8B80\u78BA\u8A8D
${target.goodId}\uFF5C${result.targetCount} \u7B46 \u2192 ${pending.newLocation}
\u5BE6\u969B\u4FEE\u6539 ${result.changedCount} \u7B46\uFF0C${result.targetCount - result.changedCount} \u7B46\u539F\u672C\u5DF2\u76F8\u540C\u3002
\u5DF2\u4FDD\u5B58\u5B8C\u6574\u5546\u54C1\u5099\u4EFD\uFF0C\u5176\u4ED6\u6B04\u4F4D\u6AA2\u67E5\u7121\u5DEE\u7570\u3002LINE \u67E5\u8A62\u5FEB\u7167\u53EF\u80FD\u9700\u8981\u7B49\u4E0B\u4E00\u8F2A\u540C\u6B65\u3002`,
    env
  );
}
__name(applyWarehousePositionBatchConfirmation, "applyWarehousePositionBatchConfirmation");
async function replyWarehousePositionWriteConfirmation(event, params, env) {
  try {
    const access = await warehousePositionDryRunAccess(event, env);
    if (!access.ok) throw httpError(access.message, 403);
    if (!await warehousePositionWriteAllowed(event, env)) throw httpError("\u6B64 LINE \u79C1\u8A0A\u5E33\u865F\u672A\u7372\u51C6\u5BEB\u5165\u3002", 403);
    const id = String(params.get("id") || "");
    const decision = String(params.get("decision") || "");
    if (!/^[0-9a-f-]{36}$/u.test(id) || !["apply", "cancel"].includes(decision)) {
      throw httpError("\u78BA\u8A8D\u8CC7\u6599\u7121\u6548\u3002", 400);
    }
    const taken = await takeErpWritebackConfirmation(event, env, id, decision === "cancel");
    if (decision === "cancel") {
      await replyLine(
        event.replyToken,
        taken?.found ? "\u5DF2\u53D6\u6D88\u5132\u4F4D\u4FEE\u6539\uFF1BERP \u6C92\u6709\u8B8A\u52D5\u3002" : "\u9019\u6B21\u5132\u4F4D\u4FEE\u6539\u5DF2\u904E\u671F\u6216\u5DF2\u8655\u7406\uFF1B\u6C92\u6709\u56E0\u9019\u6B21\u6309\u9215\u5BEB\u5165 ERP\u3002",
        env
      );
      return;
    }
    if (!taken?.found || !taken?.pending) {
      throw httpError("\u78BA\u8A8D\u5DF2\u904E\u671F\u6216\u5DF2\u4F7F\u7528\uFF0C\u8ACB\u91CD\u65B0\u767C\u51FA\u6539\u5132\u4F4D\u6307\u4EE4\uFF1B\u4E0D\u8981\u91CD\u8907\u6309\u78BA\u8A8D\u3002", 409);
    }
    const pending = taken.pending;
    if (pending.scope === "all_variants") {
      await applyWarehousePositionBatchConfirmation(event, pending, env);
      return;
    }
    const result = await dispatchErpWriteback(env, {
      type: "apply",
      goodId: pending.goodId,
      itemUID: pending.itemUID,
      newLocation: pending.newLocation,
      expectedOldLocation: pending.oldLocation,
      expectedProductSha256: pending.expectedProductSha256,
      actorHash: pending.actorHash,
      requestId: `line-apply-${id}`
    });
    if (!["verified_success", "verified_success_after_uncertain_response"].includes(result?.status) || result.goodId !== pending.goodId || result.itemUID !== pending.itemUID || result.warehouseId !== 1 || result.oldLocation !== pending.oldLocation || result.newLocation !== pending.newLocation || !result.backupRecorded || !result.eventRecorded) {
      throw httpError("ERP \u56DE\u8B80\u7D50\u679C\u7121\u6CD5\u9A57\u8B49\uFF0C\u8ACB\u505C\u6B62\u64CD\u4F5C\u4E26\u4EBA\u5DE5\u6AA2\u67E5\u3002", 503);
    }
    await replyLine(
      event.replyToken,
      `\u2705 ERP \u5132\u4F4D\u5DF2\u5BEB\u5165\u4E26\u56DE\u8B80\u78BA\u8A8D
${pending.itemUID}\uFF5C${result.oldLocation || "\u5C1A\u672A\u8A2D\u5B9A"} \u2192 ${result.newLocation}
\u5DF2\u4FDD\u5B58\u5BEB\u5165\u524D\u5099\u4EFD\u3002LINE \u67E5\u8A62\u5FEB\u7167\u53EF\u80FD\u9700\u8981\u7B49\u4E0B\u4E00\u8F2A\u540C\u6B65\u3002`,
      env
    );
  } catch (error) {
    console.error("LINE warehouse writeback confirmation failed", error?.message || error);
    await replyLine(
      event.replyToken,
      `\u26A0\uFE0F ERP \u5BEB\u5165\u672A\u78BA\u8A8D\uFF1A${error?.message || "\u8ACB\u4EBA\u5DE5\u6AA2\u67E5"}
\u8ACB\u4E0D\u8981\u91CD\u8907\u6309\u78BA\u8A8D\u6216\u91CD\u65B0\u9001\u51FA\uFF1B\u5148\u67E5 ERP \u8207\u5099\u4EFD\u7D00\u9304\u3002`,
      env
    );
  }
}
__name(replyWarehousePositionWriteConfirmation, "replyWarehousePositionWriteConfirmation");
function warehousePositionVariantLabel(variant) {
  const parts = [variant?.style, variant?.size, variant?.barcode].map((value) => String(value || "").trim()).filter(Boolean);
  return parts.length ? parts.join("\uFF0F") : "\u55AE\u4E00\u898F\u683C";
}
__name(warehousePositionVariantLabel, "warehousePositionVariantLabel");
function warehousePositionDryRunSnapshotError(item, metadata, now = Date.now()) {
  if (!metadata) {
    return "\u26A0\uFE0F \u5132\u4F4D\u4FEE\u6539\u6F14\u7DF4\u5DF2\u505C\u6B62\n\nERP \u4E3B\u5009\u5FEB\u7167\u5C1A\u672A\u5B8C\u6210\u7B2C\u4E00\u6B21\u540C\u6B65\u3002\n\n\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002";
  }
  if (Number(metadata.warehouseId) !== 1) {
    return "\u26A0\uFE0F \u5132\u4F4D\u4FEE\u6539\u6F14\u7DF4\u5DF2\u505C\u6B62\n\n\u76EE\u524D\u5FEB\u7167\u4E0D\u662F\u4E3B\u5009\uFF08InventoryId=1\uFF09\uFF0C\u4E0D\u80FD\u5EFA\u7ACB\u9810\u89BD\u3002\n\n\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002";
  }
  const updatedAtMs = Date.parse(String(metadata.updatedAt || ""));
  if (!Number.isFinite(updatedAtMs) || now - updatedAtMs > warehousePositionDryRunMaxSnapshotAgeMs || updatedAtMs > now + 5 * 6e4) {
    return `\u26A0\uFE0F \u5132\u4F4D\u4FEE\u6539\u6F14\u7DF4\u5DF2\u505C\u6B62

ERP \u4E3B\u5009\u5FEB\u7167\u8D85\u904E 30 \u5206\u9418\u6216\u6642\u9593\u7121\u6548\uFF0C\u8ACB\u5148\u78BA\u8A8D\u540C\u6B65\u6B63\u5E38\u3002
\u5FEB\u7167\u6642\u9593\uFF1A${metadata.updatedAt || "\u672A\u77E5"}

\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002`;
  }
  if (!item) {
    return "\u26A0\uFE0F \u5132\u4F4D\u4FEE\u6539\u6F14\u7DF4\u5DF2\u505C\u6B62\n\nERP \u4E3B\u5009\u67E5\u7121\u6B64\u8CA8\u865F\uFF0C\u8ACB\u78BA\u8A8D\u8CA8\u865F\u662F\u5426\u5B8C\u6574\u3002\n\n\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002";
  }
  return "";
}
__name(warehousePositionDryRunSnapshotError, "warehousePositionDryRunSnapshotError");
function createWarehousePositionDryRunPreview(item, metadata, newLocation, now = Date.now(), selectedVariant = "") {
  const snapshotError = warehousePositionDryRunSnapshotError(item, metadata, now);
  if (snapshotError) return snapshotError;
  const variants = Array.isArray(item.variants) ? item.variants : [];
  const normalizedSelection = selectedVariant === "*" ? "*" : normalizeWarehouseSku(selectedVariant);
  let selected = variants;
  if (normalizedSelection && normalizedSelection !== "*") {
    selected = variants.filter((variant2) => normalizeWarehouseSku(variant2?.barcode) === normalizedSelection);
  } else if (!normalizedSelection && variants.length === 1) {
    selected = variants;
  } else if (!normalizedSelection) {
    selected = [];
  }
  if (normalizedSelection === "*" && variants.length > warehousePositionAllVariantLimit) {
    return [
      "\u26A0\uFE0F \u5132\u4F4D\u4FEE\u6539\u6F14\u7DF4\u5DF2\u505C\u6B62",
      "",
      `\u8CA8\u865F\uFF1A${item.sku}`,
      `\u898F\u683C\u6578\uFF1A${variants.length}`,
      `\u300C\u5168\u90E8\u300D\u4E00\u6B21\u6700\u591A\u5141\u8A31 ${warehousePositionAllVariantLimit} \u500B\u5B50\u8CA8\u865F\uFF0C\u8ACB\u6539\u9078\u55AE\u4E00\u5B50\u8CA8\u865F\u3002`,
      "",
      "\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002"
    ].join("\n");
  }
  if (selected.length !== 1 && normalizedSelection !== "*") {
    return [
      "\u26A0\uFE0F \u5132\u4F4D\u4FEE\u6539\u6F14\u7DF4\u5DF2\u505C\u6B62",
      "",
      `\u8CA8\u865F\uFF1A${item.sku}`,
      `\u5546\u54C1\uFF1A${item.name}`,
      `\u898F\u683C\u6578\uFF1A${variants.length}`,
      "",
      normalizedSelection ? "\u627E\u4E0D\u5230\u552F\u4E00\u7B26\u5408\u7684\u5B50\u8CA8\u865F\uFF0C\u53EF\u80FD\u662F\u8CC7\u6599\u5DF2\u66F4\u65B0\u6216\u5B50\u8CA8\u865F\u91CD\u8907\uFF1B\u7CFB\u7D71\u4E0D\u6703\u81EA\u884C\u731C\u6E2C\u3002" : "\u591A\u898F\u683C\u5546\u54C1\u5FC5\u9808\u5148\u9078\u64C7\u660E\u78BA\u7684\u5B50\u8CA8\u865F\u6216\u300E\u5168\u90E8\u300F\uFF1B\u7CFB\u7D71\u4E0D\u6703\u81EA\u884C\u731C\u6E2C\u3002",
      "",
      "\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002"
    ].join("\n");
  }
  if (normalizedSelection === "*") {
    const identified = warehousePositionIdentifiedVariants(item);
    if (!variants.length || identified.length !== variants.length) {
      return "\u26A0\uFE0F \u5132\u4F4D\u4FEE\u6539\u6F14\u7DF4\u5DF2\u505C\u6B62\n\n\u90E8\u5206\u5B50\u8CA8\u865F\u7A7A\u767D\u6216\u91CD\u8907\uFF0C\u4E0D\u80FD\u5B89\u5168\u5EFA\u7ACB\u300E\u5168\u90E8\u300F\u9810\u89BD\u3002\n\n\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002";
    }
    const lines = [
      "\u{1F9EA} \u5168\u90E8\u5B50\u8CA8\u865F\u5132\u4F4D\u4FEE\u6539\u6F14\u7DF4\uFF08\u4E0D\u6703\u5BEB\u5165 ERP\uFF09",
      "",
      `\u8CA8\u865F\uFF1A${item.sku}`,
      `\u5546\u54C1\uFF1A${item.name}`,
      `\u5B50\u8CA8\u865F\u6578\uFF1A${identified.length}`,
      `\u5009\u5EAB\uFF1A${metadata.warehouseName || "\u4E3B\u5009"}\uFF08InventoryId=1\uFF09`,
      `\u9810\u8A08\u65B0\u5132\u4F4D\uFF1A${newLocation}`,
      `\u5FEB\u7167\u6642\u9593\uFF1A${metadata.updatedAt}`,
      "",
      "\u9010\u7B46\u9810\u89BD\uFF1A"
    ];
    for (const { barcode, variant: variant2 } of identified) {
      const oldLocation2 = String(variant2.location || "").trim() || "\u5C1A\u672A\u8A2D\u5B9A";
      lines.push(`${barcode}\uFF5C${oldLocation2} \u2192 ${newLocation}\uFF5C\u5EAB\u5B58 ${Number(variant2.available) || 0}`);
    }
    lines.push(
      "",
      "\u5B89\u5168\u6AA2\u67E5\uFF1A\u5168\u90E8\u5B50\u8CA8\u865F\u90FD\u5DF2\u5217\u51FA\uFF1B\u4EFB\u4F55\u4E00\u7B46\u8CC7\u6599\u4E0D\u5B8C\u6574\u90FD\u6703\u6574\u6279\u505C\u6B62\u3002",
      "\u7D50\u679C\uFF1A\u6F14\u7DF4\u5B8C\u6210\uFF0C\u6C92\u6709\u5EFA\u7ACB\u78BA\u8A8D\u78BC\uFF0C\u4E5F\u6C92\u6709\u547C\u53EB ERP \u5BEB\u5165\u3002"
    );
    return lines.join("\n");
  }
  const variant = selected[0];
  const oldLocation = String(variant.location || "").trim() || "\u5C1A\u672A\u8A2D\u5B9A";
  if (oldLocation === newLocation) {
    return [
      "\u2139\uFE0F \u5132\u4F4D\u4FEE\u6539\u6F14\u7DF4",
      "",
      `\u8CA8\u865F\uFF1A${item.sku}`,
      `\u5546\u54C1\uFF1A${item.name}`,
      ...normalizedSelection ? [`\u5B50\u8CA8\u865F\uFF1A${normalizedSelection}`] : [],
      `\u76EE\u524D\u5132\u4F4D\uFF1A${oldLocation}`,
      `\u8F38\u5165\u5132\u4F4D\uFF1A${newLocation}`,
      "",
      "\u65B0\u820A\u5132\u4F4D\u76F8\u540C\uFF0C\u4E0D\u9700\u8981\u4FEE\u6539\u3002",
      "\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002"
    ].join("\n");
  }
  return [
    "\u{1F9EA} \u5132\u4F4D\u4FEE\u6539\u6F14\u7DF4\uFF08\u4E0D\u6703\u5BEB\u5165 ERP\uFF09",
    "",
    `\u8CA8\u865F\uFF1A${item.sku}`,
    `\u5546\u54C1\uFF1A${item.name}`,
    ...normalizedSelection ? [`\u5B50\u8CA8\u865F\uFF1A${normalizedSelection}`] : [],
    `\u898F\u683C\uFF1A${warehousePositionVariantLabel(variant)}`,
    `\u5009\u5EAB\uFF1A${metadata.warehouseName || "\u4E3B\u5009"}\uFF08InventoryId=1\uFF09`,
    `\u4E3B\u5009\u53EF\u7528\u5EAB\u5B58\uFF1A${Number(variant.available) || 0}`,
    `\u539F\u5132\u4F4D\uFF1A${oldLocation}`,
    `\u9810\u8A08\u65B0\u5132\u4F4D\uFF1A${newLocation}`,
    `\u5FEB\u7167\u6642\u9593\uFF1A${metadata.updatedAt}`,
    "",
    "\u5B89\u5168\u6AA2\u67E5\uFF1A\u9810\u8A08\u53EA\u5141\u8A31 DepotPosition \u9019\u4E00\u500B\u6B04\u4F4D\u6539\u8B8A\u3002",
    "\u7D50\u679C\uFF1A\u6F14\u7DF4\u5B8C\u6210\uFF0C\u6C92\u6709\u5EFA\u7ACB\u78BA\u8A8D\u78BC\uFF0C\u4E5F\u6C92\u6709\u547C\u53EB ERP \u5BEB\u5165\u3002"
  ].join("\n");
}
__name(createWarehousePositionDryRunPreview, "createWarehousePositionDryRunPreview");
async function replyWarehousePositionDryRun(event, command, env) {
  try {
    const access = await warehousePositionDryRunAccess(event, env);
    if (!access.ok) {
      await replyLine(event.replyToken, access.message, env);
      return;
    }
    const result = await warehouseLocationRequest(env, command.sku, false);
    await replyLine(
      event.replyToken,
      createWarehousePositionDryRunPreview(
        result?.item,
        result?.metadata,
        command.newLocation,
        Date.now(),
        command.variant || ""
      ),
      env
    );
  } catch (error) {
    console.error("LINE warehouse position dry run error", error?.message || error);
    await replyLine(
      event.replyToken,
      `\u26A0\uFE0F \u5132\u4F4D\u4FEE\u6539\u6F14\u7DF4\u5DF2\u505C\u6B62\uFF1A${error?.message || "\u8ACB\u7A0D\u5F8C\u518D\u8A66"}

\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002`,
      env
    );
  }
}
__name(replyWarehousePositionDryRun, "replyWarehousePositionDryRun");
async function replyWarehousePositionPrompt(event, env) {
  try {
    const access = await warehousePositionDryRunAccess(event, env);
    if (!access.ok) {
      await replyLine(event.replyToken, access.message, env);
      return;
    }
    await armWarehousePositionPrompt(event, env);
    await replyLine(
      event.replyToken,
      "\u{1F4E6} \u6539\u5132\u4F4D\n\n\u8ACB\u5728 8 \u79D2\u5167\u56DE\u8986\u8CA8\u865F\uFF0C\u4F8B\u5982\uFF1AA823\n\u63A5\u8457\u53EF\u9078\u55AE\u4E00\u5B50\u8CA8\u865F\uFF0C\u6216\u9078\u5168\u90E8\uFF08\u6700\u591A 30 \u7B46\uFF09\u2192\u81EA\u8A02\u3002\n\n\u5099\u4EFD\u4E26\u518D\u6B21\u78BA\u8A8D\u5F8C\u624D\u6703\u5BEB\u5165 ERP\u3002",
      env
    );
  } catch (error) {
    console.error("LINE warehouse position prompt error", error?.message || error);
    await replyLine(
      event.replyToken,
      `\u26A0\uFE0F \u5132\u4F4D\u4FEE\u6539\u6F14\u7DF4\u5DF2\u505C\u6B62\uFF1A${error?.message || "\u8ACB\u7A0D\u5F8C\u518D\u8A66"}

\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002`,
      env
    );
  }
}
__name(replyWarehousePositionPrompt, "replyWarehousePositionPrompt");
async function replyWarehousePositionWizardStart(event, sku, env) {
  try {
    const access = await warehousePositionDryRunAccess(event, env);
    if (!access.ok) {
      await replyLine(event.replyToken, access.message, env);
      return;
    }
    const result = await warehouseLocationRequest(env, sku, false);
    const snapshotError = warehousePositionDryRunSnapshotError(result?.item, result?.metadata);
    if (snapshotError) {
      await replyLine(event.replyToken, snapshotError, env);
      return;
    }
    const variants = Array.isArray(result.item?.variants) ? result.item.variants : [];
    if (!variants.length) {
      await replyLine(event.replyToken, "\u26A0\uFE0F \u5132\u4F4D\u4FEE\u6539\u6F14\u7DF4\u5DF2\u505C\u6B62\n\n\u5546\u54C1\u6C92\u6709\u53EF\u8FA8\u8B58\u7684\u898F\u683C\u8CC7\u6599\u3002\n\n\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002", env);
      return;
    }
    if (variants.length > 1 && warehousePositionIdentifiedVariants(result.item).length !== variants.length) {
      await replyLine(event.replyToken, "\u26A0\uFE0F \u5132\u4F4D\u4FEE\u6539\u6F14\u7DF4\u5DF2\u505C\u6B62\n\n\u90E8\u5206\u5B50\u8CA8\u865F\u7A7A\u767D\u6216\u91CD\u8907\uFF0C\u4E0D\u80FD\u5B89\u5168\u986F\u793A\u9078\u9805\u3002\n\n\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002", env);
      return;
    }
    const state = variants.length > 1 ? { step: "variant", sku, page: 1 } : { step: "warehouse", sku };
    await replyLine(event.replyToken, [createWarehousePositionWizardMessage(state, "", result.item)], env);
  } catch (error) {
    console.error("LINE warehouse position wizard start error", error?.message || error);
    await replyLine(
      event.replyToken,
      `\u26A0\uFE0F \u5132\u4F4D\u4FEE\u6539\u6F14\u7DF4\u5DF2\u505C\u6B62\uFF1A${error?.message || "\u8ACB\u7A0D\u5F8C\u518D\u8A66"}

\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002`,
      env
    );
  }
}
__name(replyWarehousePositionWizardStart, "replyWarehousePositionWizardStart");
async function replyWarehousePositionWizard(event, params, env) {
  try {
    const access = await warehousePositionDryRunAccess(event, env);
    if (!access.ok) {
      await replyLine(event.replyToken, access.message, env);
      return;
    }
    const state = warehousePositionWizardState(params);
    if (!state) {
      await replyLine(event.replyToken, "\u26A0\uFE0F \u5132\u4F4D\u9078\u9805\u7121\u6548\uFF0C\u8ACB\u91CD\u65B0\u8F38\u5165\u300C\u6539\u5132\u4F4D \u8CA8\u865F\u300D\u3002\n\n\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002", env);
      return;
    }
    if (state.step === "cancel") {
      await replyLine(event.replyToken, "\u5DF2\u53D6\u6D88\u5132\u4F4D\u4FEE\u6539\u6F14\u7DF4\u3002\n\n\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002", env);
      return;
    }
    if (state.step === "custom") {
      if (!await warehousePositionWriteAllowed(event, env)) {
        await replyLine(event.replyToken, "\u{1F512} \u6B64 LINE \u79C1\u8A0A\u5E33\u865F\u5C1A\u672A\u7372\u51C6\u5BEB\u5165 ERP\uFF1B\u81EA\u8A02\u5132\u4F4D\u76EE\u524D\u7121\u6CD5\u4F7F\u7528\u3002\n\n\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002", env);
        return;
      }
      const result = await warehouseLocationRequest(env, state.sku, false);
      const snapshotError = warehousePositionDryRunSnapshotError(result?.item, result?.metadata);
      if (snapshotError) {
        await replyLine(event.replyToken, snapshotError, env);
        return;
      }
      const variants = warehousePositionIdentifiedVariants(result.item);
      const batch = state.variant === "*";
      if (batch && (result.item.variants || []).length > warehousePositionAllVariantLimit) {
        await replyLine(event.replyToken, "\u26A0\uFE0F \u5168\u90E8\u5BEB\u5165\u4E00\u6B21\u6700\u591A 30 \u500B\u5B50\u8CA8\u865F\uFF1B\u6B64\u5546\u54C1\u8D85\u904E\u4E0A\u9650\uFF0C\u8ACB\u6539\u9078\u55AE\u4E00\u5B50\u8CA8\u865F\u3002\n\n\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002", env);
        return;
      }
      const selected = variants.filter(({ barcode }) => batch || !state.variant || barcode === state.variant);
      const itemUID = selected.length === 1 ? selected[0].barcode : "";
      const target = batch ? warehousePositionBatchTarget(state.sku, selected.map(({ barcode }) => barcode)) : { itemUID };
      if (variants.length !== (result.item.variants || []).length || (batch ? !target : parseWarehousePositionWriteCommand(`\u6539\u5132\u4F4D ${itemUID} TEST`)?.goodId !== state.sku)) {
        await replyLine(event.replyToken, "\u26A0\uFE0F \u5B50\u8CA8\u865F\u8CC7\u6599\u5DF2\u66F4\u65B0\u6216\u4E0D\u5B8C\u6574\uFF0C\u8ACB\u91CD\u65B0\u8F38\u5165\u300C\u6539\u5132\u4F4D \u8CA8\u865F\u300D\u9078\u64C7\u5B50\u8CA8\u865F\u3002\n\n\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002", env);
        return;
      }
      if (!await saveWarehousePositionCustomInput(event, env, target)) {
        throw httpError("\u81EA\u8A02\u5132\u4F4D\u66AB\u6642\u7121\u6CD5\u5B89\u5168\u4FDD\u5B58\uFF0C\u8ACB\u7A0D\u5F8C\u518D\u8A66", 503);
      }
      await replyLine(
        event.replyToken,
        `\u270F\uFE0F \u81EA\u8A02\u5132\u4F4D\uFF5C${batch ? `${state.sku} \u5168\u90E8 ${target.itemUIDs.length} \u500B\u5B50\u8CA8\u865F\uFF08\u4E0A\u9650 30 \u7B46\uFF09` : itemUID}
\u8ACB\u5728 2 \u5206\u9418\u5167\u76F4\u63A5\u56DE\u8986\u65B0\u5132\u4F4D\uFF0C\u4F8B\u5982\uFF1AWC02-L02-02\u3002

${batch ? "\u5168\u90E8\u5B50\u8CA8\u865F\u5C07\u4F7F\u7528\u540C\u4E00\u500B\u65B0\u5132\u4F4D\u3002" : ""}\u56DE\u8986\u5F8C\u6703\u5148\u986F\u793A ERP \u539F\u5132\u4F4D\u3001\u65B0\u5132\u4F4D\u53CA\u5099\u4EFD\u78BA\u8A8D\uFF1B\u6309\u78BA\u8A8D\u624D\u6703\u5BEB\u5165\u3002\u8F38\u5165\u300C\u53D6\u6D88\u300D\u53EF\u9000\u51FA\u3002`,
        env
      );
      return;
    }
    if (state.step === "zone" && state.warehouse === "A") {
      await replyLine(event.replyToken, [createWarehousePositionWizardMessage(
        { step: "warehouse", sku: state.sku, variant: state.variant },
        "A\u5009\u76EE\u524D\u5C1A\u672A\u958B\u653E\uFF0C\u9019\u4E00\u7248\u8ACB\u9078\u64C7 B\u5009\u3002"
      )], env);
      return;
    }
    if (state.step === "variant") {
      const result = await warehouseLocationRequest(env, state.sku, false);
      const snapshotError = warehousePositionDryRunSnapshotError(result?.item, result?.metadata);
      if (snapshotError) {
        await replyLine(event.replyToken, snapshotError, env);
        return;
      }
      const message2 = createWarehousePositionWizardMessage(state, "", result.item);
      if (!message2) {
        await replyLine(event.replyToken, "\u26A0\uFE0F \u5B50\u8CA8\u865F\u8CC7\u6599\u5DF2\u66F4\u65B0\u6216\u4E0D\u5B8C\u6574\uFF0C\u8ACB\u91CD\u65B0\u8F38\u5165\u300C\u6539\u5132\u4F4D \u8CA8\u865F\u300D\u3002\n\n\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002", env);
        return;
      }
      await replyLine(event.replyToken, [message2], env);
      return;
    }
    if (state.step === "preview") {
      const newLocation = warehousePositionWizardLocation(state);
      if (!newLocation) {
        await replyLine(event.replyToken, "\u26A0\uFE0F \u5132\u4F4D\u9078\u9805\u4E0D\u5B8C\u6574\u6216\u7121\u6548\uFF0C\u8ACB\u91CD\u65B0\u8F38\u5165\u300C\u6539\u5132\u4F4D \u8CA8\u865F\u300D\u3002\n\n\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002", env);
        return;
      }
      await replyWarehousePositionDryRun(event, {
        sku: state.sku,
        newLocation,
        variant: state.variant
      }, env);
      return;
    }
    const message = createWarehousePositionWizardMessage(state);
    if (!message) {
      await replyLine(event.replyToken, "\u26A0\uFE0F \u5132\u4F4D\u9078\u9805\u4E0D\u5B8C\u6574\u6216\u7121\u6548\uFF0C\u8ACB\u91CD\u65B0\u8F38\u5165\u300C\u6539\u5132\u4F4D \u8CA8\u865F\u300D\u3002\n\n\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002", env);
      return;
    }
    await replyLine(event.replyToken, [message], env);
  } catch (error) {
    console.error("LINE warehouse position wizard error", error?.message || error);
    await replyLine(
      event.replyToken,
      `\u26A0\uFE0F \u5132\u4F4D\u4FEE\u6539\u6F14\u7DF4\u5DF2\u505C\u6B62\uFF1A${error?.message || "\u8ACB\u7A0D\u5F8C\u518D\u8A66"}

\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002`,
      env
    );
  }
}
__name(replyWarehousePositionWizard, "replyWarehousePositionWizard");
async function warehouseSearchRequest(env, keyword) {
  if (!env.LINE_ACTIVATION) throw httpError("ERP \u5132\u4F4D\u67E5\u8A62\u670D\u52D9\u5C1A\u672A\u8A2D\u5B9A", 503);
  const stub = lineScheduleStub(env, globalLineScheduleName);
  const response = await stub.fetch("https://line-schedule/warehouse-locations/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keyword, limit: 10 })
  });
  if (!response.ok) throw httpError("ERP \u5546\u54C1\u641C\u5C0B\u66AB\u6642\u7121\u6CD5\u4F7F\u7528", 503);
  return response.json();
}
__name(warehouseSearchRequest, "warehouseSearchRequest");
function warehouseImageCandidate(sku, product) {
  return normalizeWarehouseImageCandidate({
    sku,
    productId: product?.productId,
    productUrl: product?.productUrl,
    sourceImageUrl: product?.imageUrl
  });
}
__name(warehouseImageCandidate, "warehouseImageCandidate");
async function enqueueWarehouseImageCandidates(env, candidates) {
  if (!env.LINE_ACTIVATION || !Array.isArray(candidates) || !candidates.length) return null;
  const response = await lineScheduleStub(env, globalLineScheduleName).fetch(
    "https://line-schedule/warehouse-images/enqueue",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidates })
    }
  );
  if (!response.ok) throw new Error(`WAREHOUSE_IMAGE_ENQUEUE_HTTP_${response.status}`);
  return response.json();
}
__name(enqueueWarehouseImageCandidates, "enqueueWarehouseImageCandidates");
async function cacheNasWarehouseImage(env, sku) {
  if (!env.LINE_ACTIVATION || !isNasLocalImageSku(sku)) return null;
  const response = await readerBrokerStub(env).fetch(
    "https://shopee-reader/warehouse-images/cache-nas",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku: normalizeWarehouseSku(sku) })
    }
  );
  let result = null;
  try {
    result = await response.json();
  } catch {
  }
  if (!response.ok || !result?.ok) {
    throw new Error(String(result?.error || `NAS_IMAGE_CACHE_HTTP_${response.status}`).slice(0, 160));
  }
  const item = result.item || null;
  if (item?.imageUrl) {
    const indexResponse = await lineScheduleStub(env, globalLineScheduleName).fetch(
      "https://line-schedule/warehouse-images/record-nas",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item)
      }
    );
    if (!indexResponse.ok) throw new Error(`NAS_IMAGE_INDEX_HTTP_${indexResponse.status}`);
  }
  return item;
}
__name(cacheNasWarehouseImage, "cacheNasWarehouseImage");
async function enrichWarehouseSearchItems(items, env) {
  const normalized = (Array.isArray(items) ? items : []).map((item) => ({ ...item }));
  if (!normalized.length) return normalized;
  let catalog = /* @__PURE__ */ new Map();
  try {
    catalog = await profitWarehouseProductMap(env);
  } catch (error) {
    console.error("WAREHOUSE_PROFIT_CATALOG", error?.message || error);
  }
  const enriched = normalized.map((item) => {
    const cachedImageUrl = normalizeShopeeImageUrl(item.imageUrl);
    const product = catalog.get(normalizeWarehouseSku(item.sku)) || {};
    const sourceImageUrl = normalizeShopeeImageUrl(product.imageUrl);
    return {
      ...item,
      productId: product.productId || item.productId,
      productUrl: product.productUrl || item.productUrl,
      imageUrl: cachedImageUrl || sourceImageUrl
    };
  });
  const localImageSkus = enriched.filter((item) => !normalizeShopeeImageUrl(item.imageUrl) && isNasLocalImageSku(item.sku)).map((item) => normalizeWarehouseSku(item.sku));
  if (localImageSkus.length) {
    const localResults = await Promise.allSettled(localImageSkus.map((sku) => cacheNasWarehouseImage(env, sku)));
    const localImages = /* @__PURE__ */ new Map();
    for (let index = 0; index < localResults.length; index += 1) {
      const result = localResults[index];
      if (result.status === "fulfilled" && normalizeShopeeImageUrl(result.value?.imageUrl)) {
        localImages.set(localImageSkus[index], result.value);
      } else if (result.status === "rejected") {
        console.error("WAREHOUSE_NAS_IMAGE", localImageSkus[index], result.reason?.message || result.reason);
      }
    }
    for (const item of enriched) {
      const cached = localImages.get(normalizeWarehouseSku(item.sku));
      if (!cached) continue;
      item.productId = cached.productId || item.productId;
      item.productUrl = cached.productUrl || item.productUrl;
      item.imageUrl = cached.imageUrl;
    }
  }
  const missingImages = normalized.filter((item) => !normalizeShopeeImageUrl(item.imageUrl) && !isNasLocalImageSku(item.sku)).map((item) => warehouseImageCandidate(
    item.sku,
    catalog.get(normalizeWarehouseSku(item.sku)) || item
  )).filter(Boolean);
  if (!missingImages.length) return enriched;
  try {
    await enqueueWarehouseImageCandidates(env, missingImages);
  } catch (error) {
    console.error("WAREHOUSE_IMAGE_ENQUEUE", error?.message || error);
  }
  return enriched;
}
__name(enrichWarehouseSearchItems, "enrichWarehouseSearchItems");
async function replyWarehouseLocation(event, sku, env, showDetails = false) {
  try {
    const result = await warehouseLocationRequest(env, sku);
    if (!result?.metadata) {
      await replyLine(event.replyToken, "ERP \u4E3B\u5009\u5132\u4F4D\u8CC7\u6599\u5C1A\u672A\u5B8C\u6210\u7B2C\u4E00\u6B21\u540C\u6B65\uFF0C\u8ACB\u7A0D\u5F8C\u518D\u8A66\u3002", env);
      return;
    }
    const showCost = event.source?.type === "user";
    if (showDetails || !result.item) {
      await replyLine(
        event.replyToken,
        formatWarehouseLocation(result.item, result.metadata, { showCost, showPrice: showCost }),
        env
      );
      return;
    }
    const [item] = await enrichWarehouseSearchItems([result.item], env);
    await replyLine(
      event.replyToken,
      [createWarehouseSearchMessage([item], sku, 1, { showCost, showPrice: showCost })],
      env
    );
  } catch (error) {
    console.error("LINE warehouse location error", error?.message || error);
    await replyLine(event.replyToken, `\u76EE\u524D\u7121\u6CD5\u67E5\u8A62 ERP \u5132\u4F4D\uFF1A${error?.message || "\u8ACB\u7A0D\u5F8C\u518D\u8A66"}`, env);
  }
}
__name(replyWarehouseLocation, "replyWarehouseLocation");
async function replyWarehouseStorageLocation(event, location, page, env, options = {}) {
  try {
    const includeUnavailable = options.includeUnavailable !== false;
    const result = options.preparedResult || await warehouseStorageLocationRequest(env, location, page, includeUnavailable);
    if (!result?.metadata) {
      await replyLine(event.replyToken, "ERP \u4E3B\u5009\u5132\u4F4D\u8CC7\u6599\u5C1A\u672A\u5B8C\u6210\u7B2C\u4E00\u6B21\u540C\u6B65\uFF0C\u8ACB\u7A0D\u5F8C\u518D\u8A66\u3002", env);
      return;
    }
    await replyLine(event.replyToken, [createWarehouseStorageLocationMessage(result)], env);
  } catch (error) {
    console.error("LINE warehouse storage location error", error?.message || error);
    await replyLine(event.replyToken, `\u76EE\u524D\u7121\u6CD5\u53CD\u67E5 ERP \u5132\u4F4D\uFF1A${error?.message || "\u8ACB\u7A0D\u5F8C\u518D\u8A66"}`, env);
  }
}
__name(replyWarehouseStorageLocation, "replyWarehouseStorageLocation");
async function replyWarehouseSearch(event, keyword, env) {
  try {
    const result = await warehouseSearchRequest(env, keyword);
    if (!result?.metadata) {
      await replyLine(event.replyToken, "ERP \u4E3B\u5009\u5132\u4F4D\u8CC7\u6599\u5C1A\u672A\u5B8C\u6210\u7B2C\u4E00\u6B21\u540C\u6B65\uFF0C\u8ACB\u7A0D\u5F8C\u518D\u8A66\u3002", env);
      return;
    }
    if (!Array.isArray(result.items) || !result.items.length) {
      await replyLine(
        event.replyToken,
        `\u{1F50E} \u627E\u4E0D\u5230\u8207\u300C${keyword}\u300D\u76F8\u95DC\u7684 ERP \u5546\u54C1\u3002
\u8ACB\u6539\u7528\u8F03\u77ED\u6216\u4E0D\u540C\u7684\u5546\u54C1\u540D\u7A31\u518D\u8A66\u4E00\u6B21\u3002`,
        env
      );
      return;
    }
    const items = await enrichWarehouseSearchItems(result.items, env);
    const showCost = event.source?.type === "user";
    await replyLine(event.replyToken, [
      createWarehouseSearchMessage(
        items,
        keyword,
        Number(result.totalCount) || items.length,
        { showCost, showPrice: showCost }
      )
    ], env);
  } catch (error) {
    console.error("LINE warehouse search error", error?.message || error);
    await replyLine(event.replyToken, `\u76EE\u524D\u7121\u6CD5\u641C\u5C0B ERP \u5546\u54C1\uFF1A${error?.message || "\u8ACB\u7A0D\u5F8C\u518D\u8A66"}`, env);
  }
}
__name(replyWarehouseSearch, "replyWarehouseSearch");
async function lineDisplayName(event, env) {
  const source = event?.source || {};
  const userId = String(source.userId || "");
  if (!userId || !env.LINE_CHANNEL_ACCESS_TOKEN) return "\u7FA4\u7D44\u6210\u54E1";
  let path = `/v2/bot/profile/${encodeURIComponent(userId)}`;
  if (source.groupId) {
    path = `/v2/bot/group/${encodeURIComponent(source.groupId)}/member/${encodeURIComponent(userId)}`;
  } else if (source.roomId) {
    path = `/v2/bot/room/${encodeURIComponent(source.roomId)}/member/${encodeURIComponent(userId)}`;
  }
  try {
    const response = await fetch(`https://api.line.me${path}`, {
      headers: { "Authorization": `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}` }
    });
    if (!response.ok) return "\u7FA4\u7D44\u6210\u54E1";
    const profile = await response.json();
    return String(profile?.displayName || "\u7FA4\u7D44\u6210\u54E1").replace(/\s+/g, " ").trim().slice(0, 120) || "\u7FA4\u7D44\u6210\u54E1";
  } catch {
    return "\u7FA4\u7D44\u6210\u54E1";
  }
}
__name(lineDisplayName, "lineDisplayName");
async function addLineSchedule(event, text, env) {
  const items = scheduleItemsFromText(text);
  if (!items.length) {
    await replyLine(event.replyToken, "\u8ACB\u5728\u300C\u5EE3\u544A\u5F71\u7247\u6392\u7A0B\u300D\u4E0B\u65B9\u8CBC\u4E0A\u81F3\u5C11\u4E00\u500B\u8766\u76AE\u5546\u54C1\u9023\u7D50\u3002", env);
    return;
  }
  const result = await lineScheduleRequest(event, env, "add", {
    items,
    addedAt: Number(event.timestamp) || Date.now(),
    addedBy: event.source?.userId || ""
  });
  const notes = [`\u{1F4E5} \u5DF2\u65B0\u589E ${result.added?.length || 0} \u9805\u5EE3\u544A\u5F71\u7247\u6392\u7A0B\u3002`];
  if (result.duplicateCount) notes.push(`\u7565\u904E ${result.duplicateCount} \u500B\u91CD\u8907\u5546\u54C1\u3002`);
  if (result.fullCount) notes.push(`\u53E6\u6709 ${result.fullCount} \u9805\u56E0\u5F85\u62CD\u6E05\u55AE\u5DF2\u6EFF\u800C\u672A\u52A0\u5165\u3002`);
  notes.push(`\u76EE\u524D\u5171\u6709 ${result.pendingCount || 0} \u9805\u5F85\u62CD\u3002`, "\u8F38\u5165\u300C\u8981\u62CD\u4EC0\u9EBC\u300D\u5373\u53EF\u67E5\u770B\u6E05\u55AE\u3002");
  await replyLine(event.replyToken, notes.join("\n"), env);
}
__name(addLineSchedule, "addLineSchedule");
async function replyLineScheduleList(event, env, completed = false) {
  const result = await lineScheduleRequest(event, env, "list");
  const storedItems = completed ? result.completed || [] : result.pending || [];
  const items = await enrichScheduleItemsWithProfitSkus(storedItems, env);
  const text = completed ? formatCompletedSchedule(items) : formatPendingSchedule(items);
  await replyLine(event.replyToken, splitLineText(text), env);
}
__name(replyLineScheduleList, "replyLineScheduleList");
async function generateScheduledLineScript(event, index, env) {
  const selection = await lineScheduleRequest(event, env, "get", { index });
  if (!selection.item) {
    const message = selection.pendingCount ? `\u8ACB\u8F38\u5165 1\uFF5E${selection.pendingCount} \u4E4B\u9593\u7684\u5F85\u62CD\u7DE8\u865F\u3002` : "\u9019\u500B\u804A\u5929\u5BA4\u76EE\u524D\u6C92\u6709\u5F85\u62CD\u9805\u76EE\uFF0C\u8ACB\u5148\u8F38\u5165\u300C\u8981\u62CD\u4EC0\u9EBC\u300D\u78BA\u8A8D\u6E05\u55AE\u3002";
    await replyLine(event.replyToken, message, env);
    return;
  }
  const userKey = event.source?.userId || lineScheduleScope(event);
  if (!allowRequest(`line:${userKey}`)) {
    await replyLine(event.replyToken, "\u9019\u500B\u5C0F\u6642\u7522\u751F\u7684\u8173\u672C\u8F03\u591A\uFF0C\u8ACB\u7A0D\u5F8C\u518D\u8A66\u3002", env);
    return;
  }
  const lock = await acquireLineScheduleGeneration(env);
  if (!lock.acquired) {
    await replyLine(
      event.replyToken,
      `\u4E0A\u4E00\u652F\u6587\u6848\u6B63\u5728\u7522\u751F\u4E2D\uFF0C\u8ACB\u7B49\u5B83\u56DE\u8986\u5F8C\u518D\u8F38\u5165\u7DE8\u865F\uFF08\u7D04 ${lock.retryAfterSeconds || 1} \u79D2\uFF09\u3002`,
      env
    );
    return;
  }
  try {
    const script = await withAbortTimeout(
      (signal) => generateScript({
        productUrl: selection.item.productUrl,
        productName: selection.item.productName,
        seconds: 40,
        focus: ""
      }, env, { signal }),
      24e3,
      "\u5546\u54C1\u5167\u5BB9\u8B80\u53D6\u6216 AI \u7522\u751F\u6642\u9593\u8F03\u9577"
    );
    await replyLine(event.replyToken, [
      { type: "text", text: formatLineScript(script) },
      { type: "text", text: `\u62CD\u651D\u5B8C\u6210\u5F8C\uFF0C\u8ACB\u8F38\u5165\u300C\u5B8C\u6210${index}\u300D\u3002`.slice(0, 5e3) }
    ], env);
  } catch (error) {
    console.error("LINE scheduled generation error", error?.message || error);
    const retryHint = error?.status === 504 ? "\u8ACB\u7B49 10 \u79D2\u5F8C\u91CD\u65B0\u8F38\u5165\u540C\u4E00\u500B\u7DE8\u865F\u3002" : "\u4E0D\u9700\u8981\u518D\u8CBC\u7DB2\u5740\uFF0C\u8ACB\u7A0D\u5F8C\u91CD\u65B0\u8F38\u5165\u7DE8\u865F\u3002";
    await replyLine(event.replyToken, `\u76EE\u524D\u7121\u6CD5\u7522\u751F\u6392\u7A0B\u8173\u672C\uFF1A${error?.message || "\u8ACB\u7A0D\u5F8C\u518D\u8A66"}
${retryHint}`, env);
  } finally {
    await releaseLineScheduleGeneration(env, lock.token);
  }
}
__name(generateScheduledLineScript, "generateScheduledLineScript");
async function completeLineScheduleItem(event, index, env) {
  const selection = await lineScheduleRequest(event, env, "get", { index });
  if (!selection.item) {
    const message2 = selection.pendingCount ? `\u8ACB\u8F38\u5165 1\uFF5E${selection.pendingCount} \u4E4B\u9593\u7684\u5F85\u62CD\u7DE8\u865F\u3002` : "\u76EE\u524D\u6C92\u6709\u5F85\u62CD\u9805\u76EE\u3002";
    await replyLine(event.replyToken, message2, env);
    return;
  }
  const completedBy = await lineDisplayName(event, env);
  const result = await lineScheduleRequest(event, env, "complete", {
    productUrl: selection.item.productUrl,
    productName: selection.item.productName,
    completedAt: Date.now(),
    completedBy,
    completedById: event.source?.userId || ""
  });
  const message = result.alreadyCompleted ? "\u2139\uFE0F \u9019\u9805\u6392\u7A0B\u5DF2\u7531\u5176\u4ED6\u54E1\u5DE5\u5B8C\u6210\uFF0C\u8ACB\u8F38\u5165\u300C\u8981\u62CD\u4EC0\u9EBC\u300D\u66F4\u65B0\u6E05\u55AE\u3002" : `\u2705 \u5DF2\u5B8C\u6210\uFF1A${result.completed?.productName || selection.item.productName}
\u82E5\u6A19\u932F\uFF0C\u8F38\u5165\u300C\u5DF2\u62CD\u5B8C\u300D\u67E5\u770B\u7DE8\u865F\uFF0C\u518D\u8F38\u5165\u300C\u53D6\u6D88\u5B8C\u62101\u300D\u3002`;
  await replyLine(event.replyToken, message, env);
}
__name(completeLineScheduleItem, "completeLineScheduleItem");
async function reopenLineScheduleItem(event, index, env) {
  const result = await lineScheduleRequest(event, env, "reopen", { index });
  if (result.full) {
    await replyLine(event.replyToken, "\u5F85\u62CD\u6E05\u55AE\u5DF2\u6EFF\uFF0C\u66AB\u6642\u7121\u6CD5\u53D6\u6D88\u5B8C\u6210\u3002", env);
    return;
  }
  if (!result.restored) {
    const message = result.completedCount ? `\u8ACB\u8F38\u5165 1\uFF5E${result.completedCount} \u4E4B\u9593\u7684\u5DF2\u62CD\u5B8C\u7DE8\u865F\u3002` : "\u76EE\u524D\u6C92\u6709\u53EF\u4EE5\u53D6\u6D88\u7684\u5DF2\u62CD\u5B8C\u9805\u76EE\u3002";
    await replyLine(event.replyToken, message, env);
    return;
  }
  const note = result.alreadyPending ? "\uFF08\u5F85\u62CD\u6E05\u55AE\u4E2D\u5DF2\u7D93\u6709\u540C\u4E00\u5546\u54C1\uFF0C\u56E0\u6B64\u6C92\u6709\u91CD\u8907\u65B0\u589E\uFF09" : "";
  await replyLine(
    event.replyToken,
    `\u21A9\uFE0F \u5DF2\u53D6\u6D88\u5B8C\u6210\uFF1A${result.restored.productName}
\u5546\u54C1\u5DF2\u56DE\u5230\u5F85\u62CD\u6E05\u55AE\u3002${note}`,
    env
  );
}
__name(reopenLineScheduleItem, "reopenLineScheduleItem");
async function processLineEvent(event, env) {
  if (!event.replyToken) return;
  if (event.type === "postback") {
    const params = new URLSearchParams(event.postback?.data || "");
    const action = params.get("action");
    if (action === warehousePositionWizardAction) {
      await replyWarehousePositionWizard(event, params, env);
      return;
    }
    if (action === warehousePositionWriteAction) {
      await replyWarehousePositionWriteConfirmation(event, params, env);
      return;
    }
    if (action === warehouseStorageLocationAction) {
      if (event.source?.type !== "user") return;
      const location = normalizeWarehouseStorageLocation(params.get("location") || "");
      if (!location) return;
      const includeUnavailable = params.has("includeUnavailable") ? params.get("includeUnavailable") !== "0" : true;
      await replyWarehouseStorageLocation(
        event,
        location,
        Number.parseInt(params.get("page"), 10) || 1,
        env,
        { includeUnavailable }
      );
      return;
    }
    if (action === erpOrderSkuAction) {
      await replyErpOrderSkuPostback(event, params, env);
      return;
    }
    if (action !== "generate" && action !== "choose_focus") return;
    const productUrl2 = findShopeeUrl(params.get("url") || "");
    if (!productUrl2) {
      await replyLine(event.replyToken, "\u5546\u54C1\u9023\u7D50\u5DF2\u5931\u6548\uFF0C\u8ACB\u91CD\u65B0\u8CBC\u4E0A\u8766\u76AE\u5546\u54C1\u9023\u7D50\u3002", env);
      return;
    }
    if (action === "choose_focus") {
      const seconds = Number.parseInt(params.get("seconds"), 10) || 40;
      const title = String(params.get("title") || "\u8766\u76AE\u5546\u54C1").slice(0, 500);
      await replyLine(event.replyToken, [createLineFocusPanel(productUrl2, title, seconds)], env);
      return;
    }
    return generateLineScript(event, {
      productUrl: productUrl2,
      productName: String(params.get("title") || "").slice(0, 500),
      seconds: Number.parseInt(params.get("seconds"), 10) || 40,
      focus: String(params.get("focus") || "").slice(0, 300)
    }, env);
  }
  if (event.type !== "message" || event.message?.type !== "text") return;
  const text = removeLineMentions(event.message.text || "", event.message.mention);
  const productUrl = findShopeeUrl(text);
  const groupMessage = isGroupSource(event.source);
  const mentioned = isSelfMentioned(event.message);
  console.log("LINE_EVENT", JSON.stringify({
    sourceType: event.source?.type || "unknown",
    hasUserId: Boolean(event.source?.userId),
    mentioned,
    containsShopee: /shopee/iu.test(text),
    productUrlDetected: Boolean(productUrl),
    textLength: text.length
  }));
  const orderBindingToken = parseLineOrderBindingCommand(text);
  if (orderBindingToken !== null) {
    if (event.source?.type !== "user") return;
    const expectedToken = String(env.LINE_ORDER_BIND_TOKEN || "").trim();
    if (!orderBindingToken || !expectedToken || orderBindingToken !== expectedToken) {
      await replyLine(event.replyToken, "\u{1F512} \u8A02\u55AE\u67E5\u8A62\u6388\u6B0A\u78BC\u7121\u6548\u6216\u5DF2\u904E\u671F\u3002", env);
      return;
    }
    try {
      const result = await bindLineOrderLookupUser(event, orderBindingToken, env);
      if (result?.authorized) {
        await replyLine(event.replyToken, "\u2705 \u6B64 LINE \u5E33\u865F\u5DF2\u5B8C\u6210\u8A02\u55AE\u67E5\u8A62\u7D81\u5B9A\u3002\n\n\u73FE\u5728\u53EF\u76F4\u63A5\u8F38\u5165\u51FA\u8CA8\u55AE\u53F3\u4E0A\u89D2\u7684\u8A02\u55AE\u7DE8\u865F\u3002", env);
      } else {
        await replyLine(event.replyToken, "\u{1F512} \u9019\u7D44\u8A02\u55AE\u67E5\u8A62\u6388\u6B0A\u78BC\u5DF2\u4F7F\u7528\uFF0C\u8ACB\u901A\u77E5\u7BA1\u7406\u8005\u91CD\u65B0\u7522\u751F\u3002", env);
      }
    } catch (error) {
      console.error("LINE order binding error", error?.message || error);
      await replyLine(event.replyToken, `\u76EE\u524D\u7121\u6CD5\u5B8C\u6210\u8A02\u55AE\u67E5\u8A62\u7D81\u5B9A\uFF1A${error?.message || "\u8ACB\u7A0D\u5F8C\u518D\u8A66"}`, env);
    }
    return;
  }
  const recentOrderSelectionIndex = event.source?.type === "user" ? parseScheduleSelection(text) : null;
  if (recentOrderSelectionIndex) {
    try {
      const selection = await resolveLineOrderRecentSelection(
        event,
        recentOrderSelectionIndex,
        env
      );
      if (selection?.expired || selection?.snapshotChanged) {
        const skuStatusSelection = selection.kind === "sku-status";
        const reason = selection.snapshotChanged ? "ERP \u8A02\u55AE\u8CC7\u6599\u5DF2\u66F4\u65B0" : skuStatusSelection ? "\u9078\u55AE\u5DF2\u8D85\u904E 10 \u79D2" : "\u9078\u55AE\u5DF2\u8D85\u904E 5 \u5206\u9418";
        const subject = skuStatusSelection ? `${selection.sku || "\u8CA8\u865F"}\uFF5C${selection.status || "\u8A02\u55AE\u72C0\u614B"}` : `\u4EA4\u6613 ${selection.transactionNo}`;
        const retry = skuStatusSelection ? "\u8ACB\u91CD\u65B0\u9078\u64C7\u8A02\u55AE\u72C0\u614B\uFF0C\u518D\u8F38\u5165\u7DE8\u865F\u3002" : `\u8ACB\u91CD\u65B0\u8F38\u5165 ${selection.transactionNo}\uFF0C\u518D\u9078\u4E00\u6B21\u7DE8\u865F\u3002`;
        await replyLine(
          event.replyToken,
          `\u231B \u525B\u624D ${subject} \u7684\u51FA\u8CA8\u55AE\u9078\u9805\u5DF2\u5931\u6548\uFF08${reason}\uFF09\u3002

${retry}`,
          env
        );
        return;
      }
      if (selection?.found) {
        if (!selection.valid) {
          const selectionRange = selection.firstIndex === selection.lastIndex ? String(selection.firstIndex) : `${selection.firstIndex}\uFF5E${selection.lastIndex}`;
          const selectionSubject = selection.kind === "sku-status" ? `${selection.sku || "\u8CA8\u865F"}\uFF5C${selection.status || "\u8A02\u55AE\u72C0\u614B"}` : `\u4EA4\u6613 ${selection.transactionNo} \u5171\u6709 ${selection.count} \u5F35\u5B8C\u6574\u51FA\u8CA8\u55AE`;
          await replyLine(
            event.replyToken,
            `\u{1F4E6} ${selectionSubject}\uFF0C\u8ACB\u8F38\u5165 ${selectionRange}\u3002`,
            env
          );
          return;
        }
        const lookup = { query: selection.query, mode: "auto", page: 1 };
        const result = await erpOrderRequest(env, lookup);
        console.log("LINE_ORDER_SELECTION", JSON.stringify({
          selected: true,
          index: recentOrderSelectionIndex,
          hit: Boolean(result?.order)
        }));
        await replyLine(event.replyToken, createErpOrderMessage(result, lookup), env);
        return;
      }
    } catch (error) {
      console.error("LINE order recent selection error", error?.message || error);
      await replyLine(event.replyToken, `\u76EE\u524D\u7121\u6CD5\u8B80\u53D6\u525B\u624D\u7684\u51FA\u8CA8\u55AE\u9078\u9805\uFF1A${error?.message || "\u8ACB\u7A0D\u5F8C\u518D\u8A66"}`, env);
      return;
    }
  }
  if (String(text || "").normalize("NFKC").trim() === "\u5132\u4F4D\u5BEB\u5165\u6388\u6B0A\u78BC") {
    await replyWarehouseWriteAuthorizationCode(event, env);
    return;
  }
  if (isWarehousePositionDryRunCommand(text)) {
    const writeCommand = parseWarehousePositionWriteCommand(text);
    if (writeCommand) {
      await replyWarehousePositionWritePreview(event, writeCommand, env);
      return;
    }
    if (isWarehousePositionPromptCommand(text)) {
      await replyWarehousePositionPrompt(event, env);
      return;
    }
    const command = parseWarehousePositionDryRunCommand(text);
    const wizardSku = parseWarehousePositionDryRunStartCommand(text);
    if (wizardSku) {
      await replyWarehousePositionWizardStart(event, wizardSku, env);
      return;
    }
    if (!command) {
      await replyLine(
        event.replyToken,
        "\u{1F4E6} \u5132\u4F4D\u4FEE\u6539\u683C\u5F0F\uFF1A\n\u6539\u5132\u4F4D \u8CA8\u865F\n\n\u4F8B\u5982\uFF1A\u6539\u5132\u4F4D A861\n\u63A5\u8457\u53EF\u9078 B\u5009\u9810\u89BD\uFF0C\u6216\u9EDE\u300C\u81EA\u8A02\u300D\u624B\u6253\u5132\u4F4D\u3002\u81EA\u8A02\u4ECD\u9808\u55AE\u7B46\u5099\u4EFD\u8207\u518D\u6B21\u78BA\u8A8D\uFF0C\u624D\u6703\u5BEB\u5165 ERP\u3002",
        env
      );
      return;
    }
    await replyWarehousePositionDryRun(event, command, env);
    return;
  }
  let customInput = null;
  try {
    customInput = await takeWarehousePositionCustomInput(event, env);
  } catch (error) {
    console.error("LINE warehouse custom input unavailable", error?.message || error);
  }
  if (customInput?.existed) {
    if (!customInput.valid) {
      await replyLine(event.replyToken, "\u231B \u81EA\u8A02\u5132\u4F4D\u8F38\u5165\u5DF2\u8D85\u904E 2 \u5206\u9418\u3002\u8ACB\u91CD\u65B0\u9EDE\u300C\u6539\u5132\u4F4D\u300D\u2192\u300C\u81EA\u8A02\u300D\u3002\n\n\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002", env);
      return;
    }
    if (String(text || "").normalize("NFKC").trim() === "\u53D6\u6D88") {
      await replyLine(event.replyToken, "\u5DF2\u53D6\u6D88\u81EA\u8A02\u5132\u4F4D\u3002\n\n\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002", env);
      return;
    }
    const batchTarget = customInput.itemUIDs ? warehousePositionBatchTarget(customInput.goodId, customInput.itemUIDs) : null;
    const command = parseWarehousePositionWriteCommand(`\u6539\u5132\u4F4D ${batchTarget ? batchTarget.itemUIDs[0] : customInput.itemUID} ${text}`);
    if (!command) {
      await replyLine(event.replyToken, "\u26A0\uFE0F \u81EA\u8A02\u5132\u4F4D\u683C\u5F0F\u4E0D\u6B63\u78BA\u3002\u8ACB\u91CD\u65B0\u9EDE\u300C\u6539\u5132\u4F4D\u300D\u2192\u300C\u81EA\u8A02\u300D\uFF0C\u518D\u8F38\u5165\u5132\u4F4D\u78BC\uFF08\u4F8B\u5982 WC02-L02-02\uFF09\u3002\n\n\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002", env);
      return;
    }
    if (batchTarget) await replyWarehousePositionBatchWritePreview(event, { ...batchTarget, newLocation: command.newLocation }, env);
    else await replyWarehousePositionWritePreview(event, command, env);
    return;
  }
  const orderLookup = parseLineOrderLookupRequest(text);
  if (orderLookup || isLineOrderPromptCommand(text)) {
    if (event.source?.type !== "user") return;
    if (!await lineOrderLookupAllowed(event, env)) {
      console.log("LINE_ORDER_LOOKUP", JSON.stringify({ authorized: false, sourceType: event.source?.type || "unknown" }));
      await replyLine(event.replyToken, "\u{1F512} \u8A02\u55AE\u67E5\u8A62\u53EA\u9650\u5DF2\u6388\u6B0A\u7684 LINE \u79C1\u8A0A\u5E33\u865F\u4F7F\u7528\u3002", env);
      return;
    }
    if (!orderLookup) {
      await replyLine(event.replyToken, "\u8ACB\u8F38\u5165\u51FA\u8CA8\u55AE\u53F3\u4E0A\u89D2\u7684\u8A02\u55AE\u7DE8\u865F\uFF0C\u4F8B\u5982\uFF1A0350000-10747554", env);
      return;
    }
    try {
      const result = await erpOrderRequest(env, orderLookup);
      const numericSelectionAvailable = await updateLineOrderRecentSelection(
        event,
        result,
        orderLookup,
        env
      );
      console.log("LINE_ORDER_LOOKUP", JSON.stringify({ authorized: true, hit: Boolean(result?.order) }));
      await replyLine(
        event.replyToken,
        createErpOrderMessage(result, orderLookup, Date.now(), { numericSelectionAvailable }),
        env
      );
    } catch (error) {
      console.error("LINE order lookup error", error?.message || error);
      await replyLine(event.replyToken, `\u76EE\u524D\u7121\u6CD5\u67E5\u8A62 ERP \u8A02\u55AE\uFF1A${error?.message || "\u8ACB\u7A0D\u5F8C\u518D\u8A66"}`, env);
    }
    return;
  }
  const availabilityCommand = parseWarehouseStorageLocationAvailabilityCommand(text);
  const parsedWarehouseStorageLocation = availabilityCommand ? parseWarehouseStorageLocationCommand(availabilityCommand.location) : parseWarehouseStorageLocationCommand(text);
  const warehouseStorageLocationCandidate = availabilityCommand?.location || parsedWarehouseStorageLocation || parseWarehouseStorageLocationCandidate(text);
  if (warehouseStorageLocationCandidate) {
    try {
      const result = await warehouseStorageLocationRequest(env, warehouseStorageLocationCandidate, 1);
      const exactErpLocation = Boolean(result?.metadata && Number(result?.totalCount) > 0);
      if (exactErpLocation || parsedWarehouseStorageLocation || availabilityCommand) {
        if (event.source?.type === "user") {
          if (!exactErpLocation || availabilityCommand) {
            await replyWarehouseStorageLocation(
              event,
              warehouseStorageLocationCandidate,
              1,
              env,
              {
                includeUnavailable: availabilityCommand?.includeUnavailable !== false,
                preparedResult: availabilityCommand?.includeUnavailable === false ? null : result
              }
            );
          } else {
            await replyLine(event.replyToken, [createWarehouseStorageLocationFilterPrompt(result)], env);
          }
        }
        return;
      }
    } catch (error) {
      console.error("LINE warehouse storage location probe error", error?.message || error);
      if (parsedWarehouseStorageLocation || availabilityCommand) {
        if (event.source?.type === "user") {
          await replyLine(event.replyToken, `\u76EE\u524D\u7121\u6CD5\u53CD\u67E5 ERP \u5132\u4F4D\uFF1A${error?.message || "\u8ACB\u7A0D\u5F8C\u518D\u8A66"}`, env);
        }
        return;
      }
    }
  }
  if (isScheduleAddCommand(text)) {
    try {
      await clearLineOrderRecentSelection(event, env);
      await addLineSchedule(event, text, env);
    } catch (error) {
      console.error("LINE schedule add error", error?.message || error);
      await replyLine(event.replyToken, `\u76EE\u524D\u7121\u6CD5\u5132\u5B58\u5EE3\u544A\u5F71\u7247\u6392\u7A0B\uFF1A${error?.message || "\u8ACB\u7A0D\u5F8C\u518D\u8A66"}`, env);
    }
    return;
  }
  if (isPendingScheduleCommand(text) || isCompletedScheduleCommand(text)) {
    try {
      await clearLineOrderRecentSelection(event, env);
      await replyLineScheduleList(event, env, isCompletedScheduleCommand(text));
    } catch (error) {
      console.error("LINE schedule list error", error?.message || error);
      await replyLine(event.replyToken, `\u76EE\u524D\u7121\u6CD5\u8B80\u53D6\u5EE3\u544A\u5F71\u7247\u6392\u7A0B\uFF1A${error?.message || "\u8ACB\u7A0D\u5F8C\u518D\u8A66"}`, env);
    }
    return;
  }
  const possiblePromptSku = parseWarehouseLocationCommand(text);
  const normalizedPromptText = normalizeScheduleDigits(text).normalize("NFKC").trim().toUpperCase();
  if (event.source?.type === "user" && possiblePromptSku && normalizedPromptText === possiblePromptSku) {
    const prompt = await takeWarehousePositionPrompt(event, env);
    if (prompt.valid) {
      await replyWarehousePositionWizardStart(event, possiblePromptSku, env);
      return;
    }
    if (prompt.existed) {
      await replyLine(
        event.replyToken,
        "\u231B \u5DF2\u8D85\u904E 8 \u79D2\uFF0C\u9019\u6B21\u6539\u5132\u4F4D\u6F14\u7DF4\u5DF2\u5931\u6548\u3002\n\n\u8ACB\u518D\u9EDE\u4E00\u6B21\u529F\u80FD\u9078\u55AE\u7684\u300C\u6539\u5132\u4F4D\u300D\u3002\n\u672C\u6B21\u6C92\u6709\u5BEB\u5165 ERP\u3002",
        env
      );
      return;
    }
  }
  const warehouseDetailSku = parseWarehouseLocationDetailCommand(text);
  if (warehouseDetailSku) {
    await replyWarehouseLocation(event, warehouseDetailSku, env, true);
    return;
  }
  const warehouseSku = parseWarehouseLocationCommand(text);
  if (warehouseSku) {
    const normalizedWarehouseInput = normalizeScheduleDigits(text).normalize("NFKC").trim().toUpperCase();
    if (event.source?.type === "user" && normalizedWarehouseInput === warehouseSku) {
      try {
        await clearLineOrderRecentSelection(event, env);
      } catch (error) {
        console.error("LINE order SKU menu reset error", error?.message || error);
        await replyLine(event.replyToken, `\u76EE\u524D\u7121\u6CD5\u5B89\u5168\u958B\u555F\u8CA8\u865F\u67E5\u8A62\u9078\u55AE\uFF1A${error?.message || "\u8ACB\u7A0D\u5F8C\u518D\u8A66"}`, env);
        return;
      }
      await replyLine(event.replyToken, [createErpOrderSkuChoiceMessage(warehouseSku)], env);
      return;
    }
    await replyWarehouseLocation(event, warehouseSku, env);
    return;
  }
  if (/^儲位\s*(?:[+＋:：]\s*)?$/u.test(text)) {
    await replyLine(event.replyToken, "\u8ACB\u5728\u300E\u5132\u4F4D\u300F\u5F8C\u9762\u52A0\u4E0A\u8CA8\u865F\u3001\u5B8C\u6574\u5132\u4F4D\u6216\u5546\u54C1\u95DC\u9375\u5B57\uFF0C\u4F8B\u5982\uFF1A\u5132\u4F4D A12345\u3001\u5132\u4F4D 04-R05-02/T5\u3001\u5132\u4F4D \u6D17\u8863\u888B", env);
    return;
  }
  if (/^(?:查詢?|搜(?:尋)?)\s*$/u.test(text)) {
    await replyLine(event.replyToken, "\u8ACB\u5728\u300E\u67E5\u300F\u5F8C\u9762\u52A0\u4E0A\u5546\u54C1\u95DC\u9375\u5B57\uFF0C\u4F8B\u5982\uFF1A\u67E5 \u6D17\u8863\u888B", env);
    return;
  }
  const undoCompletedIndex = parseScheduleUndoCompletion(text);
  if (undoCompletedIndex) {
    try {
      await clearLineOrderRecentSelection(event, env);
      await reopenLineScheduleItem(event, undoCompletedIndex, env);
    } catch (error) {
      console.error("LINE schedule reopen error", error?.message || error);
      await replyLine(event.replyToken, `\u76EE\u524D\u7121\u6CD5\u53D6\u6D88\u5B8C\u6210\uFF1A${error?.message || "\u8ACB\u7A0D\u5F8C\u518D\u8A66"}`, env);
    }
    return;
  }
  const completedIndex = parseScheduleCompletion(text);
  if (completedIndex) {
    try {
      await clearLineOrderRecentSelection(event, env);
      await completeLineScheduleItem(event, completedIndex, env);
    } catch (error) {
      console.error("LINE schedule complete error", error?.message || error);
      await replyLine(event.replyToken, `\u76EE\u524D\u7121\u6CD5\u5B8C\u6210\u9019\u7B46\u6392\u7A0B\uFF1A${error?.message || "\u8ACB\u7A0D\u5F8C\u518D\u8A66"}`, env);
    }
    return;
  }
  const scheduleIndex = parseScheduleSelection(text);
  if (scheduleIndex) {
    try {
      await generateScheduledLineScript(event, scheduleIndex, env);
    } catch (error) {
      console.error("LINE schedule selection error", error?.message || error);
      await replyLine(event.replyToken, `\u76EE\u524D\u7121\u6CD5\u8B80\u53D6\u9019\u7B46\u5F85\u62CD\u6392\u7A0B\uFF1A${error?.message || "\u8ACB\u7A0D\u5F8C\u518D\u8A66"}`, env);
    }
    return;
  }
  const mentionOnly = groupMessage && mentioned && !text;
  if (isLineHelpCommand(text) && (!groupMessage || mentioned) || mentionOnly) {
    if (mentionOnly) await armLineGroup(event, env);
    await replyLine(
      event.replyToken,
      [createLineHelpMessage()],
      env
    );
    return;
  }
  if (isLineScriptPromptCommand(text)) {
    await replyLine(
      event.replyToken,
      "\u8ACB\u8CBC\u4E0A\u8766\u76AE\u5546\u54C1\u9023\u7D50\u3002\u6536\u5230\u5F8C\u6703\u76F4\u63A5\u7522\u751F 40 \u79D2\u6A19\u6E96\u7248\u8173\u672C\uFF0C\u62CD\u651D\u91CD\u9EDE\u7531 AI \u81EA\u52D5\u5224\u65B7\u3002",
      env
    );
    return;
  }
  if (!productUrl) {
    const followup = parseLineFollowup(text);
    if (followup) {
      const pending = await takePendingLineProduct(event, env);
      if (pending) {
        return generateLineScript(event, {
          productUrl: pending.productUrl,
          productName: pending.productName,
          seconds: followup.seconds,
          focus: followup.focus
        }, env);
      }
    }
    const warehouseKeyword = parseWarehouseSearchCommand(text);
    if (warehouseKeyword) {
      await replyWarehouseSearch(event, warehouseKeyword, env);
      return;
    }
    if (groupMessage) {
      if (!mentioned) {
        if (/https?:\/\/|shopee/iu.test(text) && await takeLineGroupActivation(event, env)) {
          await replyLine(event.replyToken, "\u6211\u6536\u5230\u8A0A\u606F\u4E86\uFF0C\u4F46\u7121\u6CD5\u8FA8\u8B58\u5176\u4E2D\u7684\u8766\u76AE\u5546\u54C1\u9023\u7D50\u3002\u8ACB\u91CD\u65B0\u8907\u88FD\u5B8C\u6574\u5546\u54C1\u7DB2\u5740\u518D\u8A66\u4E00\u6B21\u3002", env);
        }
        return;
      }
      const armed = await armLineGroup(event, env);
      await replyLine(
        event.replyToken,
        armed ? "\u5DF2\u6E96\u5099\u597D\uFF0C\u8ACB\u5728 10 \u79D2\u5167\u8CBC\u4E0A\u8766\u76AE\u5546\u54C1\u9023\u7D50\u3002" : "\u8ACB\u76F4\u63A5\u5728\u540C\u4E00\u5247\u8A0A\u606F\u4E2D @\u6211 \u4E26\u8CBC\u4E0A\u8766\u76AE\u5546\u54C1\u9023\u7D50\u3002",
        env
      );
      return;
    }
  }
  if (!productUrl) {
    await replyLine(
      event.replyToken,
      "\u8ACB\u8CBC\u4E0A\u8766\u76AE\u5546\u54C1\u9023\u7D50\u3002\u6536\u5230\u5F8C\u6703\u76F4\u63A5\u7522\u751F 40 \u79D2\u6A19\u6E96\u7248\u8173\u672C\uFF0C\u62CD\u651D\u91CD\u9EDE\u7531 AI \u81EA\u52D5\u5224\u65B7\u3002",
      env
    );
    return;
  }
  if (groupMessage && !mentioned) {
    const activated = await takeLineGroupActivation(event, env);
    if (!activated) return;
  }
  const input = lineInput(text, productUrl);
  return generateLineScript(event, input, env);
}
__name(processLineEvent, "processLineEvent");
async function generateLineScript(event, input, env) {
  const userKey = event.source?.userId || event.source?.groupId || event.source?.roomId || "unknown";
  if (!allowRequest(`line:${userKey}`)) {
    await replyLine(event.replyToken, "\u9019\u500B\u5C0F\u6642\u7522\u751F\u7684\u8173\u672C\u8F03\u591A\uFF0C\u8ACB\u7A0D\u5F8C\u518D\u8A66\u3002", env);
    return;
  }
  try {
    const script = await generateScript(input, env);
    await replyLine(event.replyToken, formatLineScript(script), env);
  } catch (error) {
    console.error("LINE generation error", error?.message || error);
    await replyLine(event.replyToken, `\u76EE\u524D\u7121\u6CD5\u7522\u751F\u8173\u672C\uFF1A${error?.message || "\u8ACB\u7A0D\u5F8C\u518D\u8A66"}`, env);
  }
}
__name(generateLineScript, "generateLineScript");
async function handleLineWebhook(request, env, context) {
  if (!env.LINE_CHANNEL_SECRET || !env.LINE_CHANNEL_ACCESS_TOKEN) {
    return new Response("LINE integration is not configured", { status: 503 });
  }
  const rawBody = await request.text();
  const valid = await verifyLineSignature(rawBody, request.headers.get("x-line-signature"), env.LINE_CHANNEL_SECRET);
  if (!valid) return new Response("Invalid signature", { status: 401 });
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const work = Promise.all((body.events || []).map((event) => processLineEvent(event, env)));
  if (context?.waitUntil) context.waitUntil(work);
  else await work;
  return new Response("OK", { status: 200 });
}
__name(handleLineWebhook, "handleLineWebhook");
async function reconcileWarehouseImagesAfterSync(items, env) {
  let catalog;
  try {
    catalog = await profitWarehouseProductMap(env);
  } catch (error) {
    console.error("WAREHOUSE_IMAGE_CATALOG_SYNC", error?.message || error);
    return null;
  }
  const candidatesBySku = /* @__PURE__ */ new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const sku = normalizeWarehouseSku(item?.sku);
    const candidate = warehouseImageCandidate(sku, catalog.get(sku));
    if (candidate) candidatesBySku.set(sku, candidate);
  }
  const candidates = [...candidatesBySku.values()];
  const response = await lineScheduleStub(env, globalLineScheduleName).fetch(
    "https://line-schedule/warehouse-images/reconcile",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidates })
    }
  );
  if (!response.ok) throw new Error(`WAREHOUSE_IMAGE_RECONCILE_HTTP_${response.status}`);
  const result = await response.json();
  console.log("WAREHOUSE_IMAGE_RECONCILE", JSON.stringify(result));
  return result;
}
__name(reconcileWarehouseImagesAfterSync, "reconcileWarehouseImagesAfterSync");
async function handleWarehouseLocationPush(request, env, context) {
  const expected = String(env.ERP_SYNC_TOKEN || "");
  const supplied = String(request.headers.get("X-Erp-Sync-Token") || "");
  if (!expected || supplied !== expected) return new Response("Unauthorized", { status: 401 });
  if (!env.LINE_ACTIVATION) return Response.json({ ok: false, error: "STORAGE_NOT_CONFIGURED" }, { status: 503 });
  const rawBody = await request.text();
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }
  const stub = lineScheduleStub(env, globalLineScheduleName);
  const response = await stub.fetch("https://line-schedule/warehouse-locations/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawBody
  });
  if (response.ok) {
    const work = reconcileWarehouseImagesAfterSync(body?.items, env).catch((error) => {
      console.error("WAREHOUSE_IMAGE_RECONCILE", error?.message || error);
    });
    if (context?.waitUntil) context.waitUntil(work);
    else await work;
  }
  return response;
}
__name(handleWarehouseLocationPush, "handleWarehouseLocationPush");
async function handleErpOrderPush(request, env) {
  const expected = String(env.ERP_SYNC_TOKEN || "");
  const supplied = String(request.headers.get("X-Erp-Sync-Token") || "");
  if (!expected || supplied !== expected) return new Response("Unauthorized", { status: 401 });
  if (!env.LINE_ACTIVATION) return Response.json({ ok: false, error: "STORAGE_NOT_CONFIGURED" }, { status: 503 });
  const rawBody = await request.text();
  try {
    const body = JSON.parse(rawBody);
    if (!Array.isArray(body?.orders)) throw new Error("INVALID_ORDER_DATA");
  } catch {
    return Response.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }
  return lineScheduleStub(env, globalLineScheduleName).fetch("https://line-schedule/erp-orders/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawBody
  });
}
__name(handleErpOrderPush, "handleErpOrderPush");
async function handleErpOrderStatus(request, env) {
  const expected = String(env.ERP_SYNC_TOKEN || "");
  if (!expected || request.headers.get("X-Erp-Sync-Token") !== expected) return new Response("Unauthorized", { status: 401 });
  if (!env.LINE_ACTIVATION) return Response.json({ ok: false, error: "STORAGE_NOT_CONFIGURED" }, { status: 503 });
  return lineScheduleStub(env, globalLineScheduleName).fetch("https://line-schedule/erp-orders/status", { method: "GET" });
}
__name(handleErpOrderStatus, "handleErpOrderStatus");
async function handleWarehouseImageStatus(request, env) {
  const expected = String(env.ERP_SYNC_TOKEN || "");
  const supplied = String(request.headers.get("X-Erp-Sync-Token") || "");
  if (!expected || supplied !== expected) return new Response("Unauthorized", { status: 401 });
  if (!env.LINE_ACTIVATION) return Response.json({ ok: false, error: "STORAGE_NOT_CONFIGURED" }, { status: 503 });
  return lineScheduleStub(env, globalLineScheduleName).fetch("https://line-schedule/warehouse-images/status", {
    method: "GET"
  });
}
__name(handleWarehouseImageStatus, "handleWarehouseImageStatus");
async function handleNasImagePrecache(request, env) {
  const expected = String(env.SHOPEE_READER_TOKEN || "");
  if (!expected || request.headers.get("Authorization") !== `Bearer ${expected}`) {
    return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!env.LINE_ACTIVATION) {
    return Response.json({ ok: false, error: "STORAGE_NOT_CONFIGURED" }, { status: 503 });
  }
  if (request.method === "GET") {
    return readerBrokerStub(env).fetch("https://shopee-reader/warehouse-images/nas-status", { method: "GET" });
  }
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  let body = {};
  try {
    body = await request.json();
  } catch {
  }
  const sourceResponse = await lineScheduleStub(env, globalLineScheduleName).fetch(
    "https://line-schedule/warehouse-locations/local-image-skus",
    { method: "GET" }
  );
  if (!sourceResponse.ok) {
    return Response.json({ ok: false, error: `LOCATION_SKU_HTTP_${sourceResponse.status}` }, { status: 503 });
  }
  const source = await sourceResponse.json();
  return readerBrokerStub(env).fetch("https://shopee-reader/warehouse-images/reconcile-nas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      skus: source.skus,
      sourceVersion: source.sourceVersion,
      force: Boolean(body?.force)
    })
  });
}
__name(handleNasImagePrecache, "handleNasImagePrecache");
function decodeReaderImageHeader(value) {
  try {
    return decodeURIComponent(String(value || "")).replace(/[\r\n]/g, " ").trim();
  } catch {
    return "";
  }
}
__name(decodeReaderImageHeader, "decodeReaderImageHeader");
async function handleReaderImageUpload(request, env, rawSku) {
  const expected = String(env.SHOPEE_READER_TOKEN || "");
  if (!expected || request.headers.get("Authorization") !== `Bearer ${expected}`) {
    return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  const sku = normalizeWarehouseSku(rawSku);
  if (!isNasLocalImageSku(sku)) {
    return Response.json({ ok: false, error: "NAS_IMAGE_SKU_INVALID" }, { status: 400 });
  }
  if (!env.PRODUCT_IMAGES) {
    return Response.json({ ok: false, error: "PRODUCT_IMAGE_STORAGE_NOT_CONFIGURED" }, { status: 503 });
  }
  const contentType = String(request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
    return Response.json({ ok: false, error: "IMAGE_CONTENT_TYPE_INVALID" }, { status: 415 });
  }
  const declaredSize = Number(request.headers.get("Content-Length")) || 0;
  if (declaredSize > warehouseImageMaxBytes) {
    return Response.json({ ok: false, error: "IMAGE_TOO_LARGE" }, { status: 413 });
  }
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > warehouseImageMaxBytes) {
    return Response.json({ ok: false, error: "IMAGE_SIZE_INVALID" }, { status: 413 });
  }
  const cachedAt = Date.now();
  const fileName = decodeReaderImageHeader(request.headers.get("X-Nas-Image-File")).slice(0, 300);
  const folderName = decodeReaderImageHeader(request.headers.get("X-Nas-Image-Folder")).slice(0, 300);
  const sourceWidth = Math.max(0, Number(request.headers.get("X-Nas-Image-Width")) || 0);
  const sourceHeight = Math.max(0, Number(request.headers.get("X-Nas-Image-Height")) || 0);
  const candidateCount = Math.max(0, Number(request.headers.get("X-Nas-Image-Candidates")) || 0);
  const score = Number(request.headers.get("X-Nas-Image-Score")) || 0;
  const imageUrl = warehouseImagePublicUrl(sku, cachedAt);
  await env.PRODUCT_IMAGES.put(warehouseImageObjectKey(sku), bytes, {
    metadata: {
      contentType,
      sku,
      productId: `nas:${sku}`,
      source: "nas",
      cachedAt: String(cachedAt),
      fileName,
      folderName,
      width: String(sourceWidth),
      height: String(sourceHeight),
      candidateCount: String(candidateCount),
      score: String(score)
    }
  });
  if (env.LINE_ACTIVATION) {
    const indexResponse = await lineScheduleStub(env, globalLineScheduleName).fetch(
      "https://line-schedule/warehouse-images/record-nas",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku,
          imageUrl,
          cachedAt,
          contentType,
          fileName,
          folderName,
          sourceWidth,
          sourceHeight,
          candidateCount,
          score
        })
      }
    );
    if (!indexResponse.ok) {
      return Response.json({ ok: false, error: "IMAGE_INDEX_UPDATE_FAILED" }, { status: 503 });
    }
  }
  return Response.json({
    ok: true,
    sku,
    contentType,
    cachedAt,
    imageUrl
  });
}
__name(handleReaderImageUpload, "handleReaderImageUpload");
async function serveWarehouseProductImage(request, env, rawSku) {
  const sku = normalizeWarehouseSku(rawSku);
  if (!sku || !env.PRODUCT_IMAGES) return new Response("Not found", { status: 404 });
  const object = await env.PRODUCT_IMAGES.getWithMetadata(warehouseImageObjectKey(sku), {
    type: "arrayBuffer",
    cacheTtl: 3600
  });
  if (!object?.value) return new Response("Not found", { status: 404 });
  const headers = new Headers({
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff"
  });
  if (object.metadata?.contentType) headers.set("Content-Type", object.metadata.contentType);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "image/jpeg");
  return new Response(request.method === "HEAD" ? null : object.value, { status: 200, headers });
}
__name(serveWarehouseProductImage, "serveWarehouseProductImage");
var index_default = {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (url.pathname.startsWith("/product-images/")) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method not allowed", { status: 405 });
      }
      let sku = "";
      try {
        sku = decodeURIComponent(url.pathname.slice("/product-images/".length));
      } catch {
      }
      return serveWarehouseProductImage(request, env, sku);
    }
    if (url.pathname.startsWith("/reader/images/")) {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      let sku = "";
      try {
        sku = decodeURIComponent(url.pathname.slice("/reader/images/".length));
      } catch {
      }
      return handleReaderImageUpload(request, env, sku);
    }
    if (url.pathname === "/reader/connect" || url.pathname === "/reader/status") {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
      const path = url.pathname === "/reader/connect" ? "/reader/connect" : "/reader/status";
      return readerBrokerStub(env).fetch(`https://shopee-reader${path}`, request);
    }
    if (url.pathname === "/erp/writeback/connect" || url.pathname === "/erp/writeback/status") {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
      const stub = erpWritebackBrokerStub(env);
      return stub.fetch(`https://erp-writeback${url.pathname}`, request);
    }
    if (url.pathname === "/reader/precache") {
      return handleNasImagePrecache(request, env);
    }
    if (url.pathname === "/line/webhook") {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      return handleLineWebhook(request, env, context);
    }
    if (url.pathname === "/erp/locations/push") {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      return handleWarehouseLocationPush(request, env, context);
    }
    if (url.pathname === "/erp/orders/push") {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      return handleErpOrderPush(request, env);
    }
    if (url.pathname === "/erp/orders/status") {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
      return handleErpOrderStatus(request, env);
    }
    if (url.pathname === "/erp/images/status") {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
      return handleWarehouseImageStatus(request, env);
    }
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
    if (origin && !allowedOrigins.has(origin)) return json({ error: "\u4E0D\u5141\u8A31\u7684\u7DB2\u7AD9\u4F86\u6E90" }, 403, origin);
    const clientKey = request.headers.get("CF-Connecting-IP") || "local";
    if (!allowRequest(`web:${clientKey}`)) return json({ error: "\u4ECA\u65E5\u4F7F\u7528\u6B21\u6578\u8F03\u591A\uFF0C\u8ACB\u7A0D\u5F8C\u518D\u8A66" }, 429, origin);
    try {
      const script = await generateScript(await request.json(), env);
      return json({ script }, 200, origin);
    } catch (error) {
      return json({ error: error?.message || "\u7121\u6CD5\u7522\u751F\u8173\u672C" }, error?.status || 400, origin);
    }
  }
};
export {
  LineActivation,
  armLineGroup,
  canonicalShopeeUrl,
  createErpOrderMessage,
  createErpOrderSkuChoiceMessage,
  createErpOrderSkuStatusMessage,
  createErpOrderSkuStatusPrompt,
  createLineFocusPanel,
  createLineHelpMessage,
  createLinePanel,
  createWarehousePositionDryRunPreview,
  createWarehousePositionWizardMessage,
  createWarehouseSearchMessage,
  createWarehouseStorageLocationFilterPrompt,
  createWarehouseStorageLocationMessage,
  index_default as default,
  enrichScheduleItemsWithProfitSkus,
  erpOrderSkuKeys,
  erpOrderSkuPostback,
  extractShopeePageContent,
  fetchShopeePageContent,
  findShopeeUrl,
  findShopeeUrls,
  formatCompletedSchedule,
  formatLineScript,
  formatPendingSchedule,
  formatWarehouseLocation,
  isGroupSource,
  isLineHelpCommand,
  isLineScriptPromptCommand,
  isNasLocalImageSku,
  isScheduleAddCommand,
  isSelfMentioned,
  lineActivationKey,
  lineHelpText,
  lineInput,
  linePendingKey,
  normalizeErpOrderAlias,
  normalizeErpOrderSkuStatusRequest,
  normalizeWarehouseStorageLocation,
  panelPostback,
  parseLineFollowup,
  parseLineOrderBindingCommand,
  parseLineOrderLookupCommand,
  parseLineOrderLookupRequest,
  parseScheduleCompletion,
  parseScheduleSelection,
  parseScheduleUndoCompletion,
  parseWarehouseLocationCommand,
  parseWarehouseLocationDetailCommand,
  parseWarehousePositionDryRunCommand,
  parseWarehousePositionDryRunStartCommand,
  parseWarehousePositionWriteCommand,
  parseWarehouseSearchCommand,
  parseWarehouseStorageLocationAvailabilityCommand,
  parseWarehouseStorageLocationCandidate,
  parseWarehouseStorageLocationCommand,
  processLineEvent,
  productTitle,
  profitSkuMapFromDashboard,
  profitWarehouseProductMapFromDashboard,
  removeLineMentions,
  scheduleItemsFromText,
  shopeeProductId,
  splitLineText,
  takeLineGroupActivation,
  verifyLineSignature,
  warehouseLocationBucket,
  warehousePositionWizardLocation,
  warehousePositionWizardPostback,
  warehousePositionWriteAllowed,
  warehouseSearchScore,
  withAbortTimeout
};
// Baseline recovered from production Worker 0159b0ad-6657-4cee-a635-5cdf33b0f745.
