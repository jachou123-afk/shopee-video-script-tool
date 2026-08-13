const allowedOrigins = new Set([
  "https://jachou123-afk.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const usage = new Map();
const lineActivations = new Map();
const encoder = new TextEncoder();
const globalLineScheduleName = "line-schedule:global-v1";
const profitDashboardDataUrl = "https://vicchou-profit-analysis.vicchou.chatgpt.site/api/dashboard-data";
const defaultShopeeShopId = "52793230";
const workerPublicBaseUrl = "https://shopee-video-script-ai.jachou123-afk.workers.dev";
const warehouseImageCacheBucketCount = 64;
const warehouseImageQueueChunkSize = 100;
const warehouseImageFetchBatchSize = 20;
const warehouseImageFetchDailyLimit = 100;
const warehouseImageFetchMinDelayMs = 45_000;
const warehouseImageFetchMaxDelayMs = 75_000;
const warehouseImageFetchBatchPauseMs = 15 * 60_000;
const warehouseImageFailureBaseDelayMs = 30 * 60_000;
const warehouseImageMaxBytes = 8 * 1024 * 1024;
let profitWarehouseCatalogCache = { expiresAt: 0, token: "", products: new Map() };

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://jachou123-afk.github.io",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...corsHeaders(origin) },
  });
}

function httpError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

async function withAbortTimeout(task, timeoutMs, message = "處理逾時") {
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
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function cleanShopeeUrl(raw) {
  const candidate = String(raw || "").trim().split(/\s+/)[0].replace(/[)\]}>，。！？、]+$/u, "");
  const url = new URL(candidate);
  if (!url.hostname.toLowerCase().endsWith("shopee.tw")) throw httpError("請貼上 shopee.tw 商品連結");
  return url;
}

async function resolveShopeeUrl(raw, signal) {
  const url = cleanShopeeUrl(raw);
  if (url.hostname.toLowerCase() !== "s.shopee.tw") return url.toString();

  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0" },
      signal,
    });
    const resolved = cleanShopeeUrl(response.url);
    response.body?.cancel();
    return resolved.toString();
  } catch (error) {
    if (signal?.aborted) throw error;
    return url.toString();
  }
}

function cleanProductTitleText(value) {
  const normalized = String(value || "")
    .replace(/\s*\|\s*蝦皮購物\s*$/u, "")
    .replace(/-i\.\d+\.\d+.*$/i, "")
    .replace(/[+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized
    .replace(/^(?:(?:(?:台灣)?現貨|實拍影片)[!！\s]*)+/u, "")
    .replace(/^【[^】]{1,60}】\s*/u, "")
    .trim()
    .slice(0, 500) || normalized.slice(0, 500) || "蝦皮商品";
}

function productTitle(raw) {
  const url = cleanShopeeUrl(raw);
  const seoName = url.searchParams.get("seoName");
  const decoded = seoName || decodeURIComponent(url.pathname).replace(/^\//, "");
  return cleanProductTitleText(decoded);
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

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
    description: String(metadata["og:description"] || metadata.description || "")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 6000),
  };
}

function normalizeReaderProduct(product) {
  const title = cleanProductTitleText(product?.title || "");
  const description = String(product?.description || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 12000);
  const normalized = {
    title,
    description,
    source: String(product?.source || "nas_browser").slice(0, 80),
  };
  const imageUrl = normalizeShopeeImageUrl(product?.imageUrl || product?.image_url || product?.image);
  if (imageUrl) normalized.imageUrl = imageUrl;
  return normalized;
}

function readerBrokerStub(env) {
  if (!env.LINE_ACTIVATION) throw httpError("NAS 商品讀取服務尚未設定", 503);
  const id = env.LINE_ACTIVATION.idFromName("shopee-reader-broker-v1");
  return env.LINE_ACTIVATION.get(id);
}

async function fetchFromNasReader(productUrl, env, signal) {
  const response = await readerBrokerStub(env).fetch("https://shopee-reader/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: productUrl }),
    signal,
  });
  let result = null;
  try {
    result = await response.json();
  } catch {}
  if (!response.ok || !result?.ok) {
    const reason = String(result?.error || `HTTP_${response.status}`).slice(0, 120);
    throw httpError(`NAS 商品讀取失敗：${reason}`, 503);
  }
  return normalizeReaderProduct(result.product);
}

async function fetchShopeePageContent(productUrl, env, signal) {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(signal?.reason);
  if (signal?.aborted) abortFromParent();
  else signal?.addEventListener("abort", abortFromParent, { once: true });
  const timeout = setTimeout(() => controller.abort(), 8000);
  let direct = { title: "", description: "", source: "" };
  try {
    const response = await fetch(productUrl, {
      headers: {
        "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "zh-TW,zh;q=0.9",
      },
      redirect: "follow",
      signal: controller.signal,
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

  throw httpError("目前無法讀取商品完整內容，請確認 NAS 讀取服務在線且蝦皮帳號仍為登入狀態", 503);
}

function canonicalShopeeUrl(raw) {
  const url = cleanShopeeUrl(raw);
  const productPath = url.pathname.match(/^\/product\/(\d+)\/(\d+)/i);
  const legacyPath = decodeURIComponent(url.pathname).match(/-i\.(\d+)\.(\d+)/i);
  const ids = productPath || legacyPath;
  return ids ? `https://shopee.tw/product/${ids[1]}/${ids[2]}` : url.toString();
}

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

function profitSkuMapFromDashboard(data) {
  const products = Array.isArray(data?.current?.products) ? data.current.products : [];
  const mapping = new Map();
  for (const product of products) {
    const productId = String(product?.pid || "").trim();
    const skuLabel = String(product?.skuLabel || "").replace(/\s+/g, " ").trim().slice(0, 100);
    if (productId && skuLabel) mapping.set(productId, skuLabel);
  }
  return mapping;
}

function normalizeWarehouseSku(value) {
  return String(value || "").normalize("NFKC").replace(/\s+/g, "").trim().toUpperCase().slice(0, 80);
}

function normalizeShopeeImageUrl(value) {
  const raw = typeof value === "object" && value
    ? value.url || value.imageUrl || value.image_url || value.id || value.image_id || ""
    : value;
  const text = String(raw || "").trim();
  if (/^https:\/\/[^\s]+$/iu.test(text)) return text.slice(0, 2000);
  if (/^[A-Za-z0-9_-]{10,300}$/u.test(text)) {
    return `https://down-tw.img.susercontent.com/file/${text}`;
  }
  return "";
}

function profitWarehouseProductMapFromDashboard(data) {
  const products = Array.isArray(data?.current?.products) ? data.current.products : [];
  const mapping = new Map();
  for (const product of products) {
    const sku = normalizeWarehouseSku(product?.skuLabel || product?.sku || product?.itemSku);
    const productId = String(product?.pid || product?.productId || product?.itemId || "").trim();
    if (!sku || !productId || mapping.has(sku)) continue;
    const shopId = String(product?.shopId || product?.shop_id || defaultShopeeShopId).trim() || defaultShopeeShopId;
    const imageCandidate = product?.imageUrl
      || product?.image_url
      || product?.thumbnailUrl
      || product?.thumbnail
      || product?.coverImage
      || product?.cover
      || product?.image
      || (Array.isArray(product?.images) ? product.images[0] : "");
    mapping.set(sku, {
      productId,
      productUrl: `https://shopee.tw/product/${shopId}/${productId}`,
      imageUrl: normalizeShopeeImageUrl(imageCandidate),
    });
  }
  return mapping;
}

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
    sourceImageUrl: normalizeShopeeImageUrl(raw?.sourceImageUrl || raw?.imageUrl),
  };
}

function warehouseImageObjectKey(sku) {
  return `warehouse/${encodeURIComponent(normalizeWarehouseSku(sku))}`;
}

function warehouseImagePublicUrl(sku, cachedAt) {
  return `${workerPublicBaseUrl}/product-images/${encodeURIComponent(normalizeWarehouseSku(sku))}?v=${Math.max(0, Number(cachedAt) || 0)}`;
}

function taipeiDayKey(timestamp = Date.now()) {
  return new Date(Number(timestamp) + 8 * 60 * 60_000).toISOString().slice(0, 10);
}

function nextTaipeiDayStart(timestamp = Date.now()) {
  const shifted = new Date(Number(timestamp) + 8 * 60 * 60_000);
  shifted.setUTCHours(24, 0, 0, 0);
  return shifted.getTime() - 8 * 60 * 60_000;
}

function warehouseImageDelay(minimum = warehouseImageFetchMinDelayMs, maximum = warehouseImageFetchMaxDelayMs) {
  const min = Math.max(1_000, Number(minimum) || warehouseImageFetchMinDelayMs);
  const max = Math.max(min, Number(maximum) || warehouseImageFetchMaxDelayMs);
  return Math.floor(min + Math.random() * (max - min + 1));
}

async function profitWarehouseProductMap(env) {
  const bypassToken = String(env?.PROFIT_DASHBOARD_BYPASS_TOKEN || "").trim();
  if (!bypassToken) return new Map();
  if (
    profitWarehouseCatalogCache.token === bypassToken
    && profitWarehouseCatalogCache.expiresAt > Date.now()
  ) {
    return profitWarehouseCatalogCache.products;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(profitDashboardDataUrl, {
      headers: { "OAI-Sites-Authorization": `Bearer ${bypassToken}` },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const products = profitWarehouseProductMapFromDashboard(await response.json());
    profitWarehouseCatalogCache = {
      token: bypassToken,
      expiresAt: Date.now() + 5 * 60 * 1000,
      products,
    };
    return products;
  } finally {
    clearTimeout(timeout);
  }
}

async function enrichScheduleItemsWithProfitSkus(items, env) {
  const normalized = (Array.isArray(items) ? items : []).map((item) => ({ ...item }));
  const bypassToken = String(env?.PROFIT_DASHBOARD_BYPASS_TOKEN || "").trim();
  if (!normalized.length || !bypassToken) return normalized;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(profitDashboardDataUrl, {
      headers: { "OAI-Sites-Authorization": `Bearer ${bypassToken}` },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const mapping = profitSkuMapFromDashboard(await response.json());
    return normalized.map((item) => ({
      ...item,
      skuLabel: mapping.get(shopeeProductId(item.productUrl)) || String(item.skuLabel || "").trim(),
    }));
  } catch (error) {
    console.error("PROFIT_SKU_LOOKUP", error?.message || error);
    return normalized;
  } finally {
    clearTimeout(timeout);
  }
}

function allowRequest(key) {
  const hour = Math.floor(Date.now() / 3_600_000);
  const usageKey = `${key}:${hour}`;
  const count = usage.get(usageKey) || 0;
  if (count >= 20) return false;
  usage.set(usageKey, count + 1);
  if (usage.size > 1000) {
    for (const entry of usage.keys()) {
      if (!entry.endsWith(`:${hour}`)) usage.delete(entry);
    }
  }
  return true;
}

function outputText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

const scriptSchema = {
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
          voice: { type: "string" },
        },
      },
    },
  },
};

