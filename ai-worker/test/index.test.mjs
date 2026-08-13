import assert from "node:assert/strict";
import test from "node:test";
import worker, {
  armLineGroup,
  canonicalShopeeUrl,
  createLineFocusPanel,
  createLinePanel,
  createWarehousePositionDryRunPreview,
  createWarehouseSearchMessage,
  enrichScheduleItemsWithProfitSkus,
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
  LineActivation,
  lineHelpText,
  createLineHelpMessage,
  lineInput,
  lineActivationKey,
  linePendingKey,
  panelPostback,
  parseLineFollowup,
  parseWarehouseLocationDetailCommand,
  parseWarehouseLocationCommand,
  parseWarehousePositionDryRunCommand,
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
  takeLineGroupActivation,
  verifyLineSignature,
  warehouseLocationBucket,
  warehouseSearchScore,
  withAbortTimeout,
} from "../src/index.js";

test("recognizes only G and K SKUs as NAS-local image products", () => {
  assert.equal(isNasLocalImageSku("g041"), true);
  assert.equal(isNasLocalImageSku("Ｋ017"), true);
  assert.equal(isNasLocalImageSku("A235"), false);
  assert.equal(isNasLocalImageSku("G"), false);
});

test("withAbortTimeout stops slow background work before the LINE reply window closes", async () => {
  let aborted = false;
  await assert.rejects(
    withAbortTimeout((signal) => new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => {
        aborted = true;
        reject(signal.reason);
      }, { once: true });
    }), 5, "排程處理逾時"),
    /排程處理逾時/,
  );
  assert.equal(aborted, true);
});

test("findShopeeUrl accepts full and short Shopee URLs", () => {
  assert.equal(findShopeeUrl("幫我做 https://shopee.tw/商品名稱-i.1.2 30 秒"), "https://shopee.tw/%E5%95%86%E5%93%81%E5%90%8D%E7%A8%B1-i.1.2");
  assert.equal(findShopeeUrl("https://s.shopee.tw/AbCd123"), "https://s.shopee.tw/AbCd123");
  assert.equal(findShopeeUrl("https://example.com/item"), "");
});

test("findShopeeUrls extracts and de-duplicates multiple Markdown Shopee links", () => {
  const first = "https://shopee.tw/太陽能階梯燈-i.52793230.27324027032?extra=1";
  const second = "https://shopee.tw/威士忌冰球模具-i.52793230.56665622865?extra=2";
  assert.deepEqual(findShopeeUrls(`廣告影片排程\n[${first}](${first})\n${second}`), [
    new URL(first).toString(),
    new URL(second).toString(),
  ]);
});

test("scheduleItemsFromText stores compact canonical URLs and readable titles", () => {
  assert.deepEqual(
    scheduleItemsFromText("廣告影片排程 https://shopee.tw/太陽能階梯燈-i.52793230.27324027032?extra=1"),
    [{
      productUrl: "https://shopee.tw/product/52793230/27324027032",
      productName: "太陽能階梯燈",
    }],
  );
});

test("schedule commands and numeric selections are recognized", () => {
  assert.equal(isScheduleAddCommand("廣告影片排程 https://shopee.tw/item-i.1.2"), true);
  assert.equal(isScheduleAddCommand("影片排程"), false);
  assert.equal(parseScheduleSelection("1"), 1);
  assert.equal(parseScheduleSelection("100"), 100);
  assert.equal(parseScheduleSelection("２"), 2);
  assert.equal(parseScheduleSelection("0"), null);
  assert.equal(parseScheduleSelection("1號"), null);
  assert.equal(parseScheduleCompletion("完成1"), 1);
  assert.equal(parseScheduleCompletion("完成第 ２ 號"), 2);
  assert.equal(parseScheduleUndoCompletion("取消完成1"), 1);
  assert.equal(parseScheduleUndoCompletion("取消完成第２號"), 2);
});

test("warehouse location command accepts common LINE input forms", () => {
  assert.equal(parseWarehouseLocationCommand("儲位 A12345"), "A12345");
  assert.equal(parseWarehouseLocationCommand("儲位+A12345"), "A12345");
  assert.equal(parseWarehouseLocationCommand("儲位：a-123"), "A-123");
  assert.equal(parseWarehouseLocationCommand("A725"), "A725");
  assert.equal(parseWarehouseLocationCommand("p063"), "P063");
  assert.equal(parseWarehouseLocationCommand("1"), null);
  assert.equal(parseWarehouseLocationCommand("要拍什麼"), null);
  assert.equal(parseWarehouseLocationCommand("儲位"), null);
  assert.equal(parseWarehouseLocationCommand("查儲位 A12345"), null);
  assert.equal(parseWarehouseLocationCommand("儲位 洗衣袋"), null);
  assert.equal(parseWarehouseSearchCommand("洗衣袋"), "洗衣袋");
  assert.equal(parseWarehouseSearchCommand("查 洗衣袋"), "洗衣袋");
  assert.equal(parseWarehouseSearchCommand("襪"), "襪");
  assert.equal(parseWarehouseSearchCommand("搜 襪"), "襪");
  assert.equal(parseWarehouseSearchCommand("儲位：洗衣袋"), "洗衣袋");
  assert.equal(parseWarehouseSearchCommand("A725"), null);
  assert.equal(parseWarehouseLocationDetailCommand("完整儲位 A725"), "A725");
  assert.equal(parseWarehouseLocationDetailCommand("儲位明細：p063"), "P063");
  assert.equal(parseWarehouseLocationDetailCommand("A725"), null);
});

test("warehouse position dry-run command requires a SKU and safe new location", () => {
  assert.deepEqual(parseWarehousePositionDryRunCommand("改儲位 A861 02-R04-01/T3"), {
    sku: "A861",
    newLocation: "02-R04-01/T3",
  });
  assert.deepEqual(parseWarehousePositionDryRunCommand("改儲位 ａ８６１ Ａ區-０１"), {
    sku: "A861",
    newLocation: "A區-01",
  });
  assert.equal(parseWarehousePositionDryRunCommand("改儲位 A861"), null);
  assert.equal(parseWarehousePositionDryRunCommand("改儲位 洗衣袋 A區-01"), null);
  assert.equal(parseWarehousePositionDryRunCommand("改儲位 A861 <script>"), null);
  assert.equal(parseWarehousePositionDryRunCommand("儲位 A861"), null);
});

test("warehouse position dry-run preview fails closed and never claims a write", () => {
  const now = Date.parse("2026-08-13T20:00:00+08:00");
  const metadata = {
    warehouseId: 1,
    warehouseName: "主倉",
    updatedAt: "2026-08-13T19:50:00+08:00",
  };
  const item = {
    sku: "A861",
    name: "測試商品",
    variants: [{ location: "02-R04-01/T4", style: "紅色", size: "大", barcode: "A861-01", available: 12 }],
  };
  const preview = createWarehousePositionDryRunPreview(item, metadata, "02-R04-01/T3", now);
  assert.match(preview, /演練（不會寫入 ERP）/);
  assert.match(preview, /原儲位：02-R04-01\/T4/);
  assert.match(preview, /預計新儲位：02-R04-01\/T3/);
  assert.match(preview, /只允許 DepotPosition 這一個欄位/);
  assert.match(preview, /沒有呼叫 ERP 寫入/);

  const multiple = createWarehousePositionDryRunPreview({
    ...item,
    variants: [item.variants[0], { ...item.variants[0], barcode: "A861-02" }],
  }, metadata, "02-R04-01/T3", now);
  assert.match(multiple, /規格數：2/);
  assert.match(multiple, /演練已停止/);
  assert.match(multiple, /本次沒有寫入 ERP/);

  const stale = createWarehousePositionDryRunPreview(item, {
    ...metadata,
    updatedAt: "2026-08-13T18:00:00+08:00",
  }, "02-R04-01/T3", now);
  assert.match(stale, /快照超過 30 分鐘/);
  assert.match(stale, /本次沒有寫入 ERP/);
});