async function generateScript(body, env, options = {}) {
  if (!env.OPENAI_API_KEY) throw httpError("AI 服務尚未設定完成", 503);

  const signal = options?.signal;
  const productUrl = await resolveShopeeUrl(String(body.productUrl || ""), signal);
  const pageContent = await fetchShopeePageContent(productUrl, env, signal);
  const suppliedTitle = String(body.productName || body.title || "").replace(/\s+/g, " ").trim().slice(0, 500);
  const title = pageContent.title || suppliedTitle || productTitle(productUrl);
  const focus = String(body.focus || "").trim().slice(0, 300);
  const requestedSeconds = Math.min(60, Math.max(10, Number.parseInt(body.seconds, 10) || 40));

  const prompt = [
    `商品網址可辨識標題：${title}`,
    pageContent.description
      ? `以下是實際商品頁內容，請優先根據其中的商品特色、材質、尺寸、數量、顏色與使用方式撰寫：\n---商品頁內容---\n${pageContent.description}\n---商品頁內容結束---`
      : "商品頁內容目前無法讀取，只能根據商品名稱撰寫；不可自行補充規格或賣點。",
    `使用者希望的拍攝方向：${focus || "沒有指定，請突出最容易用畫面證明的賣點"}`,
    `請製作一支總長剛好 ${requestedSeconds} 秒的繁體中文蝦皮商品短影片口播腳本。`,
    "輸出只要 3 段：開頭、賣點、結尾。每段包含連續且不重疊的秒數與一段自然口播，不要拆成多個鏡頭，也不要另寫字幕。",
    `totalSeconds 必須是 ${requestedSeconds}，三段時間必須從 0 秒開始、連續分配，最後剛好在 ${requestedSeconds} 秒結束。`,
    "開頭約占 15%，用一句話吸引目標客群；賣點是主體；結尾約占 20%，要有簡短行動引導。",
    "影片固定使用單一鏡頭，所以不要提供拍攝方式、搭配動作、鏡位、運鏡或畫面指示。",
    "若使用者指定內裝、隔層或容量，賣點口播必須集中介紹該方向。",
    "只能根據商品標題、上述商品頁內容與使用者方向撰寫；不要捏造材質、尺寸、數量、耐用年限或商品頁未提供的保證。",
    "口播總長要能在指定秒數內自然說完，語氣像台灣電商短影片拍攝人員，清楚直接，不要誇大。",
  ].join("\n");

  const openai = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.6-luna",
      reasoning: { effort: "none" },
      instructions: "你是台灣電商短影片導演，專門把商品資料轉成能直接照著拍的短腳本。",
      input: prompt,
      max_output_tokens: 1000,
      text: {
        format: {
          type: "json_schema",
          name: "shooting_script",
          strict: true,
          schema: scriptSchema,
        },
      },
    }),
    signal,
  });

  const response = await openai.json();
  if (!openai.ok) {
    console.error("OpenAI error", openai.status, response?.error?.code || "unknown");
    if (openai.status === 401) throw httpError("AI 金鑰無效，請通知管理者", 502);
    if (openai.status === 429) throw httpError("AI 使用額度不足或請求太多，請稍後再試", 502);
    throw httpError("AI 暫時無法產生腳本，請稍後再試", 502);
  }

  const text = outputText(response);
  if (!text) throw httpError("AI 沒有回傳腳本，請再試一次", 502);
  try {
    const script = JSON.parse(text);
    script.productName = title;
    script.totalSeconds = requestedSeconds;
    script.pageContentRead = Boolean(pageContent.description);
    return script;
  } catch {
    throw httpError("AI 回傳格式錯誤，請再試一次", 502);
  }
}

function findShopeeUrl(text) {
  return findShopeeUrls(text)[0] || "";
}

function findShopeeUrls(text) {
  const urls = [];
  const seen = new Set();
  for (const match of String(text || "").matchAll(/https?:\/\/[^\s<>"'\[\]()]+/giu)) {
    try {
      const rawUrl = cleanShopeeUrl(match[0]).toString();
      const productUrl = canonicalShopeeUrl(rawUrl);
      if (seen.has(productUrl)) continue;
      seen.add(productUrl);
      urls.push(rawUrl);
    } catch {}
  }
  return urls;
}

function scheduleItemsFromText(text) {
  return findShopeeUrls(text).slice(0, 50).map((rawUrl) => ({
    productUrl: canonicalShopeeUrl(rawUrl),
    productName: productTitle(rawUrl).slice(0, 160),
  }));
}

function isScheduleAddCommand(text) {
  return /^廣告影片排程(?:\s|$)/u.test(String(text || "").trim());
}

function isPendingScheduleCommand(text) {
  return /^要拍什麼[？?]?$/u.test(String(text || "").trim());
}

function isCompletedScheduleCommand(text) {
  return /^已拍完$/u.test(String(text || "").trim());
}

function normalizeScheduleDigits(text) {
  return String(text || "").trim().replace(/[０-９]/gu, (digit) => String(digit.charCodeAt(0) - 0xFF10));
}

function parseScheduleSelection(text) {
  const match = normalizeScheduleDigits(text).match(/^(\d{1,3})$/u);
  if (!match) return null;
  const index = Number.parseInt(match[1], 10);
  return index >= 1 ? index : null;
}

function parseScheduleCompletion(text) {
  const match = normalizeScheduleDigits(text).match(/^完成\s*(?:第\s*)?(\d{1,3})(?:\s*號)?$/u);
  if (!match) return null;
  const index = Number.parseInt(match[1], 10);
  return index >= 1 ? index : null;
}

function parseScheduleUndoCompletion(text) {
  const match = normalizeScheduleDigits(text).match(/^取消完成\s*(?:第\s*)?(\d{1,3})(?:\s*號)?$/u);
  if (!match) return null;
  const index = Number.parseInt(match[1], 10);
  return index >= 1 ? index : null;
}

function formatTaipeiDate(timestamp) {
  try {
    return new Intl.DateTimeFormat("zh-TW", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(Number(timestamp)));
  } catch {
    return "時間不明";
  }
}

function splitLineText(text, maxLength = 4500, maxMessages = 5) {
  const lines = String(text || "").split("\n");
  const chunks = [];
  let current = "";
  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
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

function formatScheduleProductName(item) {
  const productName = String(item?.productName || "蝦皮商品").replace(/\s+/g, " ").trim() || "蝦皮商品";
  const skuLabel = String(item?.skuLabel || "").replace(/\s+/g, " ").trim();
  return skuLabel && !productName.startsWith(`【${skuLabel}】`)
    ? `【${skuLabel}】${productName}`
    : productName;
}

function formatPendingSchedule(items) {
  if (!items.length) return "🎬 目前沒有待拍的廣告影片。";
  const lines = [`🎬 全域待拍廣告影片（共 ${items.length} 項）`, ""];
  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${formatScheduleProductName(item)}`);
    lines.push(`   ${item.productUrl}`);
  });
  lines.push("", "請回覆編號產生文案，例如：1", "拍攝完成後輸入「完成1」。");
  return lines.join("\n");
}

function formatCompletedSchedule(items) {
  if (!items.length) return "✅ 目前還沒有已拍完的紀錄。";
  const lines = [`✅ 全域已拍完（共 ${items.length} 項）`, ""];
  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${formatScheduleProductName(item)}`);
    lines.push(`   完成時間：${formatTaipeiDate(item.completedAt)}`);
    lines.push(`   拍攝員工：${item.completedBy || "群組成員"}`);
    lines.push(`   ${item.productUrl}`);
  });
  lines.push("", "若誤標完成，輸入「取消完成1」。");
  return lines.join("\n");
}

function lineInput(text, productUrl) {
  const secondsMatch = String(text).match(/(?:約\s*)?(\d{2})\s*秒/u);
  const seconds = secondsMatch ? Math.min(60, Math.max(10, Number.parseInt(secondsMatch[1], 10))) : 40;
  const focus = String(text)
    .replace(/https?:\/\/[^\s]+/iu, " ")
    .replace(/(?:約\s*)?\d{2}\s*秒/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
  return { productUrl, focus, seconds };
}

function panelPostback(productUrl, seconds, focus = "", title = "", action = "generate") {
  const params = new URLSearchParams({
    action,
    url: canonicalShopeeUrl(productUrl),
    seconds: String(seconds),
    focus,
  });
  let compactTitle = String(title || "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (compactTitle) params.set("title", compactTitle);

  // LINE postback data is limited to 300 characters. Chinese characters expand
  // when URL encoded, so trim by the final encoded size instead of raw length.
  while (compactTitle && params.toString().length > 300) {
    compactTitle = compactTitle.slice(0, -1);
    if (compactTitle) params.set("title", compactTitle);
    else params.delete("title");
  }
  return params.toString();
}

function focusPanelPostback(productUrl, seconds, title = "") {
  return panelPostback(productUrl, seconds, "", title, "choose_focus");
}

function createLinePanel(productUrl, title) {
  const options = [
    { label: "30 秒快速版", seconds: 30 },
    { label: "40 秒標準版", seconds: 40 },
    { label: "60 秒詳細版", seconds: 60 },
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
      displayText: option.label,
    },
  }));

  return {
    type: "flex",
    altText: `請選擇「${title}」的拍攝腳本`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#174B3A",
        paddingAll: "20px",
        contents: [
          { type: "text", text: "AI 商品拍攝腳本", color: "#D9F46B", weight: "bold", size: "sm" },
          { type: "text", text: "選擇腳本版本", color: "#FFFFFF", weight: "bold", size: "xl", margin: "sm" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "20px",
        contents: [
          { type: "text", text: title, weight: "bold", size: "md", wrap: true, maxLines: 2 },
          { type: "text", text: "先選擇秒數，下一步再選拍攝重點。", color: "#718078", size: "sm", wrap: true, margin: "sm" },
          ...buttons,
        ],
      },
    },
  };
}

function createLineFocusPanel(productUrl, title, seconds) {
  const options = [
    { label: "AI 自動選擇重點", focus: "" },
    { label: "重點拍容量", focus: "重點拍容量" },
    { label: "重點拍材質", focus: "重點拍材質" },
    { label: "重點拍使用方式", focus: "重點拍使用方式" },
  ];
  const buttons = options.map((option, index) => ({
    type: "button",
    style: index === 0 ? "primary" : "secondary",
    color: index === 0 ? "#174B3A" : undefined,
    height: "sm",
    margin: index === 0 ? "lg" : "sm",
    action: {
      type: "postback",
      label: option.label,
      data: panelPostback(productUrl, seconds, option.focus, title),
      displayText: option.label,
    },
  }));

  return {
    type: "flex",
    altText: `請選擇「${title}」的拍攝重點`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#174B3A",
        paddingAll: "20px",
        contents: [
          { type: "text", text: `${seconds} 秒腳本`, color: "#D9F46B", weight: "bold", size: "sm" },
          { type: "text", text: "選擇拍攝重點", color: "#FFFFFF", weight: "bold", size: "xl", margin: "sm" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "20px",
        contents: [
          { type: "text", text: title, weight: "bold", size: "md", wrap: true, maxLines: 2 },
          { type: "text", text: "不指定時，AI 會依商品名稱自動選擇。", color: "#718078", size: "sm", wrap: true, margin: "sm" },
          ...buttons,
        ],
      },
    },
  };
}

function formatLineScript(script) {
  const sections = (script.segments || []).map((segment, index) =>
    `${index + 1}｜${segment.time}｜${segment.title}\n${segment.voice}`
  );
  const direction = script.direction ? `\n拍攝重點：${script.direction}` : "";
  const source = script.pageContentRead === true
    ? "📄 已讀取商品頁內容"
    : script.pageContentRead === false ? "⚠️ 商品頁無法讀取，本次僅依商品名稱生成" : "";
  return [
    `🎬 ${script.productName}`,
    source,
    `⏱ ${script.totalSeconds} 秒${direction}`,
    "",
    ...sections,
  ].filter(Boolean).join("\n\n").slice(0, 4900);
}

function base64Bytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function verifyLineSignature(rawBody, signature, channelSecret) {
  if (!signature || !channelSecret) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(channelSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    return crypto.subtle.verify("HMAC", key, base64Bytes(signature), encoder.encode(rawBody));
  } catch {
    return false;
  }
}

async function replyLine(replyToken, messageOrMessages, env) {
  const messages = Array.isArray(messageOrMessages)
    ? messageOrMessages
    : [{ type: "text", text: String(messageOrMessages).slice(0, 5000) }];
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!response.ok) console.error("LINE reply error", response.status, await response.text());
}

function isGroupSource(source) {
  return source?.type === "group" || source?.type === "room";
}

function isSelfMentioned(message) {
  return (message?.mention?.mentionees || []).some((mentionee) =>
    mentionee.type === "user" && mentionee.isSelf === true
  );
}

function removeLineMentions(text, mention) {
  let cleaned = String(text || "");
  const ranges = (mention?.mentionees || [])
    .filter((mentionee) => Number.isInteger(mentionee.index) && Number.isInteger(mentionee.length))
    .sort((a, b) => b.index - a.index);
  for (const range of ranges) {
    cleaned = `${cleaned.slice(0, range.index)} ${cleaned.slice(range.index + range.length)}`;
  }
  return cleaned.replace(/\s+/g, " ").trim();
}

function isLineHelpCommand(text) {
  return /^(?:使用方法|使用說明|如何使用|怎麼用|說明|help)$/iu.test(String(text || "").trim());
}

function isLineScriptPromptCommand(text) {
  return /^(?:產生文案|商品文案|寫文案)$/u.test(String(text || "").trim());
}

function parseWarehouseLocationCommand(text) {
  const normalized = normalizeScheduleDigits(text).trim();
  const prefixed = normalized.match(/^儲位\s*(?:[+＋:：]\s*)?([^\s]+)\s*$/iu);
  if (prefixed) {
    const sku = String(prefixed[1] || "").replace(/[，,。；;]+$/u, "").trim().toUpperCase();
    const isPrefixedSku = /^(?=[A-Z0-9._-]{2,80}$)(?=[A-Z0-9._-]*[A-Z])(?=[A-Z0-9._-]*\d)[A-Z0-9._-]+$/u.test(sku);
    return isPrefixedSku ? sku : null;
  }

  const sku = normalized.toUpperCase();
  const isBareSku = /^(?=[A-Z0-9._-]{2,80}$)(?=[A-Z0-9._-]*[A-Z])(?=[A-Z0-9._-]*\d)[A-Z0-9._-]+$/u.test(sku);
  return isBareSku ? sku : null;
}

function parseWarehouseLocationDetailCommand(text) {
  const normalized = normalizeScheduleDigits(text).replace(/\s+/g, " ").trim();
  const match = normalized.match(/^(?:完整儲位|儲位明細)\s*(?:[+＋:：]\s*)?([^\s]+)\s*$/u);
  return match ? parseWarehouseLocationCommand(String(match[1] || "")) : null;
}

function normalizeWarehouseSearchText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .slice(0, 160);
}

function parseWarehouseSearchCommand(text) {
  const normalized = normalizeScheduleDigits(text).replace(/\s+/g, " ").trim();
  if (!normalized || /https?:\/\/|shopee/iu.test(normalized)) return null;
  const prefixed = normalized.match(/^(?:儲位|查詢?|搜(?:尋)?)\s*(?:[+＋:：]\s*)?(.+)$/iu);
  const keyword = String(prefixed?.[1] || normalized).trim().slice(0, 80);
  const searchable = normalizeWarehouseSearchText(keyword);
  if (!searchable || parseWarehouseLocationCommand(keyword)) return null;
  return keyword;
}

function warehouseSearchScore(item, keyword) {
  const query = normalizeWarehouseSearchText(keyword);
  const sku = normalizeWarehouseSearchText(item?.sku);
  const name = normalizeWarehouseSearchText(item?.name);
  if (!query || (!sku.includes(query) && !name.includes(query))) return null;
  if (sku === query) return 0;
  if (name === query) return 1;
  if (name.startsWith(query)) return 2;
  if (name.includes(query)) return 3;
  return 4;
}

function lineHelpText() {
  return [
    "📖 文案小幫手指令說明",
    "",
    "【查看說明】",
    "@文案小幫手",
    "顯示這份完整指令清單。",
    "",
    "【單支商品文案】",
    "群組：@文案小幫手 後，10 秒內貼蝦皮連結；也可以在同一則訊息直接 @並貼連結。",
    "私訊：直接貼蝦皮連結。",
    "功能：產生 40 秒標準版文案，拍攝重點由 AI 自動判斷。",
    "",
    "【廣告影片排程】",
    "所有群組與私訊共用同一份待拍、已拍完清單。",
    "廣告影片排程＋商品連結",
    "一次新增一個或多個蝦皮商品到待拍清單。",
    "",
    "要拍什麼",
    "列出目前所有待拍商品與編號。",
    "",
    "1、2、3…",
    "直接讀取該編號已儲存的商品網址並產生文案，不必重貼連結。",
    "",
    "完成1、完成2…",
    "把待拍清單中的該編號移到已拍完。",
    "",
    "已拍完",
    "列出完成時間、拍攝員工、商品與已拍完編號。",
    "",
    "取消完成1、取消完成2…",
    "依照『已拍完』清單編號，將誤標完成的商品退回待拍清單。",
    "",
    "【查詢 ERP 主倉儲位】",
    "直接輸入貨號，例如：A12345",
    "原本的「儲位 A12345」也可以使用。",
    "回覆商品圖片、貨號、商品名稱、主要儲位與主倉可用庫存。",
    "點卡片中的「完整儲位」可查看所有規格明細。",
    "",
    "直接輸入商品關鍵字，例如：洗衣袋",
    "「查 洗衣袋」或「儲位 洗衣袋」也可以使用。",
    "回覆相關商品圖片、貨號、主要儲位與庫存；點『完整儲位』可查看所有規格。",
    "",
    "排程相關指令不需要 @文案小幫手。",
    "儲位查詢也不需要 @文案小幫手。",
  ].join("\n");
}