test("warehouse location formatter shows variants and missing locations", () => {
  const text = formatWarehouseLocation({
    sku: "A12345",
    name: "測試商品",
    available: 8,
    variants: [
      { location: "A區-01", style: "紅色", size: "大", available: 5 },
      { location: "B區-02", style: "藍色", size: "", available: 3 },
    ],
  }, { updatedAt: "2026-08-12T14:30:00+08:00" });
  assert.match(text, /A12345｜測試商品/);
  assert.match(text, /主倉可用庫存：8/);
  assert.match(text, /紅色／大：A區-01/);
  assert.match(text, /更新：2026\/08\/12/);
  assert.match(formatWarehouseLocation({ sku: "B1", name: "無儲位", available: 0, variants: [] }), /尚未設定儲位/);
  assert.equal(warehouseLocationBucket("A12345"), warehouseLocationBucket("A12345"));
});

test("warehouse keyword search ranks matches and builds image cards", () => {
  assert.equal(warehouseSearchScore({ sku: "A1", name: "洗衣袋" }, "洗衣袋"), 1);
  assert.equal(warehouseSearchScore({ sku: "A2", name: "洗衣袋 加厚款" }, "洗衣袋"), 2);
  assert.equal(warehouseSearchScore({ sku: "A3", name: "旅行用細網洗衣袋" }, "洗衣袋"), 3);
  assert.equal(warehouseSearchScore({ sku: "A4", name: "收納袋" }, "洗衣袋"), null);
  const message = createWarehouseSearchMessage([{
    sku: "A725",
    name: "細網洗衣袋",
    available: 12,
    imageUrl: "https://example.com/laundry-bag.jpg",
    productUrl: "https://shopee.tw/product/52793230/123",
    variants: [{ location: "A區-01" }, { location: "B區-02" }],
  }], "洗衣袋", 1);
  assert.equal(message.type, "flex");
  assert.equal(message.contents.contents[0].hero.url, "https://example.com/laundry-bag.jpg");
  assert.equal(message.contents.contents[0].footer.contents[0].action.text, "完整儲位 A725");
  assert.match(message.altText, /找到 1 項/);
});

test("pure-profit products provide Shopee URLs and image URLs for warehouse cards", () => {
  const mapping = profitWarehouseProductMapFromDashboard({
    current: {
      products: [{
        pid: "27127565611",
        skuLabel: "a725",
        image: "tw-11134207-product-image-id",
      }],
    },
  });
  assert.deepEqual(mapping.get("A725"), {
    productId: "27127565611",
    productUrl: "https://shopee.tw/product/52793230/27127565611",
    imageUrl: "https://down-tw.img.susercontent.com/file/tw-11134207-product-image-id",
  });
});

test("schedule list formatters include pending and completed details", () => {
  const pending = formatPendingSchedule([{
    skuLabel: "A725",
    productName: "太陽能階梯燈",
    productUrl: "https://shopee.tw/product/1/2",
  }]);
  assert.match(pending, /待拍廣告影片（共 1 項）/);
  assert.match(pending, /1\. 【A725】太陽能階梯燈/);

  const completed = formatCompletedSchedule([{
    skuLabel: "A725",
    productName: "太陽能階梯燈",
    productUrl: "https://shopee.tw/product/1/2",
    completedAt: Date.UTC(2026, 7, 11, 9, 30),
    completedBy: "小明",
  }]);
  assert.match(completed, /已拍完（共 1 項）/);
  assert.match(completed, /【A725】太陽能階梯燈/);
  assert.match(completed, /拍攝員工：小明/);
  assert.match(completed, /2026\/08\/11/);
});