function lineHelpQuickReplyItems() {
  return [
    { label: "🔍 查商品", text: "查" },
    { label: "📍 查儲位", text: "儲位" },
    { label: "🎬 要拍什麼", text: "要拍什麼" },
    { label: "➕ 新增排程", text: "廣告影片排程" },
    { label: "✅ 已拍完", text: "已拍完" },
    { label: "📝 產生文案", text: "產生文案" },
  ].map((item) => ({
    type: "action",
    action: {
      type: "message",
      label: item.label,
      text: item.text,
    },
  }));
}

function createLineHelpMessage() {
  return {
    type: "text",
    text: lineHelpText().slice(0, 5000),
    quickReply: { items: lineHelpQuickReplyItems() },
  };
}

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
      available: Math.trunc(Number(rawVariant?.available) || 0),
    });
  }
  return {
    sku,
    name: String(rawItem?.name || "ERP 商品").replace(/\s+/g, " ").trim().slice(0, 200) || "ERP 商品",
    available: Math.trunc(Number(rawItem?.available) || 0),
    variants,
  };
}

function warehouseLocationBucket(sku, bucketCount = 64) {
  let hash = 2166136261;
  for (const char of String(sku || "")) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % bucketCount;
}

function formatWarehouseLocation(item, metadata = {}) {
  if (!item) {
    const updated = metadata.updatedAt ? `\n儲位資料更新：${formatTaipeiDate(Date.parse(metadata.updatedAt))}` : "";
    return `🔎 ERP 主倉查無此貨號。\n請確認貨號是否完整，例如：A12345${updated}`;
  }
  const lines = [
    `📦 ${item.sku}｜${item.name}`,
    `主倉可用庫存：${Number(item.available) || 0}`,
    "儲位：",
  ];
  const variants = Array.isArray(item.variants) ? item.variants : [];
  const located = variants.filter((variant) => String(variant.location || "").trim());
  if (!located.length) {
    lines.push("尚未設定儲位");
  } else {
    const shown = located.slice(0, 40);
    for (const variant of shown) {
      const specification = [variant.style, variant.size].filter(Boolean).join("／");
      const prefix = specification ? `${specification}：` : "";
      lines.push(`- ${prefix}${variant.location}（可用 ${Number(variant.available) || 0}）`);
    }
    if (located.length > shown.length) lines.push(`另有 ${located.length - shown.length} 筆規格未列出。`);
  }
  if (metadata.updatedAt) lines.push(`更新：${formatTaipeiDate(Date.parse(metadata.updatedAt))}`);
  return lines.join("\n");
}

function warehouseSearchLocations(item) {
  const unique = [];
  for (const variant of Array.isArray(item?.variants) ? item.variants : []) {
    const location = String(variant?.location || "").replace(/\s+/g, " ").trim();
    if (location && !unique.includes(location)) unique.push(location);
    if (unique.length >= 2) break;
  }
  return unique;
}

function createWarehouseSearchMessage(items, keyword, totalCount = items.length) {
  const shown = (Array.isArray(items) ? items : []).slice(0, 10);
  const bubbles = shown.map((item) => {
    const imageUrl = normalizeShopeeImageUrl(item?.imageUrl);
    const locations = warehouseSearchLocations(item);
    const bubble = {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: `【${item.sku}】`, weight: "bold", color: "#174B3A", size: "lg" },
          { type: "text", text: String(item.name || "ERP 商品"), wrap: true, maxLines: 3, weight: "bold", size: "md" },
          { type: "separator", margin: "md" },
          { type: "text", text: `主倉可用：${Number(item.available) || 0}`, margin: "md", size: "sm" },
          {
            type: "text",
            text: locations.length ? `主要儲位：${locations.join("、")}` : "主要儲位：尚未設定",
            wrap: true,
            maxLines: 2,
            size: "sm",
            color: "#555555",
          },
        ],
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
          action: { type: "message", label: "完整儲位", text: `完整儲位 ${item.sku}` },
        }],
      },
    };
    if (item.productUrl) {
      bubble.footer.contents.push({
        type: "button",
        style: "link",
        height: "sm",
        action: { type: "uri", label: "查看蝦皮商品", uri: item.productUrl },
      });
    }
    if (imageUrl) {
      bubble.hero = {
        type: "image",
        url: imageUrl,
        size: "full",
        aspectRatio: "1:1",
        aspectMode: "cover",
      };
    } else {
      bubble.header = {
        type: "box",
        layout: "vertical",
        backgroundColor: "#E9F2EE",
        paddingAll: "16px",
        contents: [{ type: "text", text: "📦 ERP 商品", align: "center", color: "#174B3A", weight: "bold" }],
      };
    }
    return bubble;
  });
  const extra = totalCount > shown.length ? `，顯示前 ${shown.length} 項` : "";
  return {
    type: "flex",
    altText: `「${keyword}」找到 ${totalCount} 項商品${extra}`.slice(0, 1500),
    contents: { type: "carousel", contents: bubbles },
  };
}

function parseLineFollowup(text) {
  const match = String(text || "").trim().match(/^(?:約\s*)?(\d{2})(?:\s*秒)?(?:\s*[；;、,，:]?\s*(.*))?$/u);
  if (!match) return null;
  const seconds = Number.parseInt(match[1], 10);
  if (seconds < 10 || seconds > 60) return null;
  return { seconds, focus: String(match[2] || "").trim().slice(0, 300) };
}

function linePendingKey(event) {
  const source = event?.source || {};
  const chatId = source.groupId || source.roomId || source.userId || "unknown-chat";
  const userId = source.userId || "unknown-user";
  return `line-pending:${chatId}:${userId}`;
}

function lineActivationKey(event) {
  const source = event?.source || {};
  const chatId = source.groupId || source.roomId || "unknown-chat";
  return `line-armed:${chatId}`;
}

export class LineActivation {
  constructor(state, env) {
    this.storage = state.storage;
    this.env = env;
    this.readerSocket = null;
    this.readerHello = null;
    this.readerPending = new Map();
  }

  readerAuthorized(request) {
    const token = String(this.env.SHOPEE_READER_TOKEN || "");
    return Boolean(token) && request.headers.get("Authorization") === `Bearer ${token}`;
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
    server.addEventListener("close", () => this.clearReader());
    server.addEventListener("error", () => this.clearReader());
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

  extractWithReader(request) {
    if (!this.readerSocket || this.readerSocket.readyState !== WebSocket.OPEN) {
      return Response.json({ ok: false, error: "SHOPEE_READER_OFFLINE" }, { status: 503 });
    }
    return request.json().then(({ url }) => {
      const id = crypto.randomUUID();
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          this.readerPending.delete(id);
          resolve(Response.json({ ok: false, error: "SHOPEE_READER_TIMEOUT" }, { status: 504 }));
        }, 35000);
        this.readerPending.set(id, { resolve, timer });
        try {
          this.readerSocket.send(JSON.stringify({ type: "extract", id, url }));
        } catch {
          clearTimeout(timer);
          this.readerPending.delete(id);
          resolve(Response.json({ ok: false, error: "SHOPEE_READER_SEND_FAILED" }, { status: 503 }));
        }
      });
    });
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
      const productName = String(rawItem?.productName || "蝦皮商品").replace(/\s+/g, " ").trim().slice(0, 160);
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
        productName: productName || "蝦皮商品",
        addedAt: Number(body?.addedAt) || Date.now(),
        addedBy: String(body?.addedBy || "").slice(0, 120),
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
      completed: Array.isArray(completed) ? completed : [],
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
        productName: String(item?.productName || "蝦皮商品").slice(0, 160),
        addedAt: Number(item?.addedAt) || Date.now(),
        addedBy: String(item?.addedBy || "").slice(0, 120),
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
        productName: String(item?.productName || "蝦皮商品").slice(0, 160),
        completedAt: completedAt || Date.now(),
        completedBy: String(item?.completedBy || "群組成員").slice(0, 120),
        completedById: String(item?.completedById || "").slice(0, 80),
      });
      completedImported += 1;
    }
    completed.sort((a, b) => Number(b.completedAt) - Number(a.completedAt));

    await this.storage.put("schedule-pending", pending);
    await this.storage.put("schedule-completed", completed.slice(0, 200));
    if (sourceScope) {
      await this.storage.put("schedule-imported-scopes", [...importedScopes, sourceScope].slice(-1000));
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
      pendingCount: items.length,
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
        retryAfterSeconds: Math.max(1, Math.ceil((current.expiresAt - now) / 1000)),
      });
    }
    const token = crypto.randomUUID();
    const ttlMs = Math.min(60000, Math.max(5000, Number(body?.ttlMs) || 30000));
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
      productName: String(body?.productName || selected.productName || "蝦皮商品").slice(0, 160),
      completedAt: Number(body?.completedAt) || Date.now(),
      completedBy: String(body?.completedBy || "群組成員").slice(0, 120),
      completedById: String(body?.completedById || "").slice(0, 80),
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
        full: false,
      });
    }

    const selected = completed[selectedIndex];
    const alreadyPending = pending.some((item) => item.productUrl === selected.productUrl);
    if (!alreadyPending && pending.length >= 100) {
      return Response.json({
        restored: null,
        pendingCount: pending.length,
        completedCount: completed.length,
        full: true,
      });
    }

    completed.splice(selectedIndex, 1);
    const restored = {
      productUrl: selected.productUrl,
      productName: selected.productName || "蝦皮商品",
      addedAt: Date.now(),
      addedBy: selected.completedById || selected.addedBy || "",
    };
    if (!alreadyPending) pending.push(restored);
    await this.storage.put("schedule-pending", pending);
    await this.storage.put("schedule-completed", completed);
    return Response.json({
      restored,
      pendingCount: pending.length,
      completedCount: completed.length,
      alreadyPending,
      full: false,
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

  async scheduleWarehouseImageAlarm(delayMs, force = false) {
    if (typeof this.storage.setAlarm !== "function") return;
    const target = Date.now() + Math.max(1_000, Number(delayMs) || warehouseImageFetchMinDelayMs);
    if (!force && typeof this.storage.getAlarm === "function") {
      const current = await this.storage.getAlarm();
      if (current && Number(current) <= target) return;
    }
    await this.storage.setAlarm(target);
  }

  async reconcileWarehouseImages(request) {
    const body = await request.json();
    const candidatesBySku = new Map();
    for (const raw of Array.isArray(body?.candidates) ? body.candidates.slice(0, 20000) : []) {
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
        candidates.slice(index * warehouseImageQueueChunkSize, (index + 1) * warehouseImageQueueChunkSize),
      );
    }
    const metadata = {
      version,
      itemCount: candidates.length,
      chunkCount,
      nextIndex: 0,
      cachedCount: 0,
      failedCount: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.storage.put("warehouse-image-queue", metadata);
    if (previous?.version && previous.version !== version) {
      const previousChunkCount = Math.min(1000, Math.max(0, Number(previous.chunkCount) || 0));
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
    const candidatesBySku = new Map();
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
        35_000,
        "NAS 商品圖片讀取逾時",
      );
      sourceImageUrl = normalizeShopeeImageUrl(product.imageUrl);
    }
    if (!sourceImageUrl) throw new Error("SHOPEE_IMAGE_NOT_FOUND");

    const image = await withAbortTimeout(async (signal) => {
      const response = await fetch(sourceImageUrl, {
        headers: { "Accept": "image/avif,image/webp,image/*,*/*;q=0.8" },
        redirect: "follow",
        signal,
      });
      if (!response.ok) throw new Error(`IMAGE_HTTP_${response.status}`);
      const contentType = String(response.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
      if (!contentType.startsWith("image/")) throw new Error("IMAGE_CONTENT_TYPE_INVALID");
      const declaredSize = Number(response.headers.get("Content-Length")) || 0;
      if (declaredSize > warehouseImageMaxBytes) throw new Error("IMAGE_TOO_LARGE");
      const bytes = await response.arrayBuffer();
      if (!bytes.byteLength || bytes.byteLength > warehouseImageMaxBytes) throw new Error("IMAGE_SIZE_INVALID");
      return { bytes, contentType };
    }, 20_000, "商品圖片下載逾時");

    const cachedAt = Date.now();
    await this.env.PRODUCT_IMAGES.put(warehouseImageObjectKey(candidate.sku), image.bytes, {
      metadata: {
        contentType: image.contentType,
        sku: candidate.sku,
        productId: candidate.productId,
        cachedAt: String(cachedAt),
      },
    });
    const record = {
      sku: candidate.sku,
      productId: candidate.productId,
      productUrl: candidate.productUrl,
      imageUrl: warehouseImagePublicUrl(candidate.sku, cachedAt),
      cachedAt,
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
      const latest = Array.isArray(latestValue) ? latestValue : [];
      const first = latest[0];
      if (first?.sku === current.candidate.sku && first?.productId === current.candidate.productId) {
        latest.shift();
        if (latest.length) await this.storage.put("warehouse-image-priority", latest);
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
    latest.updatedAt = new Date().toISOString();
    await this.storage.put("warehouse-image-queue", latest);
  }

  async processWarehouseImageQueue() {
    const now = Date.now();
    const today = taipeiDayKey(now);
    const rateValue = await this.storage.get("warehouse-image-rate");
    const rate = rateValue?.day === today ? rateValue : { day: today, attempts: 0 };
    if (Number(rate.attempts) >= warehouseImageFetchDailyLimit) {
      await this.scheduleWarehouseImageAlarm(
        Math.max(60_000, nextTaipeiDayStart(now) - now + warehouseImageDelay(5 * 60_000, 15 * 60_000)),
        true,
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
      await this.scheduleWarehouseImageAlarm(1_000, true);
      return;
    }

    rate.attempts = Number(rate.attempts) + 1;
    rate.updatedAt = new Date().toISOString();
    await this.storage.put("warehouse-image-rate", rate);
    const runtimeValue = await this.storage.get("warehouse-image-runtime");
    const runtime = runtimeValue && typeof runtimeValue === "object" ? runtimeValue : {};
    try {
      await this.downloadWarehouseImage(current.candidate);
      await this.advanceWarehouseImageCandidate(current, true);
      runtime.consecutiveFailures = 0;
      runtime.failureKey = "";
      runtime.candidateFailures = 0;
      runtime.lastSuccessAt = new Date().toISOString();
      runtime.lastError = "";
      await this.storage.put("warehouse-image-runtime", runtime);
      const delay = rate.attempts % warehouseImageFetchBatchSize === 0
        ? warehouseImageFetchBatchPauseMs
        : warehouseImageDelay();
      await this.scheduleWarehouseImageAlarm(delay, true);
    } catch (error) {
      const failureKey = `${current.candidate.sku}:${current.candidate.productId}`;
      runtime.candidateFailures = runtime.failureKey === failureKey
        ? Math.min(3, Number(runtime.candidateFailures) + 1)
        : 1;
      runtime.failureKey = failureKey;
      runtime.consecutiveFailures = Math.min(8, Number(runtime.consecutiveFailures) + 1);
      runtime.lastFailureAt = new Date().toISOString();
      runtime.lastError = String(error?.message || error).slice(0, 200);
      if (runtime.candidateFailures >= 3) {
        await this.advanceWarehouseImageCandidate(current, false, true);
        runtime.failureKey = "";
        runtime.candidateFailures = 0;
        runtime.consecutiveFailures = 0;
      }
      await this.storage.put("warehouse-image-runtime", runtime);
      const delay = Math.min(
        6 * 60 * 60_000,
        warehouseImageFailureBaseDelayMs * (2 ** Math.max(0, runtime.consecutiveFailures - 1)),
      ) + warehouseImageDelay(60_000, 5 * 60_000);
      console.error("WAREHOUSE_IMAGE_CACHE", current.candidate.sku, runtime.lastError);
      await this.scheduleWarehouseImageAlarm(delay, true);
    }
  }

  async warehouseImageStatus() {
    const [queue, priority, rate, runtime] = await Promise.all([
      this.storage.get("warehouse-image-queue"),
      this.storage.get("warehouse-image-priority"),
      this.storage.get("warehouse-image-rate"),
      this.storage.get("warehouse-image-runtime"),
    ]);
    return Response.json({
      ok: true,
      queue: queue || null,
      priorityCount: Array.isArray(priority) ? priority.length : 0,
      rate: rate || null,
      runtime: runtime || null,
    });
  }

  async alarm() {
    await this.processWarehouseImageQueue();
  }

  async syncWarehouseLocations(request) {
    const body = await request.json();
    if (!Array.isArray(body?.items) || !body.items.length) {
      return Response.json({ ok: false, error: "EMPTY_LOCATION_DATA" }, { status: 400 });
    }
    const bucketCount = 64;
    const buckets = Array.from({ length: bucketCount }, () => ({}));
    const searchItems = [];
    let itemCount = 0;
    for (const rawItem of body.items.slice(0, 20000)) {
      const item = normalizeWarehouseLocationItem(rawItem);
      if (!item) continue;
      buckets[warehouseLocationBucket(item.sku, bucketCount)][item.sku] = item;
      searchItems.push({ sku: item.sku, name: item.name });
      itemCount += 1;
    }
    if (!itemCount) {
      return Response.json({ ok: false, error: "EMPTY_LOCATION_DATA" }, { status: 400 });
    }

    const previous = await this.storage.get("warehouse-location-active");
    const version = crypto.randomUUID();
    for (let index = 0; index < bucketCount; index += 1) {
      await this.storage.put(`warehouse-location:${version}:${index}`, buckets[index]);
    }
    const searchChunkSize = 300;
    const searchChunkCount = Math.ceil(searchItems.length / searchChunkSize);
    for (let index = 0; index < searchChunkCount; index += 1) {
      await this.storage.put(
        `warehouse-location-search:${version}:${index}`,
        searchItems.slice(index * searchChunkSize, (index + 1) * searchChunkSize),
      );
    }
    const metadata = {
      version,
      bucketCount,
      itemCount,
      searchChunkCount,
      warehouseId: Number(body?.warehouseId) || 1,
      warehouseName: String(body?.warehouseName || "主倉").slice(0, 80),
      updatedAt: String(body?.updatedAt || new Date().toISOString()).slice(0, 80),
    };
    await this.storage.put("warehouse-location-active", metadata);

    if (previous?.version && previous.version !== version) {
      const previousCount = Math.min(256, Math.max(1, Number(previous.bucketCount) || bucketCount));
      for (let index = 0; index < previousCount; index += 1) {
        await this.storage.delete(`warehouse-location:${previous.version}:${index}`);
      }
      const previousSearchCount = Math.min(1000, Math.max(0, Number(previous.searchChunkCount) || 0));
      for (let index = 0; index < previousSearchCount; index += 1) {
        await this.storage.delete(`warehouse-location-search:${previous.version}:${index}`);
      }
    }
    return Response.json({ ok: true, itemCount, updatedAt: metadata.updatedAt });
  }

  async queryWarehouseLocation(request) {
    const { sku: rawSku } = await request.json();
    const sku = String(rawSku || "").replace(/\s+/g, "").trim().toUpperCase().slice(0, 80);
    const metadata = await this.storage.get("warehouse-location-active");
    if (!metadata?.version || !sku) {
      return Response.json({ ok: true, item: null, metadata: metadata || null });
    }
    const bucketCount = Math.min(256, Math.max(1, Number(metadata.bucketCount) || 64));
    const bucket = await this.storage.get(
      `warehouse-location:${metadata.version}:${warehouseLocationBucket(sku, bucketCount)}`,
    );
    const locationItem = bucket && typeof bucket === "object" ? bucket[sku] || null : null;
    const cached = locationItem ? await this.warehouseImageCacheRecord(sku) : null;
    return Response.json({
      ok: true,
      item: cached?.imageUrl ? {
        ...locationItem,
        productId: cached.productId,
        productUrl: cached.productUrl,
        imageUrl: cached.imageUrl,
      } : locationItem,
      metadata,
    });
  }

  async searchWarehouseLocations(request) {
    const { keyword: rawKeyword, limit: rawLimit } = await request.json();
    const keyword = String(rawKeyword || "").trim().slice(0, 80);
    const normalizedKeyword = normalizeWarehouseSearchText(keyword);
    const metadata = await this.storage.get("warehouse-location-active");
    if (!metadata?.version || !normalizedKeyword) {
      return Response.json({ ok: true, items: [], totalCount: 0, metadata: metadata || null });
    }

    const chunkCount = Math.min(1000, Math.max(0, Number(metadata.searchChunkCount) || 0));
    let chunks;
    if (chunkCount) {
      chunks = await Promise.all(Array.from({ length: chunkCount }, (_, index) =>
        this.storage.get(`warehouse-location-search:${metadata.version}:${index}`)
      ));
    } else {
      const bucketCount = Math.min(256, Math.max(1, Number(metadata.bucketCount) || 64));
      const legacyBuckets = await Promise.all(Array.from({ length: bucketCount }, (_, index) =>
        this.storage.get(`warehouse-location:${metadata.version}:${index}`)
      ));
      chunks = [legacyBuckets.flatMap((bucket) => Object.values(bucket && typeof bucket === "object" ? bucket : {})
        .map((item) => ({ sku: item.sku, name: item.name })) )];
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
      await this.storage.get(`warehouse-location:${metadata.version}:${index}`),
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
        imageUrl: cached.imageUrl,
      } : item;
    });
    return Response.json({ ok: true, items, totalCount: matches.length, metadata });
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/reader/connect" && request.method === "GET") {
      return this.acceptReader(request);
    }
    if (url.pathname === "/reader/status" && request.method === "GET") {
      if (!this.readerAuthorized(request)) return new Response("Unauthorized", { status: 401 });
      return Response.json({
        connected: Boolean(this.readerSocket && this.readerSocket.readyState === WebSocket.OPEN),
        hello: this.readerHello,
      });
    }
    if (url.pathname === "/extract" && request.method === "POST") {
      return this.extractWithReader(request);
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
    if (url.pathname === "/warehouse-locations/query" && request.method === "POST") {
      return this.queryWarehouseLocation(request);
    }
    if (url.pathname === "/warehouse-locations/search" && request.method === "POST") {
      return this.searchWarehouseLocations(request);
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
      return Response.json({ valid: Boolean(armedAt) && elapsed >= 0 && elapsed <= 10000 });
    }
    return new Response("Not found", { status: 404 });
  }
}

async function durableLineActivation(event, env, action, timestamp) {
  if (!env.LINE_ACTIVATION) return null;
  try {
    const id = env.LINE_ACTIVATION.idFromName(lineActivationKey(event));
    const stub = env.LINE_ACTIVATION.get(id);
    const response = await stub.fetch(`https://line-activation/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "arm" ? { armedAt: timestamp } : { now: timestamp }),
    });
    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.error("LINE activation Durable Object error", error?.message || error);
    return null;
  }
}

async function armLineGroup(event, env) {
  const key = lineActivationKey(event);
  const armedAt = Number(event.timestamp) || Date.now();
  const durable = await durableLineActivation(event, env, "arm", armedAt);
  if (durable?.armed) {
    console.log("LINE_ARM", JSON.stringify({ storage: "durable", armed: true }));
    return true;
  }
  lineActivations.set(key, armedAt);
  if (lineActivations.size > 1000) {
    for (const [activationKey, timestamp] of lineActivations) {
      if (armedAt - timestamp > 60000) lineActivations.delete(activationKey);
    }
  }
  if (env.LINE_PENDING) {
    await env.LINE_PENDING.put(
      key,
      JSON.stringify({ armedAt }),
      { expirationTtl: 60 },
    );
  }
  console.log("LINE_ARM", JSON.stringify({ storage: env.LINE_PENDING ? "memory+kv" : "memory", armed: true }));
  return true;
}

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
    const elapsed = now - Number(memoryArmedAt);
    const valid = elapsed >= 0 && elapsed <= 10000;
    console.log("LINE_GATE", JSON.stringify({ storage: "memory", valid, elapsed }));
    return valid;
  }
  if (!env.LINE_PENDING) return false;
  const value = await env.LINE_PENDING.get(key, "json");
  await env.LINE_PENDING.delete(key);
  if (!value?.armedAt) return false;
  const elapsed = now - Number(value.armedAt);
  const valid = elapsed >= 0 && elapsed <= 10000;
  console.log("LINE_GATE", JSON.stringify({ storage: "kv", valid, elapsed }));
  return valid;
}

async function savePendingLineProduct(event, productUrl, productName, env) {
  if (!env.LINE_PENDING) return false;
  await env.LINE_PENDING.put(
    linePendingKey(event),
    JSON.stringify({ productUrl, productName, savedAt: Date.now() }),
    { expirationTtl: 600 },
  );
  return true;
}

async function takePendingLineProduct(event, env) {
  if (!env.LINE_PENDING) return null;
  const key = linePendingKey(event);
  const value = await env.LINE_PENDING.get(key, "json");
  if (!value?.productUrl) return null;
  await env.LINE_PENDING.delete(key);
  return value;
}

function lineScheduleScope(event) {
  const source = event?.source || {};
  return source.groupId || source.roomId || source.userId || "unknown-chat";
}

function lineScheduleStub(env, name) {
  const id = env.LINE_ACTIVATION.idFromName(name);
  return env.LINE_ACTIVATION.get(id);
}

async function migrateLegacyLineSchedule(event, env, globalStub) {
  const legacyScope = lineScheduleScope(event);
  const legacyName = `line-schedule:${legacyScope}`;
  if (legacyName === globalLineScheduleName) return;
  try {
    const legacyResponse = await lineScheduleStub(env, legacyName).fetch("https://line-schedule/schedule/list", {
      method: "POST",
    });
    if (!legacyResponse.ok) return;
    const legacy = await legacyResponse.json();
    const importResponse = await globalStub.fetch("https://line-schedule/schedule/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceScope: legacyScope,
        pending: legacy.pending || [],
        completed: legacy.completed || [],
      }),
    });
    if (!importResponse.ok) console.error("LINE schedule migration import failed", importResponse.status);
  } catch (error) {
    console.error("LINE schedule migration error", error?.message || error);
  }
}

async function lineScheduleRequest(event, env, action, body = {}) {
  if (!env.LINE_ACTIVATION) throw httpError("廣告影片排程儲存服務尚未設定", 503);
  const stub = lineScheduleStub(env, globalLineScheduleName);
  await migrateLegacyLineSchedule(event, env, stub);
  const response = await stub.fetch(`https://line-schedule/schedule/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw httpError("廣告影片排程暫時無法使用", 503);
  return response.json();
}

async function acquireLineScheduleGeneration(env) {
  if (!env.LINE_ACTIVATION) throw httpError("廣告影片排程儲存服務尚未設定", 503);
  const response = await lineScheduleStub(env, globalLineScheduleName).fetch(
    "https://line-schedule/schedule/generation-acquire",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ttlMs: 30000 }),
    },
  );
  if (!response.ok) throw httpError("文案產生鎖定服務暫時無法使用", 503);
  return response.json();
}

async function releaseLineScheduleGeneration(env, token) {
  if (!env.LINE_ACTIVATION || !token) return;
  try {
    await lineScheduleStub(env, globalLineScheduleName).fetch(
      "https://line-schedule/schedule/generation-release",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      },
    );
  } catch (error) {
    console.error("LINE schedule generation release error", error?.message || error);
  }
}