test("Shopee product IDs map to pure-profit SKU labels", async () => {
  assert.equal(shopeeProductId("https://shopee.tw/product/52793230/27127565611"), "27127565611");
  assert.equal(shopeeProductId("https://shopee.tw/水垢魔力擦-i.52793230.27127565611"), "27127565611");
  const mapping = profitSkuMapFromDashboard({
    current: { products: [{ pid: "27127565611", skuLabel: "A725" }] },
  });
  assert.equal(mapping.get("27127565611"), "A725");

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    assert.equal(String(input), "https://vicchou-profit-analysis.vicchou.chatgpt.site/api/dashboard-data");
    assert.equal(init.headers["OAI-Sites-Authorization"], "Bearer test-bypass");
    return Response.json({ current: { products: [{ pid: "27127565611", skuLabel: "A725" }] } });
  };
  try {
    const [item] = await enrichScheduleItemsWithProfitSkus([{
      productName: "水垢魔力擦",
      productUrl: "https://shopee.tw/product/52793230/27127565611",
    }], { PROFIT_DASHBOARD_BYPASS_TOKEN: "test-bypass" });
    assert.equal(item.skuLabel, "A725");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("splitLineText keeps long schedule lists within LINE message limits", () => {
  const messages = splitLineText(Array.from({ length: 80 }, (_, index) => `${index + 1}. ${"商品".repeat(40)}`).join("\n"));
  assert.ok(messages.length > 1);
  assert.ok(messages.length <= 5);
  assert.ok(messages.every((message) => message.type === "text" && message.text.length <= 4500));
});

test("lineInput extracts duration and focus", () => {
  assert.deepEqual(
    lineInput("https://shopee.tw/item-i.1.2 30 秒 重點拍容量", "https://shopee.tw/item-i.1.2"),
    { productUrl: "https://shopee.tw/item-i.1.2", focus: "重點拍容量", seconds: 30 },
  );
});

test("lineInput defaults a bare product link to 40 seconds with AI-selected focus", () => {
  const productUrl = "https://shopee.tw/item-i.1.2";
  assert.deepEqual(lineInput(productUrl, productUrl), {
    productUrl,
    focus: "",
    seconds: 40,
  });
});

test("processLineEvent generates the default script immediately for a bare product link", async () => {
  const originalFetch = globalThis.fetch;
  const lineRequests = [];
  let openAiPayload = null;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url.startsWith("https://shopee.tw/")) {
      return new Response('<meta property="og:title" content="透明收納袋 | 蝦皮購物"><meta property="og:description" content="透明袋身，方便辨識內容物">');
    }
    if (url === "https://api.openai.com/v1/responses") {
      openAiPayload = JSON.parse(init.body);
      return Response.json({
        output_text: JSON.stringify({
          productName: "透明收納袋",
          totalSeconds: 40,
          direction: "突出最適合畫面呈現的賣點",
          segments: [
            { time: "0-6 秒", title: "開頭", voice: "東西總是找不到嗎？" },
            { time: "6-32 秒", title: "賣點", voice: "透明袋身讓內容物一眼就能辨識。" },
            { time: "32-40 秒", title: "結尾", voice: "現在就把小物整理起來。" },
          ],
        }),
      });
    }
    if (url === "https://api.line.me/v2/bot/message/reply") {
      lineRequests.push(JSON.parse(init.body));
      return new Response("OK");
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    await processLineEvent({
      type: "message",
      replyToken: "reply-token",
      timestamp: Date.now(),
      source: { type: "user", userId: "default-flow-user" },
      message: { type: "text", text: "https://shopee.tw/item-i.1.2" },
    }, {
      OPENAI_API_KEY: "test-key",
      LINE_CHANNEL_ACCESS_TOKEN: "test-line-token",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(lineRequests.length, 1);
  assert.equal(lineRequests[0].messages.length, 1);
  assert.equal(lineRequests[0].messages[0].type, "text");
  assert.match(lineRequests[0].messages[0].text, /40 秒/);
  assert.doesNotMatch(lineRequests[0].messages[0].text, /選擇腳本版本|請回覆：秒數/);
  assert.deepEqual(openAiPayload.reasoning, { effort: "none" });
});

test("LINE schedule selection reuses the stored URL and supports complete plus undo", async () => {
  const originalFetch = globalThis.fetch;
  const lineRequests = [];
  const shopeeRequests = [];
  const scheduleObjects = new Map();
  const scheduleObjectFor = (id) => {
    if (!scheduleObjects.has(id)) {
      const values = new Map();
      scheduleObjects.set(id, new LineActivation({
        storage: {
          async put(key, value) { values.set(key, structuredClone(value)); },
          async get(key) { return values.has(key) ? structuredClone(values.get(key)) : undefined; },
          async delete(key) { values.delete(key); },
        },
      }));
    }
    return scheduleObjects.get(id);
  };
  const env = {
    OPENAI_API_KEY: "test-key",
    LINE_CHANNEL_ACCESS_TOKEN: "test-line-token",
    LINE_ACTIVATION: {
      idFromName(name) { return name; },
      get(id) {
        return {
          fetch(input, init) { return scheduleObjectFor(id).fetch(new Request(input, init)); },
        };
      },
    },
  };

  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url.startsWith("https://shopee.tw/")) {
      shopeeRequests.push(url);
      return new Response('<meta property="og:title" content="太陽能階梯燈 | 蝦皮購物"><meta property="og:description" content="太陽能充電、防水設計、夜間自動感應照明">');
    }
    if (url === "https://api.openai.com/v1/responses") {
      return Response.json({
        output_text: JSON.stringify({
          productName: "太陽能階梯燈",
          totalSeconds: 40,
          direction: "突出免配線與感應照明",
          segments: [
            { time: "0-6 秒", title: "開頭", voice: "夜晚樓梯總是看不清楚嗎？" },
            { time: "6-32 秒", title: "賣點", voice: "太陽能充電搭配夜間感應，戶外照明更方便。" },
            { time: "32-40 秒", title: "結尾", voice: "現在就把階梯照亮。" },
          ],
        }),
      });
    }
    if (url.endsWith("/v2/bot/profile/user-2")) {
      return Response.json({ displayName: "員工小明" });
    }
    if (url === "https://api.line.me/v2/bot/message/reply") {
      lineRequests.push(JSON.parse(init.body));
      return new Response("OK");
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const event = (text, replyToken, userId = "user-2") => ({
    type: "message",
    replyToken,
    timestamp: Date.now(),
    source: { type: "user", userId },
    message: { type: "text", text },
  });

  try {
    await scheduleObjectFor("line-schedule:user-1").fetch(new Request("https://line-schedule/schedule/add", {
      method: "POST",
      body: JSON.stringify({
        items: [{ productUrl: "https://shopee.tw/product/52793230/111", productName: "舊群組排程" }],
      }),
    }));
    await processLineEvent(event(
      "廣告影片排程\nhttps://shopee.tw/太陽能階梯燈-i.52793230.27324027032\nhttps://shopee.tw/威士忌冰球模具-i.52793230.56665622865",
      "add",
      "user-1",
    ), env);
    await processLineEvent(event("要拍什麼", "pending"), env);
    await processLineEvent(event("3", "select"), env);
    await processLineEvent(event("完成3", "complete"), env);
    await processLineEvent(event("已拍完", "completed"), env);
    await processLineEvent(event("取消完成1", "undo"), env);
    await processLineEvent(event("要拍什麼", "pending-again"), env);
    await processLineEvent(event("已拍完", "completed-again"), env);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(lineRequests.length, 8);
  assert.match(lineRequests[0].messages[0].text, /已新增 2 項/);
  assert.match(lineRequests[1].messages[0].text, /1\. 舊群組排程/);
  assert.match(lineRequests[1].messages[0].text, /3\. 威士忌冰球模具/);
  assert.equal(lineRequests[2].messages.length, 2);
  assert.match(lineRequests[2].messages[0].text, /40 秒/);
  assert.match(lineRequests[2].messages[1].text, /完成3/);
  assert.doesNotMatch(lineRequests[2].messages.map((message) => message.text).join("\n"), /再貼.*連結/);
  assert.deepEqual(shopeeRequests, ["https://shopee.tw/product/52793230/56665622865"]);
  assert.match(lineRequests[3].messages[0].text, /已完成：威士忌冰球模具/);
  assert.match(lineRequests[4].messages[0].text, /拍攝員工：員工小明/);
  assert.match(lineRequests[4].messages[0].text, /威士忌冰球模具/);
  assert.doesNotMatch(lineRequests[4].messages[0].text, /太陽能階梯燈/);
  assert.match(lineRequests[5].messages[0].text, /已取消完成：威士忌冰球模具/);
  assert.match(lineRequests[6].messages[0].text, /共 3 項/);
  assert.match(lineRequests[6].messages[0].text, /威士忌冰球模具/);
  assert.match(lineRequests[7].messages[0].text, /還沒有已拍完/);
});

test("productTitle reads the product slug", () => {
  assert.equal(productTitle("https://shopee.tw/透明收納袋-i.1.2"), "透明收納袋");
});

test("productTitle reads seoName from canonical Shopee product URLs", () => {
  assert.equal(
    productTitle("https://shopee.tw/product/52793230/6963552952?seoName=%E5%8F%B0%E7%81%A3%E7%8F%BE%E8%B2%A8%2B%E9%9F%93%E7%B3%BB%E9%AB%AE%E5%9C%8850%E5%85%A5%E8%A3%9D"),
    "韓系髮圈50入裝",
  );
});

test("productTitle removes promotional prefixes before the useful product name", () => {
  assert.equal(
    productTitle("https://shopee.tw/product/52793230/6963552952?seoName=%E5%8F%B0%E7%81%A3%E7%8F%BE%E8%B2%A8%2B%E5%AF%A6%E6%8B%8D%E5%BD%B1%E7%89%87!!!%E3%80%90%E5%B9%B3%E5%9D%87%E4%B8%80%E6%A2%9D0.22%E5%85%83%E3%80%91%E9%9F%93%E7%B3%BB%E9%AB%AE%E5%9C%8850%E5%85%A5%E8%A3%9D%20%E7%BD%90%E8%A3%9D%E9%AB%AE%E5%9C%88"),
    "韓系髮圈50入裝 罐裝髮圈",
  );
});

test("extractShopeePageContent reads the shared-page title and full description", () => {
  const html = `<html><head>
    <meta data-rh="true" property="og:title" content="台灣現貨+實拍影片!!!【優惠】韓系髮圈50入裝 | 蝦皮購物">
    <meta data-rh="true" property="og:description" content="商品材質: 皮筋&#10;商品尺寸: 直徑約4.5cm&amp;寬約0.8cm">
  </head></html>`;
  assert.deepEqual(extractShopeePageContent(html), {
    title: "韓系髮圈50入裝",
    description: "商品材質: 皮筋\n商品尺寸: 直徑約4.5cm&寬約0.8cm",
  });
});

test("fetchShopeePageContent falls back to the authenticated NAS reader", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('{"error":90309999}', { status: 403 });
  const env = {
    LINE_ACTIVATION: {
      idFromName(name) {
        assert.equal(name, "shopee-reader-broker-v1");
        return "reader-id";
      },
      get(id) {
        assert.equal(id, "reader-id");
        return {
          async fetch(_url, init) {
            assert.equal(JSON.parse(init.body).url, "https://shopee.tw/product/1/2");
            return Response.json({
              ok: true,
              product: {
                title: "NAS product title",
                description: "Full authenticated product description",
                source: "authenticated_api",
              },
            });
          },
        };
      },
    },
  };

  try {
    assert.deepEqual(await fetchShopeePageContent("https://shopee.tw/product/1/2", env), {
      title: "NAS product title",
      description: "Full authenticated product description",
      source: "authenticated_api",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("canonicalShopeeUrl compacts a long product URL", () => {
  assert.equal(
    canonicalShopeeUrl("https://shopee.tw/很長的商品名稱-i.52793230.23046723054?extra=1"),
    "https://shopee.tw/product/52793230/23046723054",
  );
});

test("createLinePanel asks for duration before focus", () => {
  const panel = createLinePanel("https://shopee.tw/product/1/2", "透明收納袋");
  assert.equal(panel.type, "flex");
  assert.match(panel.altText, /透明收納袋/);
  const buttons = panel.contents.body.contents.filter((item) => item.type === "button");
  assert.equal(buttons.length, 3);
  assert.equal(buttons[1].action.displayText, "40 秒標準版");
  assert.match(buttons[1].action.data, /action=choose_focus/);
  assert.equal(new URLSearchParams(buttons[1].action.data).get("title"), "透明收納袋");
  assert.ok(buttons.every((button) => button.action.data.length <= 300));
});

test("createLinePanel keeps choose_focus postbacks within LINE's 300 character limit", () => {
  const longTitle = "台灣現貨實拍商品標題與完整規格".repeat(20);
  const longUrl = `https://shopee.tw/${encodeURIComponent(longTitle)}-i.2448089.14963881934?extra=${"x".repeat(250)}`;
  const panel = createLinePanel(longUrl, longTitle);
  const buttons = panel.contents.body.contents.filter((item) => item.type === "button");

  assert.ok(buttons.every((button) => button.action.data.length <= 300));
  assert.ok(buttons.every((button) => new URLSearchParams(button.action.data).get("action") === "choose_focus"));
  assert.ok(buttons.every((button) => new URLSearchParams(button.action.data).get("url") === "https://shopee.tw/product/2448089/14963881934"));
});

test("createLineFocusPanel keeps focus independent from duration", () => {
  const panel = createLineFocusPanel("https://shopee.tw/product/1/2", "透明收納袋", 30);
  const buttons = panel.contents.body.contents.filter((item) => item.type === "button");
  assert.equal(buttons.length, 4);
  assert.equal(buttons[0].action.displayText, "AI 自動選擇重點");
  assert.equal(buttons[1].action.displayText, "重點拍容量");
  assert.doesNotMatch(buttons[1].action.displayText, /秒/);
  const params = new URLSearchParams(buttons[1].action.data);
  assert.equal(params.get("seconds"), "30");
  assert.equal(params.get("focus"), "重點拍容量");
  assert.ok(buttons.every((button) => button.action.data.length <= 300));
});

test("panelPostback preserves a useful part of a long Chinese title within LINE limits", () => {
  const title = "台灣現貨超大容量多功能旅行收納袋防水耐磨手提肩背兩用行李袋".repeat(5);
  const data = panelPostback(
    "https://shopee.tw/product/52793230/3978468386",
    40,
    "重點拍使用方式",
    title,
  );
  const params = new URLSearchParams(data);
  assert.ok(data.length <= 300);
  assert.ok(params.get("title").length > 0);
  assert.ok(title.startsWith(params.get("title")));
});

test("group messages only recognize a mention to this bot", () => {
  assert.equal(isGroupSource({ type: "group" }), true);
  assert.equal(isGroupSource({ type: "room" }), true);
  assert.equal(isGroupSource({ type: "user" }), false);
  assert.equal(isSelfMentioned({ mention: { mentionees: [{ type: "user", isSelf: true }] } }), true);
  assert.equal(isSelfMentioned({ mention: { mentionees: [{ type: "user", isSelf: false }] } }), false);
  assert.equal(isSelfMentioned({}), false);
});

test("LINE help command recognizes simple usage requests", () => {
  assert.equal(isLineHelpCommand("使用方法"), true);
  assert.equal(isLineHelpCommand("如何使用"), true);
  assert.equal(isLineHelpCommand("help"), true);
  assert.equal(isLineHelpCommand("我要買東西"), false);
  const help = lineHelpText();
  for (const command of ["廣告影片排程", "要拍什麼", "完成1", "已拍完", "取消完成1", "直接輸入貨號"]) {
    assert.match(help, new RegExp(command));
  }
  assert.match(help, /不必重貼連結/);
  assert.equal(isLineScriptPromptCommand("產生文案"), true);
  assert.equal(isLineScriptPromptCommand("商品文案"), true);
  assert.equal(isLineScriptPromptCommand("洗衣袋"), false);

  const message = createLineHelpMessage();
  assert.equal(message.type, "text");
  assert.equal(message.quickReply.items.length, 6);
  assert.deepEqual(
    message.quickReply.items.map((item) => item.action.text),
    ["查", "儲位", "要拍什麼", "廣告影片排程", "已拍完", "產生文案"],
  );
});

test("mentioning the helper alone lists every command and keeps the ten-second link window", async () => {
  const originalFetch = globalThis.fetch;
  const replies = [];
  globalThis.fetch = async (input, init = {}) => {
    if (String(input) === "https://api.line.me/v2/bot/message/reply") {
      replies.push(JSON.parse(init.body));
      return new Response("OK");
    }
    throw new Error(`Unexpected fetch: ${input}`);
  };

  const mentionText = "@文案小幫手";
  const event = {
    type: "message",
    replyToken: "help-reply",
    timestamp: 50_000,
    source: { type: "group", groupId: "help-group", userId: "help-user" },
    message: {
      type: "text",
      text: mentionText,
      mention: { mentionees: [{ index: 0, length: mentionText.length, type: "user", isSelf: true }] },
    },
  };

  try {
    await processLineEvent(event, { LINE_CHANNEL_ACCESS_TOKEN: "test-line-token" });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(replies.length, 1);
  assert.match(replies[0].messages[0].text, /文案小幫手指令說明/);
  assert.match(replies[0].messages[0].text, /取消完成1/);
  assert.equal(replies[0].messages[0].quickReply.items.length, 6);
  assert.equal(await takeLineGroupActivation({ ...event, timestamp: 55_000 }, {}), true);
});

test("LINE rich-menu script action asks for a product link instead of searching ERP", async () => {
  const originalFetch = globalThis.fetch;
  const replies = [];
  globalThis.fetch = async (input, init = {}) => {
    if (String(input) === "https://api.line.me/v2/bot/message/reply") {
      replies.push(JSON.parse(init.body));
      return new Response("OK");
    }
    throw new Error(`Unexpected fetch: ${input}`);
  };

  try {
    await processLineEvent({
      type: "message",
      replyToken: "rich-menu-script",
      source: { type: "group", groupId: "menu-group", userId: "menu-user" },
      message: { type: "text", text: "產生文案" },
    }, { LINE_CHANNEL_ACCESS_TOKEN: "test-line-token" });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(replies.length, 1);
  assert.match(replies[0].messages[0].text, /請貼上蝦皮商品連結/);
});

test("removeLineMentions keeps the product link and user instructions", () => {
  const text = "@廣告文案小幫手 https://shopee.tw/item-i.1.2 30 秒";
  assert.equal(
    removeLineMentions(text, { mentionees: [{ index: 0, length: 9, type: "user", isSelf: true }] }),
    "https://shopee.tw/item-i.1.2 30 秒",
  );
});

test("parseLineFollowup accepts seconds with an optional focus", () => {
  assert.deepEqual(parseLineFollowup("30"), { seconds: 30, focus: "" });
  assert.deepEqual(parseLineFollowup("30 秒"), { seconds: 30, focus: "" });
  assert.deepEqual(parseLineFollowup("30；容量"), { seconds: 30, focus: "容量" });
  assert.deepEqual(parseLineFollowup("40 重點拍材質"), { seconds: 40, focus: "重點拍材質" });
  assert.equal(parseLineFollowup("5"), null);
  assert.equal(parseLineFollowup("你好"), null);
});

test("linePendingKey separates users inside the same group", () => {
  assert.equal(
    linePendingKey({ source: { type: "group", groupId: "group-1", userId: "user-1" } }),
    "line-pending:group-1:user-1",
  );
  assert.equal(
    linePendingKey({ source: { type: "group", groupId: "group-1", userId: "user-2" } }),
    "line-pending:group-1:user-2",
  );
});

test("group activation applies to the whole group for ten seconds", async () => {
  const values = new Map();
  const env = {
    LINE_PENDING: {
      async put(key, value) { values.set(key, value); },
      async get(key) { return values.has(key) ? JSON.parse(values.get(key)) : null; },
      async delete(key) { values.delete(key); },
    },
  };
  const mention = { source: { type: "group", groupId: "g1", userId: "u1" }, timestamp: 10000 };
  assert.equal(lineActivationKey(mention), "line-armed:g1");
  assert.equal(await armLineGroup(mention, env), true);
  values.clear(); // The immediate in-memory path must work even before KV is consistent.
  assert.equal(await takeLineGroupActivation({ ...mention, timestamp: 19999 }, env), true);

  await armLineGroup(mention, env);
  assert.equal(await takeLineGroupActivation({ ...mention, timestamp: 20001 }, env), false);

  await armLineGroup(mention, env);
  assert.equal(await takeLineGroupActivation({ ...mention, source: { ...mention.source, userId: "u2" }, timestamp: 12000 }, env), true);
});

test("LineActivation provides strongly consistent one-time activation", async () => {
  const values = new Map();
  const object = new LineActivation({
    storage: {
      async put(key, value) { values.set(key, value); },
      async get(key) { return values.get(key); },
      async delete(key) { values.delete(key); },
    },
  });
  let response = await object.fetch(new Request("https://line-activation/arm", {
    method: "POST",
    body: JSON.stringify({ armedAt: 10000 }),
  }));
  assert.equal((await response.json()).armed, true);
  response = await object.fetch(new Request("https://line-activation/take", {
    method: "POST",
    body: JSON.stringify({ now: 19999 }),
  }));
  assert.equal((await response.json()).valid, true);
  response = await object.fetch(new Request("https://line-activation/take", {
    method: "POST",
    body: JSON.stringify({ now: 20000 }),
  }));
  assert.equal((await response.json()).valid, false);
});

test("LineActivation stores pending schedules and keeps completed history", async () => {
  const values = new Map();
  const object = new LineActivation({
    storage: {
      async put(key, value) { values.set(key, structuredClone(value)); },
      async get(key) { return values.has(key) ? structuredClone(values.get(key)) : undefined; },
      async delete(key) { values.delete(key); },
    },
  });

  let response = await object.fetch(new Request("https://line-schedule/schedule/add", {
    method: "POST",
    body: JSON.stringify({
      addedAt: 1000,
      items: [
        { productUrl: "https://shopee.tw/product/1/2", productName: "商品 A" },
        { productUrl: "https://shopee.tw/product/1/3", productName: "商品 B" },
        { productUrl: "https://shopee.tw/product/1/2", productName: "商品 A" },
      ],
    }),
  }));
  let data = await response.json();
  assert.equal(data.added.length, 2);
  assert.equal(data.duplicateCount, 1);
  assert.equal(data.pendingCount, 2);

  response = await object.fetch(new Request("https://line-schedule/schedule/get", {
    method: "POST",
    body: JSON.stringify({ index: 1 }),
  }));
  data = await response.json();
  assert.equal(data.item.productName, "商品 A");

  response = await object.fetch(new Request("https://line-schedule/schedule/generation-acquire", {
    method: "POST",
    body: JSON.stringify({ ttlMs: 30000 }),
  }));
  const firstLock = await response.json();
  assert.equal(firstLock.acquired, true);
  assert.ok(firstLock.token);

  response = await object.fetch(new Request("https://line-schedule/schedule/generation-acquire", {
    method: "POST",
    body: JSON.stringify({ ttlMs: 30000 }),
  }));
  assert.equal((await response.json()).acquired, false);

  response = await object.fetch(new Request("https://line-schedule/schedule/generation-release", {
    method: "POST",
    body: JSON.stringify({ token: firstLock.token }),
  }));
  assert.equal((await response.json()).released, true);

  response = await object.fetch(new Request("https://line-schedule/schedule/generation-acquire", {
    method: "POST",
    body: JSON.stringify({ ttlMs: 30000 }),
  }));
  assert.equal((await response.json()).acquired, true);

  response = await object.fetch(new Request("https://line-schedule/schedule/complete", {
    method: "POST",
    body: JSON.stringify({
      productUrl: "https://shopee.tw/product/1/2",
      productName: "商品 A 完整名稱",
      completedAt: 2000,
      completedBy: "小明",
      completedById: "u1",
    }),
  }));
  data = await response.json();
  assert.equal(data.pendingCount, 1);
  assert.equal(data.completed.completedBy, "小明");

  response = await object.fetch(new Request("https://line-schedule/schedule/list", { method: "POST" }));
  data = await response.json();
  assert.deepEqual(data.pending.map((item) => item.productName), ["商品 B"]);
  assert.deepEqual(data.completed.map((item) => item.productName), ["商品 A 完整名稱"]);

  response = await object.fetch(new Request("https://line-schedule/schedule/reopen", {
    method: "POST",
    body: JSON.stringify({ index: 1 }),
  }));
  data = await response.json();
  assert.equal(data.restored.productName, "商品 A 完整名稱");
  assert.equal(data.pendingCount, 2);
  assert.equal(data.completedCount, 0);

  response = await object.fetch(new Request("https://line-schedule/schedule/list", { method: "POST" }));
  data = await response.json();
  assert.deepEqual(data.pending.map((item) => item.productName), ["商品 B", "商品 A 完整名稱"]);
  assert.deepEqual(data.completed, []);
});

test("LineActivation atomically publishes and queries ERP warehouse locations", async () => {
  const values = new Map();
  const object = new LineActivation({
    storage: {
      async put(key, value) { values.set(key, structuredClone(value)); },
      async get(key) { return values.has(key) ? structuredClone(values.get(key)) : undefined; },
      async delete(key) { values.delete(key); },
    },
  });

  let response = await object.fetch(new Request("https://line-schedule/warehouse-locations/sync", {
    method: "POST",
    body: JSON.stringify({
      updatedAt: "2026-08-12T14:30:00+08:00",
      warehouseId: 1,
      warehouseName: "主倉",
      items: [{
        sku: "a12345",
        name: "測試商品",
        available: 8,
        variants: [{ location: "A區-01", style: "紅色", size: "大", barcode: "4711", available: 8 }],
      }],
    }),
  }));
  let data = await response.json();
  assert.equal(data.ok, true);
  assert.equal(data.itemCount, 1);

  response = await object.fetch(new Request("https://line-schedule/warehouse-locations/query", {
    method: "POST",
    body: JSON.stringify({ sku: "A12345" }),
  }));
  data = await response.json();
  assert.equal(data.item.sku, "A12345");
  assert.equal(data.item.variants[0].location, "A區-01");
  assert.equal(data.metadata.warehouseName, "主倉");

  response = await object.fetch(new Request("https://line-schedule/warehouse-locations/search", {
    method: "POST",
    body: JSON.stringify({ keyword: "測試商品" }),
  }));
  data = await response.json();
  assert.equal(data.totalCount, 1);
  assert.equal(data.items[0].sku, "A12345");
  assert.equal(data.items[0].variants[0].location, "A區-01");

  response = await object.fetch(new Request("https://line-schedule/warehouse-locations/search", {
    method: "POST",
    body: JSON.stringify({ keyword: "測" }),
  }));
  data = await response.json();
  assert.equal(data.totalCount, 1);
  assert.equal(data.items[0].sku, "A12345");

  response = await object.fetch(new Request("https://line-schedule/warehouse-locations/sync", {
    method: "POST",
    body: JSON.stringify({ items: [] }),
  }));
  assert.equal(response.status, 400);
  response = await object.fetch(new Request("https://line-schedule/warehouse-locations/query", {
    method: "POST",
    body: JSON.stringify({ sku: "A12345" }),
  }));
  data = await response.json();
  assert.equal(data.item.name, "測試商品");
});

test("warehouse image cache downloads only one product per alarm and persists the LINE image", async () => {
  const originalFetch = globalThis.fetch;
  const values = new Map();
  let alarmAt = null;
  let imageRequests = 0;
  let inFlight = 0;
  let maxInFlight = 0;
  const storedImages = new Map();
  const productImages = {
    async put(key, value, options) {
      storedImages.set(key, { value: value.slice(0), options: structuredClone(options) });
    },
    async getWithMetadata(key) {
      const stored = storedImages.get(key);
      return stored ? { value: stored.value, metadata: stored.options.metadata } : { value: null, metadata: null };
    },
  };
  const object = new LineActivation({
    storage: {
      async put(key, value) { values.set(key, structuredClone(value)); },
      async get(key) { return values.has(key) ? structuredClone(values.get(key)) : undefined; },
      async delete(key) { values.delete(key); },
      async setAlarm(value) { alarmAt = Number(value); },
      async getAlarm() { return alarmAt; },
    },
  }, {
    PRODUCT_IMAGES: productImages,
  });

  await object.fetch(new Request("https://line-schedule/warehouse-locations/sync", {
    method: "POST",
    body: JSON.stringify({
      items: [
        { sku: "A100", name: "商品一", available: 1, variants: [] },
        { sku: "A200", name: "商品二", available: 2, variants: [] },
      ],
    }),
  }));
  const reconcile = await object.fetch(new Request("https://line-schedule/warehouse-images/reconcile", {
    method: "POST",
    body: JSON.stringify({
      candidates: [
        {
          sku: "A100",
          productUrl: "https://shopee.tw/product/52793230/100",
          sourceImageUrl: "https://img.example.com/100.jpg",
        },
        {
          sku: "A200",
          productUrl: "https://shopee.tw/product/52793230/200",
          sourceImageUrl: "https://img.example.com/200.jpg",
        },
      ],
    }),
  }));
  assert.equal((await reconcile.json()).queued, 2);
  assert.ok(alarmAt > Date.now());
  assert.equal(imageRequests, 0, "sync should enqueue without downloading immediately");

  globalThis.fetch = async (input) => {
    imageRequests += 1;
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await Promise.resolve();
    inFlight -= 1;
    return new Response(new Uint8Array([1, 2, 3]), {
      headers: { "Content-Type": "image/jpeg", "Content-Length": "3" },
    });
  };
  try {
    await object.alarm();
    assert.equal(imageRequests, 1);
    assert.equal(storedImages.size, 1);

    let response = await object.fetch(new Request("https://line-schedule/warehouse-locations/search", {
      method: "POST",
      body: JSON.stringify({ keyword: "商品一" }),
    }));
    let data = await response.json();
    assert.match(data.items[0].imageUrl, /\/product-images\/A100\?v=/);

    response = await object.fetch(new Request("https://line-schedule/warehouse-locations/query", {
      method: "POST",
      body: JSON.stringify({ sku: "A100" }),
    }));
    data = await response.json();
    assert.match(data.item.imageUrl, /\/product-images\/A100\?v=/);

    await object.alarm();
    assert.equal(imageRequests, 2);
    assert.equal(storedImages.size, 2);
    assert.equal(maxInFlight, 1);

    response = await object.fetch(new Request("https://line-schedule/warehouse-images/status", { method: "GET" }));
    data = await response.json();
    assert.equal(data.queue.nextIndex, 2);
    assert.equal(data.queue.cachedCount, 2);
    assert.equal(data.rate.attempts, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("authenticated NAS image upload stores and indexes a public G/K product image", async () => {
  const storedImages = new Map();
  const values = new Map();
  const productImages = {
    async put(key, value, options) {
      storedImages.set(key, { value: value.slice(0), metadata: structuredClone(options.metadata) });
    },
    async getWithMetadata(key) {
      const stored = storedImages.get(key);
      return stored ? { value: stored.value, metadata: stored.metadata } : { value: null, metadata: null };
    },
  };
  const activation = new LineActivation({
    storage: {
      async put(key, value) { values.set(key, structuredClone(value)); },
      async get(key) { return values.has(key) ? structuredClone(values.get(key)) : undefined; },
      async delete(key) { values.delete(key); },
    },
  }, { PRODUCT_IMAGES: productImages });
  await activation.fetch(new Request("https://line-schedule/warehouse-locations/sync", {
    method: "POST",
    body: JSON.stringify({ items: [{ sku: "G041", name: "爆米花吊飾", available: 3, variants: [] }] }),
  }));
  const env = {
    SHOPEE_READER_TOKEN: "reader-secret",
    LINE_ACTIVATION: {
      idFromName(name) { return name; },
      get() {
        return { fetch(input, init) { return activation.fetch(new Request(input, init)); } };
      },
    },
    PRODUCT_IMAGES: productImages,
  };
  let response = await worker.fetch(new Request("https://worker.example/reader/images/G041", {
    method: "POST",
    headers: { "Content-Type": "image/jpeg" },
    body: new Uint8Array([1, 2, 3]),
  }), env, {});
  assert.equal(response.status, 401);

  response = await worker.fetch(new Request("https://worker.example/reader/images/G041", {
    method: "POST",
    headers: {
      Authorization: "Bearer reader-secret",
      "Content-Type": "image/jpeg",
      "X-Nas-Image-File": encodeURIComponent("01.jpg"),
      "X-Nas-Image-Folder": encodeURIComponent("G041爆米花吊飾"),
      "X-Nas-Image-Width": "1200",
      "X-Nas-Image-Height": "1200",
    },
    body: new Uint8Array([1, 2, 3]),
  }), env, {});
  assert.equal(response.status, 200);
  const uploaded = await response.json();
  assert.equal(uploaded.sku, "G041");
  assert.match(uploaded.imageUrl, /\/product-images\/G041\?v=/);
  assert.equal(storedImages.get("warehouse/G041").metadata.source, "nas");
  assert.equal(storedImages.get("warehouse/G041").metadata.candidateCount, "0");

  response = await activation.fetch(new Request("https://line-schedule/warehouse-locations/query", {
    method: "POST",
    body: JSON.stringify({ sku: "G041" }),
  }));
  let queried = await response.json();
  assert.match(queried.item.imageUrl, /\/product-images\/G041\?v=/);

  response = await worker.fetch(new Request(uploaded.imageUrl), env, {});
  assert.equal(response.status, 200);
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3]);

  values.clear();
  await activation.fetch(new Request("https://line-schedule/warehouse-locations/sync", {
    method: "POST",
    body: JSON.stringify({ items: [{ sku: "G041", name: "爆米花吊飾", available: 3, variants: [] }] }),
  }));
  response = await activation.fetch(new Request("https://line-schedule/warehouse-locations/query", {
    method: "POST",
    body: JSON.stringify({ sku: "G041" }),
  }));
  queried = await response.json();
  assert.match(queried.item.imageUrl, /\/product-images\/G041\?v=/, "query should repair a missing index from PRODUCT_IMAGES");
});

test("LineActivation asks the NAS reader for a local image and caches its record", async () => {
  const values = new Map();
  const object = new LineActivation({
    storage: {
      async put(key, value) { values.set(key, structuredClone(value)); },
      async get(key) { return values.has(key) ? structuredClone(values.get(key)) : undefined; },
      async delete(key) { values.delete(key); },
    },
  });
  const originalWebSocket = globalThis.WebSocket;
  if (!globalThis.WebSocket) globalThis.WebSocket = { OPEN: 1 };
  object.readerSocket = {
    readyState: globalThis.WebSocket.OPEN,
    send(raw) {
      const job = JSON.parse(raw);
      assert.equal(job.type, "local-image");
      assert.equal(job.sku, "K017");
      queueMicrotask(() => object.handleReaderMessage({
        data: JSON.stringify({
          id: job.id,
          ok: true,
          image: {
            imageUrl: "https://shopee-video-script-ai.jachou123-afk.workers.dev/product-images/K017?v=123",
            cachedAt: 123,
            contentType: "image/jpeg",
            fileName: "01.jpg",
            folderName: "K017鴻圖大展吊飾",
            candidateCount: 8,
            score: 900,
          },
        }),
      }));
    },
  };
  try {
    const response = await object.fetch(new Request("https://line-schedule/warehouse-images/cache-nas", {
      method: "POST",
      body: JSON.stringify({ sku: "k017" }),
    }));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.item.sku, "K017");
    assert.equal(data.item.source, "nas");
    assert.equal(data.item.fileName, "01.jpg");
    assert.equal(data.item.candidateCount, 8);
  } finally {
    if (originalWebSocket) globalThis.WebSocket = originalWebSocket;
    else delete globalThis.WebSocket;
  }
});

test("an exact G045 query routes local-image work through the reader broker and indexes the result globally", async () => {
  const scheduleValues = new Map();
  const readerValues = new Map();
  const storage = (values) => ({
    async put(key, value) { values.set(key, structuredClone(value)); },
    async get(key) { return values.has(key) ? structuredClone(values.get(key)) : undefined; },
    async delete(key) { values.delete(key); },
  });
  const schedule = new LineActivation({ storage: storage(scheduleValues) });
  const reader = new LineActivation({ storage: storage(readerValues) });
  await schedule.fetch(new Request("https://line-schedule/warehouse-locations/sync", {
    method: "POST",
    body: JSON.stringify({
      items: [{
        sku: "G045",
        name: "重機吊飾+掛繩",
        available: 5,
        variants: [{ location: "G區-45", available: 5 }],
      }],
    }),
  }));

  const originalFetch = globalThis.fetch;
  const originalWebSocket = globalThis.WebSocket;
  if (!globalThis.WebSocket) globalThis.WebSocket = { OPEN: 1 };
  let readerJobs = 0;
  reader.readerSocket = {
    readyState: globalThis.WebSocket.OPEN,
    send(raw) {
      const job = JSON.parse(raw);
      readerJobs += 1;
      assert.equal(job.type, "local-image");
      assert.equal(job.sku, "G045");
      queueMicrotask(() => reader.handleReaderMessage({
        data: JSON.stringify({
          id: job.id,
          ok: true,
          image: {
            sku: "G045",
            imageUrl: "https://shopee-video-script-ai.jachou123-afk.workers.dev/product-images/G045?v=456",
            cachedAt: 456,
            contentType: "image/jpeg",
            fileName: "6.jpg",
            folderName: "G045重機吊飾+掛繩",
            candidateCount: 5,
            score: 700,
          },
        }),
      }));
    },
  };

  const replies = [];
  globalThis.fetch = async (input, init = {}) => {
    if (String(input) === "https://api.line.me/v2/bot/message/reply") {
      replies.push(JSON.parse(init.body));
      return new Response("OK");
    }
    throw new Error(`Unexpected fetch: ${input}`);
  };
  const requestedNames = [];
  const env = {
    LINE_CHANNEL_ACCESS_TOKEN: "test-token",
    LINE_ACTIVATION: {
      idFromName(name) {
        requestedNames.push(name);
        return name;
      },
      get(id) {
        const target = id === "shopee-reader-broker-v1" ? reader : schedule;
        return { fetch(input, init) { return target.fetch(new Request(input, init)); } };
      },
    },
  };

  try {
    await processLineEvent({
      type: "message",
      replyToken: "g045-query",
      timestamp: Date.now(),
      source: { type: "group", groupId: "g1", userId: "u1" },
      message: { type: "text", text: "G045" },
    }, env);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWebSocket) globalThis.WebSocket = originalWebSocket;
    else delete globalThis.WebSocket;
  }

  assert.equal(readerJobs, 1);
  assert.ok(requestedNames.includes("shopee-reader-broker-v1"));
  assert.equal(replies.length, 1);
  assert.match(JSON.stringify(replies[0]), /product-images\/G045\?v=456/);

  const cachedResponse = await schedule.fetch(new Request("https://line-schedule/warehouse-locations/query", {
    method: "POST",
    body: JSON.stringify({ sku: "G045" }),
  }));
  const cached = await cachedResponse.json();
  assert.match(cached.item.imageUrl, /product-images\/G045\?v=456/);
});

test("authenticated G/K precache runs one NAS image job at a time and skips non-local SKUs", async () => {
  const scheduleValues = new Map();
  const readerValues = new Map();
  let alarmAt = null;
  const storage = (values, withAlarm = false) => ({
    async put(key, value) { values.set(key, structuredClone(value)); },
    async get(key) { return values.has(key) ? structuredClone(values.get(key)) : undefined; },
    async delete(key) { values.delete(key); },
    ...(withAlarm ? {
      async setAlarm(value) { alarmAt = Number(value); },
      async getAlarm() { return alarmAt; },
    } : {}),
  });
  const schedule = new LineActivation({ storage: storage(scheduleValues) });
  const reader = new LineActivation({ storage: storage(readerValues, true) });
  await schedule.fetch(new Request("https://line-schedule/warehouse-locations/sync", {
    method: "POST",
    body: JSON.stringify({
      items: [
        { sku: "K017", name: "K product", available: 1, variants: [] },
        { sku: "A235", name: "Shopee product", available: 1, variants: [] },
        { sku: "G045", name: "G product", available: 1, variants: [] },
      ],
    }),
  }));

  const originalWebSocket = globalThis.WebSocket;
  if (!globalThis.WebSocket) globalThis.WebSocket = { OPEN: 1 };
  const jobs = [];
  reader.readerSocket = {
    readyState: globalThis.WebSocket.OPEN,
    send(raw) {
      const job = JSON.parse(raw);
      jobs.push(job.sku);
      queueMicrotask(() => reader.handleReaderMessage({
        data: JSON.stringify({
          id: job.id,
          ok: true,
          image: {
            sku: job.sku,
            imageUrl: `https://shopee-video-script-ai.jachou123-afk.workers.dev/product-images/${job.sku}?v=${jobs.length}`,
            cachedAt: jobs.length,
            contentType: "image/jpeg",
            fileName: "1.jpg",
            folderName: `${job.sku} product`,
          },
        }),
      }));
    },
  };
  const env = {
    SHOPEE_READER_TOKEN: "reader-secret",
    LINE_ACTIVATION: {
      idFromName(name) { return name; },
      get(id) {
        const target = id === "shopee-reader-broker-v1" ? reader : schedule;
        return { fetch(input, init) { return target.fetch(new Request(input, init)); } };
      },
    },
  };

  try {
    let response = await worker.fetch(new Request("https://worker.example/reader/precache", {
      method: "POST",
      headers: { Authorization: "Bearer reader-secret", "Content-Type": "application/json" },
      body: "{}",
    }), env, {});
    assert.equal(response.status, 200);
    let data = await response.json();
    assert.equal(data.queued, 2);
    assert.ok(alarmAt > Date.now());
    assert.deepEqual(jobs, []);

    await reader.alarm();
    assert.deepEqual(jobs, ["G045"]);
    await reader.alarm();
    assert.deepEqual(jobs, ["G045", "K017"]);

    response = await worker.fetch(new Request("https://worker.example/reader/precache", {
      method: "GET",
      headers: { Authorization: "Bearer reader-secret" },
    }), env, {});
    data = await response.json();
    assert.equal(data.queue.itemCount, 2);
    assert.equal(data.queue.nextIndex, 2);
    assert.equal(data.queue.cachedCount, 2);
    assert.ok(data.queue.completedAt);
  } finally {
    if (originalWebSocket) globalThis.WebSocket = originalWebSocket;
    else delete globalThis.WebSocket;
  }
});

test("group users can query a warehouse location without mentioning the bot", async () => {
  const originalFetch = globalThis.fetch;
  const values = new Map();
  const object = new LineActivation({
    storage: {
      async put(key, value) { values.set(key, structuredClone(value)); },
      async get(key) { return values.has(key) ? structuredClone(values.get(key)) : undefined; },
      async delete(key) { values.delete(key); },
    },
  });
  await object.fetch(new Request("https://line-schedule/warehouse-locations/sync", {
    method: "POST",
    body: JSON.stringify({
      updatedAt: "2026-08-12T14:30:00+08:00",
      items: [{
        sku: "A12345",
        name: "測試商品",
        available: 8,
        variants: [{ location: "A區-01", style: "", size: "", available: 8 }],
      }],
    }),
  }));
  const replies = [];
  globalThis.fetch = async (input, init = {}) => {
    if (String(input) === "https://api.line.me/v2/bot/message/reply") {
      replies.push(JSON.parse(init.body));
      return new Response("OK");
    }
    throw new Error(`Unexpected fetch: ${input}`);
  };
  const env = {
    LINE_CHANNEL_ACCESS_TOKEN: "test-token",
    LINE_ACTIVATION: {
      idFromName(name) { return name; },
      get() {
        return { fetch(input, init) { return object.fetch(new Request(input, init)); } };
      },
    },
  };
  try {
    await processLineEvent({
      type: "message",
      replyToken: "warehouse-query",
      timestamp: Date.now(),
      source: { type: "group", groupId: "g1", userId: "u1" },
      message: { type: "text", text: "A12345" },
    }, env);
    await processLineEvent({
      type: "message",
      replyToken: "warehouse-details",
      timestamp: Date.now(),
      source: { type: "group", groupId: "g1", userId: "u1" },
      message: { type: "text", text: "完整儲位 A12345" },
    }, env);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(replies.length, 2);
  assert.equal(replies[0].messages[0].type, "flex");
  assert.match(replies[0].messages[0].altText, /A12345.*找到 1 項/);
  assert.equal(replies[0].messages[0].contents.contents[0].footer.contents[0].action.text, "完整儲位 A12345");
  assert.match(replies[1].messages[0].text, /A12345｜測試商品/);
  assert.match(replies[1].messages[0].text, /A區-01/);
});

test("warehouse position dry run is private, account-bound, and read-only", async () => {
  const originalFetch = globalThis.fetch;
  const values = new Map();
  const object = new LineActivation({
    storage: {
      async put(key, value) { values.set(key, structuredClone(value)); },
      async get(key) { return values.has(key) ? structuredClone(values.get(key)) : undefined; },
      async delete(key) { values.delete(key); },
    },
  });
  await object.fetch(new Request("https://line-schedule/warehouse-locations/sync", {
    method: "POST",
    body: JSON.stringify({
      updatedAt: new Date().toISOString(),
      warehouseId: 1,
      warehouseName: "主倉",
      items: [{
        sku: "A861",
        name: "測試商品",
        available: 12,
        variants: [{ location: "02-R04-01/T4", style: "紅色", size: "大", barcode: "A861-01", available: 12 }],
      }],
    }),
  }));
  const before = structuredClone([...values.entries()]);
  const replies = [];
  let botInfoRequests = 0;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url === "https://api.line.me/v2/bot/info") {
      botInfoRequests += 1;
      assert.equal(init.headers.Authorization, "Bearer dry-run-line-token");
      return Response.json({ basicId: "@059hdfyo", displayName: "廣告文案小幫手" });
    }
    if (url === "https://api.line.me/v2/bot/message/reply") {
      replies.push(JSON.parse(init.body));
      return new Response("OK");
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  const env = {
    LINE_CHANNEL_ACCESS_TOKEN: "dry-run-line-token",
    LINE_ACTIVATION: {
      idFromName(name) { return name; },
      get() { return { fetch(input, init) { return object.fetch(new Request(input, init)); } }; },
    },
  };
  try {
    await processLineEvent({
      type: "message",
      replyToken: "dry-run-private",
      timestamp: Date.now(),
      source: { type: "user", userId: "owner-user" },
      message: { type: "text", text: "改儲位 A861 02-R04-01/T3" },
    }, env);
    await processLineEvent({
      type: "message",
      replyToken: "dry-run-group",
      timestamp: Date.now(),
      source: { type: "group", groupId: "g1", userId: "owner-user" },
      message: { type: "text", text: "改儲位 A861 02-R04-01/T3" },
    }, env);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(botInfoRequests, 1);
  assert.equal(replies.length, 2);
  assert.match(replies[0].messages[0].text, /儲位修改演練（不會寫入 ERP）/);
  assert.match(replies[0].messages[0].text, /原儲位：02-R04-01\/T4/);
  assert.match(replies[0].messages[0].text, /預計新儲位：02-R04-01\/T3/);
  assert.match(replies[1].messages[0].text, /只能在 @059hdfyo 私訊中使用/);
  assert.deepEqual([...values.entries()], before, "dry run must not change Durable Object storage");
});

test("warehouse position dry run refuses a different LINE official account", async () => {
  const originalFetch = globalThis.fetch;
  const replies = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url === "https://api.line.me/v2/bot/info") {
      return Response.json({ basicId: "@037vajci", displayName: "另一個帳號" });
    }
    if (url === "https://api.line.me/v2/bot/message/reply") {
      replies.push(JSON.parse(init.body));
      return new Response("OK");
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  try {
    await processLineEvent({
      type: "message",
      replyToken: "wrong-account",
      timestamp: Date.now(),
      source: { type: "user", userId: "owner-user" },
      message: { type: "text", text: "改儲位 A861 A區-01" },
    }, {
      LINE_CHANNEL_ACCESS_TOKEN: "wrong-account-token",
      LINE_ACTIVATION: {
        idFromName(name) { return name; },
        get() { throw new Error("warehouse lookup must not run for the wrong account"); },
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(replies.length, 1);
  assert.match(replies[0].messages[0].text, /目前 LINE 官方帳號不是 @059hdfyo/);
  assert.match(replies[0].messages[0].text, /本次沒有寫入 ERP/);
});

test("group users can search warehouse products by a bare keyword without mentioning the bot", async () => {
  const originalFetch = globalThis.fetch;
  const values = new Map();
  const object = new LineActivation({
    storage: {
      async put(key, value) { values.set(key, structuredClone(value)); },
      async get(key) { return values.has(key) ? structuredClone(values.get(key)) : undefined; },
      async delete(key) { values.delete(key); },
    },
  });
  await object.fetch(new Request("https://line-schedule/warehouse-locations/sync", {
    method: "POST",
    body: JSON.stringify({
      updatedAt: "2026-08-13T09:00:00+08:00",
      items: [
        {
          sku: "A100",
          name: "細網洗衣袋",
          available: 8,
          variants: [{ location: "A區-01", available: 8 }],
        },
        { sku: "B200", name: "收納盒", available: 3, variants: [] },
      ],
    }),
  }));
  const replies = [];
  globalThis.fetch = async (input, init = {}) => {
    if (String(input) === "https://vicchou-profit-analysis.vicchou.chatgpt.site/api/dashboard-data") {
      assert.equal(init.headers["OAI-Sites-Authorization"], "Bearer warehouse-card-bypass");
      return Response.json({
        current: {
          products: [{
            pid: "100",
            skuLabel: "A100",
            image: "tw-11134207-laundry-bag-image",
          }],
        },
      });
    }
    if (String(input) === "https://api.line.me/v2/bot/message/reply") {
      replies.push(JSON.parse(init.body));
      return new Response("OK");
    }
    throw new Error(`Unexpected fetch: ${input}`);
  };
  const env = {
    LINE_CHANNEL_ACCESS_TOKEN: "test-token",
    PROFIT_DASHBOARD_BYPASS_TOKEN: "warehouse-card-bypass",
    LINE_ACTIVATION: {
      idFromName(name) { return name; },
      get() { return { fetch(input, init) { return object.fetch(new Request(input, init)); } }; },
    },
  };
  try {
    await processLineEvent({
      type: "message",
      replyToken: "warehouse-keyword",
      timestamp: Date.now(),
      source: { type: "group", groupId: "g1", userId: "u1" },
      message: { type: "text", text: "洗衣袋" },
    }, env);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(replies.length, 1);
  assert.equal(replies[0].messages[0].type, "flex");
  assert.match(replies[0].messages[0].altText, /洗衣袋.*找到 1 項/);
  assert.equal(
    replies[0].messages[0].contents.contents[0].hero.url,
    "https://down-tw.img.susercontent.com/file/tw-11134207-laundry-bag-image",
  );
  assert.equal(replies[0].messages[0].contents.contents[0].footer.contents[0].action.text, "完整儲位 A100");
});

test("formatLineScript creates a readable LINE reply", () => {
  const text = formatLineScript({
    productName: "透明收納袋",
    totalSeconds: 40,
    direction: "突出收納空間",
    segments: [
      { time: "0-6 秒", title: "開頭", voice: "東西總是找不到嗎？" },
      { time: "6-32 秒", title: "賣點", voice: "透明設計方便辨識內容物。" },
      { time: "32-40 秒", title: "結尾", voice: "現在就整理起來。" },
    ],
  });
  assert.match(text, /🎬 透明收納袋/);
  assert.match(text, /2｜6-32 秒｜賣點/);
});

test("formatLineScript reports whether product-page content was read", () => {
  const base = {
    productName: "韓系髮圈",
    totalSeconds: 30,
    direction: "突出商品特色",
    segments: [
      { time: "0-5 秒", title: "開頭", voice: "開頭" },
      { time: "5-24 秒", title: "賣點", voice: "賣點" },
      { time: "24-30 秒", title: "結尾", voice: "結尾" },
    ],
  };
  assert.match(formatLineScript({ ...base, pageContentRead: true }), /已讀取商品頁內容/);
  assert.match(formatLineScript({ ...base, pageContentRead: false }), /僅依商品名稱生成/);
});

test("verifyLineSignature validates the exact raw request body", async () => {
  const rawBody = '{"events":[]}';
  const secret = "test-secret";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
  const signature = Buffer.from(bytes).toString("base64");
  assert.equal(await verifyLineSignature(rawBody, signature, secret), true);
  assert.equal(await verifyLineSignature('{"events":[1]}', signature, secret), false);
});