async function warehouseLocationRequest(env, sku) {
  if (!env.LINE_ACTIVATION) throw httpError("ERP 儲位查詢服務尚未設定", 503);
  const stub = lineScheduleStub(env, globalLineScheduleName);
  const response = await stub.fetch("https://line-schedule/warehouse-locations/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sku }),
  });
  if (!response.ok) throw httpError("ERP 儲位查詢暫時無法使用", 503);
  return response.json();
}

async function warehouseSearchRequest(env, keyword) {
  if (!env.LINE_ACTIVATION) throw httpError("ERP 儲位查詢服務尚未設定", 503);
  const stub = lineScheduleStub(env, globalLineScheduleName);
  const response = await stub.fetch("https://line-schedule/warehouse-locations/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keyword, limit: 10 }),
  });
  if (!response.ok) throw httpError("ERP 商品搜尋暫時無法使用", 503);
  return response.json();
}

function warehouseImageCandidate(sku, product) {
  return normalizeWarehouseImageCandidate({
    sku,
    productId: product?.productId,
    productUrl: product?.productUrl,
    sourceImageUrl: product?.imageUrl,
  });
}

async function enqueueWarehouseImageCandidates(env, candidates) {
  if (!env.LINE_ACTIVATION || !Array.isArray(candidates) || !candidates.length) return null;
  const response = await lineScheduleStub(env, globalLineScheduleName).fetch(
    "https://line-schedule/warehouse-images/enqueue",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidates }),
    },
  );
  if (!response.ok) throw new Error(`WAREHOUSE_IMAGE_ENQUEUE_HTTP_${response.status}`);
  return response.json();
}

async function enrichWarehouseSearchItems(items, env) {
  const normalized = (Array.isArray(items) ? items : []).map((item) => ({ ...item }));
  if (!normalized.length) return normalized;
  let catalog = new Map();
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
      imageUrl: cachedImageUrl || sourceImageUrl,
    };
  });
  const missingImages = normalized
    .filter((item) => !normalizeShopeeImageUrl(item.imageUrl))
    .map((item) => warehouseImageCandidate(
      item.sku,
      catalog.get(normalizeWarehouseSku(item.sku)) || item,
    ))
    .filter(Boolean);
  if (!missingImages.length) return enriched;
  try {
    await enqueueWarehouseImageCandidates(env, missingImages);
  } catch (error) {
    console.error("WAREHOUSE_IMAGE_ENQUEUE", error?.message || error);
  }
  return enriched;
}

async function replyWarehouseLocation(event, sku, env, showDetails = false) {
  try {
    const result = await warehouseLocationRequest(env, sku);
    if (!result?.metadata) {
      await replyLine(event.replyToken, "ERP 主倉儲位資料尚未完成第一次同步，請稍後再試。", env);
      return;
    }
    if (showDetails || !result.item) {
      await replyLine(event.replyToken, formatWarehouseLocation(result.item, result.metadata), env);
      return;
    }
    const [item] = await enrichWarehouseSearchItems([result.item], env);
    await replyLine(event.replyToken, [createWarehouseSearchMessage([item], sku, 1)], env);
  } catch (error) {
    console.error("LINE warehouse location error", error?.message || error);
    await replyLine(event.replyToken, `目前無法查詢 ERP 儲位：${error?.message || "請稍後再試"}`, env);
  }
}

async function replyWarehouseSearch(event, keyword, env) {
  try {
    const result = await warehouseSearchRequest(env, keyword);
    if (!result?.metadata) {
      await replyLine(event.replyToken, "ERP 主倉儲位資料尚未完成第一次同步，請稍後再試。", env);
      return;
    }
    if (!Array.isArray(result.items) || !result.items.length) {
      await replyLine(
        event.replyToken,
        `🔎 找不到與「${keyword}」相關的 ERP 商品。\n請改用較短或不同的商品名稱再試一次。`,
        env,
      );
      return;
    }
    const items = await enrichWarehouseSearchItems(result.items, env);
    await replyLine(event.replyToken, [
      createWarehouseSearchMessage(items, keyword, Number(result.totalCount) || items.length),
    ], env);
  } catch (error) {
    console.error("LINE warehouse search error", error?.message || error);
    await replyLine(event.replyToken, `目前無法搜尋 ERP 商品：${error?.message || "請稍後再試"}`, env);
  }
}

async function lineDisplayName(event, env) {
  const source = event?.source || {};
  const userId = String(source.userId || "");
  if (!userId || !env.LINE_CHANNEL_ACCESS_TOKEN) return "群組成員";
  let path = `/v2/bot/profile/${encodeURIComponent(userId)}`;
  if (source.groupId) {
    path = `/v2/bot/group/${encodeURIComponent(source.groupId)}/member/${encodeURIComponent(userId)}`;
  } else if (source.roomId) {
    path = `/v2/bot/room/${encodeURIComponent(source.roomId)}/member/${encodeURIComponent(userId)}`;
  }
  try {
    const response = await fetch(`https://api.line.me${path}`, {
      headers: { "Authorization": `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}` },
    });
    if (!response.ok) return "群組成員";
    const profile = await response.json();
    return String(profile?.displayName || "群組成員").replace(/\s+/g, " ").trim().slice(0, 120) || "群組成員";
  } catch {
    return "群組成員";
  }
}

async function addLineSchedule(event, text, env) {
  const items = scheduleItemsFromText(text);
  if (!items.length) {
    await replyLine(event.replyToken, "請在「廣告影片排程」下方貼上至少一個蝦皮商品連結。", env);
    return;
  }
  const result = await lineScheduleRequest(event, env, "add", {
    items,
    addedAt: Number(event.timestamp) || Date.now(),
    addedBy: event.source?.userId || "",
  });
  const notes = [`📥 已新增 ${result.added?.length || 0} 項廣告影片排程。`];
  if (result.duplicateCount) notes.push(`略過 ${result.duplicateCount} 個重複商品。`);
  if (result.fullCount) notes.push(`另有 ${result.fullCount} 項因待拍清單已滿而未加入。`);
  notes.push(`目前共有 ${result.pendingCount || 0} 項待拍。`, "輸入「要拍什麼」即可查看清單。");
  await replyLine(event.replyToken, notes.join("\n"), env);
}

async function replyLineScheduleList(event, env, completed = false) {
  const result = await lineScheduleRequest(event, env, "list");
  const storedItems = completed ? result.completed || [] : result.pending || [];
  const items = await enrichScheduleItemsWithProfitSkus(storedItems, env);
  const text = completed ? formatCompletedSchedule(items) : formatPendingSchedule(items);
  await replyLine(event.replyToken, splitLineText(text), env);
}

async function generateScheduledLineScript(event, index, env) {
  const selection = await lineScheduleRequest(event, env, "get", { index });
  if (!selection.item) {
    const message = selection.pendingCount
      ? `請輸入 1～${selection.pendingCount} 之間的待拍編號。`
      : "這個聊天室目前沒有待拍項目，請先輸入「要拍什麼」確認清單。";
    await replyLine(event.replyToken, message, env);
    return;
  }

  const userKey = event.source?.userId || lineScheduleScope(event);
  if (!allowRequest(`line:${userKey}`)) {
    await replyLine(event.replyToken, "這個小時產生的腳本較多，請稍後再試。", env);
    return;
  }

  const lock = await acquireLineScheduleGeneration(env);
  if (!lock.acquired) {
    await replyLine(
      event.replyToken,
      `上一支文案正在產生中，請等它回覆後再輸入編號（約 ${lock.retryAfterSeconds || 1} 秒）。`,
      env,
    );
    return;
  }

  try {
    const script = await withAbortTimeout(
      (signal) => generateScript({
        productUrl: selection.item.productUrl,
        productName: selection.item.productName,
        seconds: 40,
        focus: "",
      }, env, { signal }),
      24000,
      "商品內容讀取或 AI 產生時間較長",
    );
    await replyLine(event.replyToken, [
      { type: "text", text: formatLineScript(script) },
      { type: "text", text: `拍攝完成後，請輸入「完成${index}」。`.slice(0, 5000) },
    ], env);
  } catch (error) {
    console.error("LINE scheduled generation error", error?.message || error);
    const retryHint = error?.status === 504
      ? "請等 10 秒後重新輸入同一個編號。"
      : "不需要再貼網址，請稍後重新輸入編號。";
    await replyLine(event.replyToken, `目前無法產生排程腳本：${error?.message || "請稍後再試"}\n${retryHint}`, env);
  } finally {
    await releaseLineScheduleGeneration(env, lock.token);
  }
}

async function completeLineScheduleItem(event, index, env) {
  const selection = await lineScheduleRequest(event, env, "get", { index });
  if (!selection.item) {
    const message = selection.pendingCount
      ? `請輸入 1～${selection.pendingCount} 之間的待拍編號。`
      : "目前沒有待拍項目。";
    await replyLine(event.replyToken, message, env);
    return;
  }

  const completedBy = await lineDisplayName(event, env);
  const result = await lineScheduleRequest(event, env, "complete", {
    productUrl: selection.item.productUrl,
    productName: selection.item.productName,
    completedAt: Date.now(),
    completedBy,
    completedById: event.source?.userId || "",
  });
  const message = result.alreadyCompleted
    ? "ℹ️ 這項排程已由其他員工完成，請輸入「要拍什麼」更新清單。"
    : `✅ 已完成：${result.completed?.productName || selection.item.productName}\n若標錯，輸入「已拍完」查看編號，再輸入「取消完成1」。`;
  await replyLine(event.replyToken, message, env);
}

async function reopenLineScheduleItem(event, index, env) {
  const result = await lineScheduleRequest(event, env, "reopen", { index });
  if (result.full) {
    await replyLine(event.replyToken, "待拍清單已滿，暫時無法取消完成。", env);
    return;
  }
  if (!result.restored) {
    const message = result.completedCount
      ? `請輸入 1～${result.completedCount} 之間的已拍完編號。`
      : "目前沒有可以取消的已拍完項目。";
    await replyLine(event.replyToken, message, env);
    return;
  }
  const note = result.alreadyPending ? "（待拍清單中已經有同一商品，因此沒有重複新增）" : "";
  await replyLine(
    event.replyToken,
    `↩️ 已取消完成：${result.restored.productName}\n商品已回到待拍清單。${note}`,
    env,
  );
}

async function processLineEvent(event, env) {
  if (!event.replyToken) return;

  if (event.type === "postback") {
    const params = new URLSearchParams(event.postback?.data || "");
    const action = params.get("action");
    if (action !== "generate" && action !== "choose_focus") return;
    const productUrl = findShopeeUrl(params.get("url") || "");
    if (!productUrl) {
      await replyLine(event.replyToken, "商品連結已失效，請重新貼上蝦皮商品連結。", env);
      return;
    }
    if (action === "choose_focus") {
      const seconds = Number.parseInt(params.get("seconds"), 10) || 40;
      const title = String(params.get("title") || "蝦皮商品").slice(0, 500);
      await replyLine(event.replyToken, [createLineFocusPanel(productUrl, title, seconds)], env);
      return;
    }
    return generateLineScript(event, {
      productUrl,
      productName: String(params.get("title") || "").slice(0, 500),
      seconds: Number.parseInt(params.get("seconds"), 10) || 40,
      focus: String(params.get("focus") || "").slice(0, 300),
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
    textLength: text.length,
  }));

  if (isScheduleAddCommand(text)) {
    try {
      await addLineSchedule(event, text, env);
    } catch (error) {
      console.error("LINE schedule add error", error?.message || error);
      await replyLine(event.replyToken, `目前無法儲存廣告影片排程：${error?.message || "請稍後再試"}`, env);
    }
    return;
  }

  if (isPendingScheduleCommand(text) || isCompletedScheduleCommand(text)) {
    try {
      await replyLineScheduleList(event, env, isCompletedScheduleCommand(text));
    } catch (error) {
      console.error("LINE schedule list error", error?.message || error);
      await replyLine(event.replyToken, `目前無法讀取廣告影片排程：${error?.message || "請稍後再試"}`, env);
    }
    return;
  }

  const warehouseDetailSku = parseWarehouseLocationDetailCommand(text);
  if (warehouseDetailSku) {
    await replyWarehouseLocation(event, warehouseDetailSku, env, true);
    return;
  }

  const warehouseSku = parseWarehouseLocationCommand(text);
  if (warehouseSku) {
    await replyWarehouseLocation(event, warehouseSku, env);
    return;
  }
  if (/^儲位\s*(?:[+＋:：]\s*)?$/u.test(text)) {
    await replyLine(event.replyToken, "請在『儲位』後面加上貨號或商品關鍵字，例如：儲位 A12345、儲位 洗衣袋", env);
    return;
  }
  if (/^(?:查詢?|搜(?:尋)?)\s*$/u.test(text)) {
    await replyLine(event.replyToken, "請在『查』後面加上商品關鍵字，例如：查 洗衣袋", env);
    return;
  }

  const undoCompletedIndex = parseScheduleUndoCompletion(text);
  if (undoCompletedIndex) {
    try {
      await reopenLineScheduleItem(event, undoCompletedIndex, env);
    } catch (error) {
      console.error("LINE schedule reopen error", error?.message || error);
      await replyLine(event.replyToken, `目前無法取消完成：${error?.message || "請稍後再試"}`, env);
    }
    return;
  }

  const completedIndex = parseScheduleCompletion(text);
  if (completedIndex) {
    try {
      await completeLineScheduleItem(event, completedIndex, env);
    } catch (error) {
      console.error("LINE schedule complete error", error?.message || error);
      await replyLine(event.replyToken, `目前無法完成這筆排程：${error?.message || "請稍後再試"}`, env);
    }
    return;
  }

  const scheduleIndex = parseScheduleSelection(text);
  if (scheduleIndex) {
    try {
      await generateScheduledLineScript(event, scheduleIndex, env);
    } catch (error) {
      console.error("LINE schedule selection error", error?.message || error);
      await replyLine(event.replyToken, `目前無法讀取這筆待拍排程：${error?.message || "請稍後再試"}`, env);
    }
    return;
  }

  const mentionOnly = groupMessage && mentioned && !text;
  if ((isLineHelpCommand(text) && (!groupMessage || mentioned)) || mentionOnly) {
    if (mentionOnly) await armLineGroup(event, env);
    await replyLine(
      event.replyToken,
      [createLineHelpMessage()],
      env,
    );
    return;
  }

  if (isLineScriptPromptCommand(text)) {
    await replyLine(
      event.replyToken,
      "請貼上蝦皮商品連結。收到後會直接產生 40 秒標準版腳本，拍攝重點由 AI 自動判斷。",
      env,
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
          focus: followup.focus,
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
          await replyLine(event.replyToken, "我收到訊息了，但無法辨識其中的蝦皮商品連結。請重新複製完整商品網址再試一次。", env);
        }
        return;
      }
      const armed = await armLineGroup(event, env);
      await replyLine(
        event.replyToken,
        armed ? "已準備好，請在 10 秒內貼上蝦皮商品連結。" : "請直接在同一則訊息中 @我 並貼上蝦皮商品連結。",
        env,
      );
      return;
    }
  }

  if (!productUrl) {
    await replyLine(
      event.replyToken,
      "請貼上蝦皮商品連結。收到後會直接產生 40 秒標準版腳本，拍攝重點由 AI 自動判斷。",
      env,
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

async function generateLineScript(event, input, env) {
  const userKey = event.source?.userId || event.source?.groupId || event.source?.roomId || "unknown";
  if (!allowRequest(`line:${userKey}`)) {
    await replyLine(event.replyToken, "這個小時產生的腳本較多，請稍後再試。", env);
    return;
  }

  try {
    const script = await generateScript(input, env);
    await replyLine(event.replyToken, formatLineScript(script), env);
  } catch (error) {
    console.error("LINE generation error", error?.message || error);
    await replyLine(event.replyToken, `目前無法產生腳本：${error?.message || "請稍後再試"}`, env);
  }
}

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

async function reconcileWarehouseImagesAfterSync(items, env) {
  let catalog;
  try {
    catalog = await profitWarehouseProductMap(env);
  } catch (error) {
    console.error("WAREHOUSE_IMAGE_CATALOG_SYNC", error?.message || error);
    return null;
  }
  const candidatesBySku = new Map();
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
      body: JSON.stringify({ candidates }),
    },
  );
  if (!response.ok) throw new Error(`WAREHOUSE_IMAGE_RECONCILE_HTTP_${response.status}`);
  const result = await response.json();
  console.log("WAREHOUSE_IMAGE_RECONCILE", JSON.stringify(result));
  return result;
}

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
    body: rawBody,
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

async function handleWarehouseImageStatus(request, env) {
  const expected = String(env.ERP_SYNC_TOKEN || "");
  const supplied = String(request.headers.get("X-Erp-Sync-Token") || "");
  if (!expected || supplied !== expected) return new Response("Unauthorized", { status: 401 });
  if (!env.LINE_ACTIVATION) return Response.json({ ok: false, error: "STORAGE_NOT_CONFIGURED" }, { status: 503 });
  return lineScheduleStub(env, globalLineScheduleName).fetch("https://line-schedule/warehouse-images/status", {
    method: "GET",
  });
}

async function serveWarehouseProductImage(request, env, rawSku) {
  const sku = normalizeWarehouseSku(rawSku);
  if (!sku || !env.PRODUCT_IMAGES) return new Response("Not found", { status: 404 });
  const object = await env.PRODUCT_IMAGES.getWithMetadata(warehouseImageObjectKey(sku), {
    type: "arrayBuffer",
    cacheTtl: 3600,
  });
  if (!object?.value) return new Response("Not found", { status: 404 });
  const headers = new Headers({
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  });
  if (object.metadata?.contentType) headers.set("Content-Type", object.metadata.contentType);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "image/jpeg");
  return new Response(request.method === "HEAD" ? null : object.value, { status: 200, headers });
}

export {
  canonicalShopeeUrl,
  createLineFocusPanel,
  createLinePanel,
  createWarehouseSearchMessage,
  extractShopeePageContent,
  enrichScheduleItemsWithProfitSkus,
  fetchShopeePageContent,
  findShopeeUrl,
  findShopeeUrls,
  formatCompletedSchedule,
  formatLineScript,
  formatPendingSchedule,
  isGroupSource,
  isLineHelpCommand,
  isLineScriptPromptCommand,
  isScheduleAddCommand,
  isSelfMentioned,
  lineHelpText,
  createLineHelpMessage,
  lineInput,
  lineActivationKey,
  linePendingKey,
  panelPostback,
  parseLineFollowup,
  parseWarehouseLocationDetailCommand,
  parseWarehouseLocationCommand,
  parseWarehouseSearchCommand,
  parseScheduleCompletion,
  parseScheduleSelection,
  parseScheduleUndoCompletion,
  processLineEvent,
  productTitle,
  profitWarehouseProductMapFromDashboard,
  profitSkuMapFromDashboard,
  removeLineMentions,
  scheduleItemsFromText,
  shopeeProductId,
  splitLineText,
  formatWarehouseLocation,
  warehouseLocationBucket,
  warehouseSearchScore,
  withAbortTimeout,
  armLineGroup,
  takeLineGroupActivation,
  verifyLineSignature,
};

export default {
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
      } catch {}
      return serveWarehouseProductImage(request, env, sku);
    }

    if (url.pathname === "/reader/connect" || url.pathname === "/reader/status") {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
      const path = url.pathname === "/reader/connect" ? "/reader/connect" : "/reader/status";
      return readerBrokerStub(env).fetch(`https://shopee-reader${path}`, request);
    }

    if (url.pathname === "/line/webhook") {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      return handleLineWebhook(request, env, context);
    }

    if (url.pathname === "/erp/locations/push") {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      return handleWarehouseLocationPush(request, env, context);
    }

    if (url.pathname === "/erp/images/status") {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
      return handleWarehouseImageStatus(request, env);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
    if (origin && !allowedOrigins.has(origin)) return json({ error: "不允許的網站來源" }, 403, origin);

    const clientKey = request.headers.get("CF-Connecting-IP") || "local";
    if (!allowRequest(`web:${clientKey}`)) return json({ error: "今日使用次數較多，請稍後再試" }, 429, origin);

    try {
      const script = await generateScript(await request.json(), env);
      return json({ script }, 200, origin);
    } catch (error) {
      return json({ error: error?.message || "無法產生腳本" }, error?.status || 400, origin);
    }
  },
};
