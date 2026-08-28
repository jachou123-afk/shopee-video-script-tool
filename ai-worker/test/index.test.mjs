import assert from "node:assert/strict";
import test from "node:test";
import worker, {
  armLineGroup,
  canonicalShopeeUrl,
  createLineFocusPanel,
  createLinePanel,
  createWarehousePositionDryRunPreview,
  createWarehousePositionWizardMessage,
  createErpOrderMessage,
  createWarehouseSearchMessage,
  createWarehouseStorageLocationFilterPrompt,
  createWarehouseStorageLocationMessage,
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
  parseLineOrderBindingCommand,
  parseLineOrderLookupCommand,
  parseWarehouseLocationDetailCommand,
  parseWarehouseLocationCommand,
  parseWarehouseStorageLocationAvailabilityCommand,
  parseWarehouseStorageLocationCandidate,
  parseWarehouseStorageLocationCommand,
  parseWarehousePositionDryRunCommand,
  parseWarehousePositionDryRunStartCommand,
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
  normalizeErpOrderAlias,
  normalizeWarehouseStorageLocation,
  warehousePositionWizardLocation,
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

test("ERP order commands recognize the printed transaction number without capturing ordinary SKUs", () => {
  assert.equal(parseLineOrderLookupCommand("0350000-10747554"), "0350000-10747554");
  assert.equal(parseLineOrderLookupCommand("訂單：0350000-10747554"), "0350000-10747554");
  assert.equal(parseLineOrderLookupCommand("訂單 260827EYQGCNGU"), "260827EYQGCNGU");
  assert.equal(parseLineOrderLookupCommand("10747554"), "10747554");
  assert.equal(parseLineOrderLookupCommand("A725"), "");
  assert.equal(normalizeErpOrderAlias("０３５００００－１０７４７５５４"), "0350000-10747554");
});

test("ERP order binding command accepts only an explicit private binding token", () => {
  assert.equal(parseLineOrderBindingCommand("綁定訂單 Abc_1234-X"), "Abc_1234-X");
  assert.equal(parseLineOrderBindingCommand("訂單綁定 １２３４５６７８"), "12345678");
  assert.equal(parseLineOrderBindingCommand("綁定訂單"), "");
  assert.equal(parseLineOrderBindingCommand("綁定訂單 123"), "");
  assert.equal(parseLineOrderBindingCommand("0350000-10747554"), null);
});

test("ERP order reply is operational only and fails closed for stale data", () => {
  const now = Date.parse("2026-08-28T10:00:00+08:00");
  const message = createErpOrderMessage({
    metadata: { updatedAt: "2026-08-28T09:55:00+08:00" },
    order: {
      transactionNo: "10747554",
      printableOrderNumbers: ["0350000-10747554"],
      platformOrderNumbers: ["260827EYQGCNGU"],
      platform: "蝦皮購物",
      status: "已出貨",
      totalAmount: 360,
      totalQuantity: 180,
      items: [
        { sku: "A032-03", name: "糖果化妝包", style: "粉", quantity: 100, unitPrice: 2, warehouseArea: "02-L09-03/T2" },
        { sku: "A032-09", name: "糖果化妝包", style: "玫瑰紅", quantity: 80, unitPrice: 2, warehouseArea: "02-L09-03/T2" },
      ],
    },
  }, "0350000-10747554", now);
  assert.match(message, /訂單 0350000-10747554/);
  assert.match(message, /260827EYQGCNGU/);
  assert.match(message, /共 1 款／2 規格／180 件/);
  assert.match(message, /糖果化妝包\n   A032-03 粉x100\n   A032-09 玫瑰紅x80/);
  assert.equal((message.match(/糖果化妝包/gu) || []).length, 1);
  assert.equal((message.match(/單價 NT\$2/gu) || []).length, 1);
  assert.equal((message.match(/儲位 02-L09-03\/T2/gu) || []).length, 1);
  assert.doesNotMatch(message, /姓名|電話|地址/);

  const legacy = createErpOrderMessage({
    metadata: { updatedAt: "2026-08-28T09:55:00+08:00" },
    order: {
      transactionNo: "10747554",
      totalAmount: 2,
      totalQuantity: 1,
      items: [{ name: "糖果化妝包", style: "粉", quantity: 1, unitPrice: 2 }],
    },
  }, "10747554", now);
  assert.match(legacy, /糖果化妝包\n   粉x1/);
  assert.doesNotMatch(legacy, /undefined|null/);

  const stale = createErpOrderMessage({
    metadata: { updatedAt: "2026-08-28T09:00:00+08:00" },
    order: { transactionNo: "10747554", items: [{ name: "不得洩漏" }] },
  }, "0350000-10747554", now);
  assert.match(stale, /訂單查詢暫停/);
  assert.doesNotMatch(stale, /不得洩漏/);
});

test("ERP order reply keeps per-style prices and locations when a grouped product differs", () => {
  const now = Date.parse("2026-08-28T10:00:00+08:00");
  const message = createErpOrderMessage({
    metadata: { updatedAt: "2026-08-28T09:55:00+08:00" },
    order: {
      transactionNo: "10747554",
      totalAmount: 5,
      totalQuantity: 2,
      items: [
        { sku: "A032-03", name: "糖果化妝包", style: "粉", quantity: 1, unitPrice: 2, warehouseArea: "A-01" },
        { sku: "A032-09", name: "糖果化妝包", style: "玫瑰紅", quantity: 1, unitPrice: 3, warehouseArea: "B-02" },
      ],
    },
  }, "10747554", now);
  assert.match(message, /A032-03 粉x1｜儲位 A-01｜單價 NT\$2/);
  assert.match(message, /A032-09 玫瑰紅x1｜儲位 B-02｜單價 NT\$3/);
  assert.equal((message.match(/糖果化妝包/gu) || []).length, 1);
});

test("ERP order reply aggregates unit rows into color quantities", () => {
  const now = Date.parse("2026-08-28T10:00:00+08:00");
  const items = [
    ...Array.from({ length: 100 }, () => ({
      sku: "A032-03",
      name: "糖果化妝包",
      style: "粉",
      quantity: 1,
      unitPrice: 7,
      warehouseArea: "02-L09-03/T2",
    })),
    ...Array.from({ length: 80 }, () => ({
      sku: "A032-09",
      name: "糖果化妝包",
      style: "玫瑰紅",
      quantity: 1,
      unitPrice: 7,
      warehouseArea: "02-L09-03/T2",
    })),
  ];
  const message = createErpOrderMessage({
    metadata: { updatedAt: "2026-08-28T09:55:00+08:00" },
    order: {
      transactionNo: "10747554",
      totalAmount: 1250,
      totalQuantity: 180,
      items,
    },
  }, "10747554", now);

  assert.match(message, /共 1 款／2 規格／180 件/);
  assert.match(message, /A032-03 粉x100/);
  assert.match(message, /A032-09 玫瑰紅x80/);
  assert.equal((message.match(/儲位 02-L09-03\/T2/gu) || []).length, 1);
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

test("warehouse storage-location command accepts exact tray and no-tray locations", () => {
  assert.equal(parseWarehouseStorageLocationCommand("04-R05-02/T5"), "04-R05-02/T5");
  assert.equal(parseWarehouseStorageLocationCommand("05-R04-03"), "05-R04-03");
  assert.equal(parseWarehouseStorageLocationCommand("儲位 04-r05-02/t5"), "04-R05-02/T5");
  assert.equal(parseWarehouseStorageLocationCommand("查儲位：０５－Ｒ０４－０３"), "05-R04-03");
  assert.equal(parseWarehouseStorageLocationCommand("04 - R05 - 02 ／ T12"), "04-R05-02/T12");
  assert.equal(parseWarehouseStorageLocationCommand("A725"), null);
  assert.equal(parseWarehouseStorageLocationCommand("A區-01"), null);
  assert.equal(parseWarehouseStorageLocationCommand("04-R05-02/T"), null);
  assert.equal(normalizeWarehouseStorageLocation(" ０４－ｒ０５－０２／ｔ５ "), "04-R05-02/T5");
  assert.equal(parseWarehouseStorageLocationCandidate("AR01-03"), "AR01-03");
  assert.equal(parseWarehouseStorageLocationCandidate("儲位 ar01-03"), "AR01-03");
  assert.equal(parseWarehouseStorageLocationCandidate("A區-01"), "A區-01");
  assert.equal(parseWarehouseStorageLocationCandidate("洗衣袋"), "洗衣袋");
  assert.equal(parseWarehouseStorageLocationCandidate("https://example.com/AR01-03"), null);
});

test("warehouse storage-location availability commands are explicit and normalized", () => {
  assert.deepEqual(parseWarehouseStorageLocationAvailabilityCommand("AR03-03 顯示無庫存"), {
    location: "AR03-03",
    includeUnavailable: true,
  });
  assert.deepEqual(parseWarehouseStorageLocationAvailabilityCommand("儲位 ar03-03 不顯示無庫存"), {
    location: "AR03-03",
    includeUnavailable: false,
  });
  assert.deepEqual(parseWarehouseStorageLocationAvailabilityCommand("AR03-03 只看有庫存"), {
    location: "AR03-03",
    includeUnavailable: false,
  });
  assert.deepEqual(parseWarehouseStorageLocationAvailabilityCommand("０４－Ｒ０５－０２／Ｔ５ 有庫存"), {
    location: "04-R05-02/T5",
    includeUnavailable: false,
  });
  assert.equal(parseWarehouseStorageLocationAvailabilityCommand("AR03-03"), null);
});

test("warehouse storage-location reply paginates and flags unavailable and stale stock", () => {
  const message = createWarehouseStorageLocationMessage({
    location: "04-R05-02/T5",
    items: [
      { sku: "A1", name: "商品一", style: "紅色", size: "大", available: 2 },
      { sku: "A2", name: "商品二", style: "", size: "", available: 0 },
      { sku: "A3", name: "商品三", style: "藍色", size: "小", available: -1 },
    ],
    skuCount: 12,
    totalCount: 13,
    page: 1,
    totalPages: 2,
    metadata: {
      warehouseName: "主倉",
      updatedAt: "2026-08-13T09:00:00+08:00",
    },
  }, Date.parse("2026-08-13T10:00:01+08:00"));
  assert.match(message.text, /主倉｜04-R05-02\/T5/);
  assert.match(message.text, /共 12 個貨號、13 個品項｜第 1\/2 頁/);
  assert.match(message.text, /篩選：顯示無庫存/);
  assert.match(message.text, /紅色／大｜可用 2/);
  assert.match(message.text, /一般規格｜⚠️ 可用 0/);
  assert.match(message.text, /藍色／小｜⚠️ 可用 -1/);
  assert.match(message.text, /已超過 30 分鐘/);
  assert.deepEqual(message.quickReply.items.map((item) => item.action.label), ["➡️ 下一頁"]);
  assert.match(message.quickReply.items[0].action.data, /action=warehouse_storage_location/);
  assert.match(message.quickReply.items[0].action.data, /includeUnavailable=1/);
  assert.ok(message.quickReply.items[0].action.data.length <= 300);

  const prompt = createWarehouseStorageLocationFilterPrompt({
    location: "AR03-03",
    skuCount: 19,
    totalCount: 19,
    metadata: { warehouseName: "主倉" },
  });
  assert.match(prompt.text, /是否顯示無庫存品項/);
  assert.deepEqual(prompt.quickReply.items.map((item) => item.action.label), ["只看有庫存", "顯示無庫存"]);
  assert.match(prompt.quickReply.items[0].action.data, /includeUnavailable=0/);
  assert.match(prompt.quickReply.items[1].action.data, /includeUnavailable=1/);

  const availableOnlyEmpty = createWarehouseStorageLocationMessage({
    location: "AR03-03",
    items: [],
    skuCount: 0,
    totalCount: 0,
    allTotalCount: 3,
    includeUnavailable: false,
    metadata: { warehouseName: "主倉", updatedAt: "2026-08-13T09:55:00+08:00" },
  }, Date.parse("2026-08-13T10:00:00+08:00"));
  assert.match(availableOnlyEmpty.text, /目前沒有可用庫存大於 0 的品項/);
  assert.match(availableOnlyEmpty.text, /AR03-03 顯示無庫存/);

  const bounded = createWarehouseStorageLocationMessage({
    location: "04-R05-02/T5",
    items: Array.from({ length: 10 }, (_, index) => ({
      sku: `LONG-SKU-${index}-${"X".repeat(80)}`,
      name: `商品 ${index} ${"長".repeat(200)}`,
      style: "款".repeat(100),
      size: "尺寸".repeat(50),
      available: index,
    })),
    skuCount: 10,
    totalCount: 10,
    page: 1,
    totalPages: 1,
    metadata: { warehouseName: "主倉", updatedAt: "2026-08-13T09:55:00+08:00" },
  }, Date.parse("2026-08-13T10:00:00+08:00"));
  assert.ok(bounded.text.length < 5000);
  assert.match(bounded.text, /10\. LONG-SKU-9/);
  assert.match(bounded.text, /ERP 更新/);
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

test("warehouse position wizard starts from a SKU and only builds valid B warehouse locations", () => {
  assert.equal(parseWarehousePositionDryRunStartCommand("改儲位 A861"), "A861");
  assert.equal(parseWarehousePositionDryRunStartCommand("改儲位 ａ８６１"), "A861");
  assert.equal(parseWarehousePositionDryRunStartCommand("改儲位 洗衣袋"), null);
  assert.equal(parseWarehousePositionDryRunStartCommand("改儲位 A861 02-R04-01/T1"), null);

  const start = createWarehousePositionWizardMessage({ step: "warehouse", sku: "A861" });
  assert.match(start.text, /全部選完後只會顯示預覽，不會寫入 ERP/);
  assert.deepEqual(start.quickReply.items.map((item) => item.action.label), ["A倉", "B倉", "取消"]);

  assert.equal(warehousePositionWizardLocation({
    warehouse: "B", zone: "02", side: "R", shelf: "04", level: "01", tray: "T1",
  }), "02-R04-01/T1");
  assert.equal(warehousePositionWizardLocation({
    warehouse: "B", zone: "05", side: "R", shelf: "04", level: "03", tray: "NONE",
  }), "05-R04-03");
  assert.equal(warehousePositionWizardLocation({
    warehouse: "A", zone: "02", side: "R", shelf: "04", level: "01", tray: "T1",
  }), "");
  assert.equal(warehousePositionWizardLocation({
    warehouse: "B", zone: "02", side: "R", shelf: "99", level: "01", tray: "T1",
  }), "");

  const multiVariantItem = {
    sku: "A823",
    variants: Array.from({ length: 6 }, (_, index) => ({ barcode: `A823-0${index + 1}` })),
  };
  const variantMessage = createWarehousePositionWizardMessage({ step: "variant", sku: "A823" }, "", multiVariantItem);
  assert.deepEqual(variantMessage.quickReply.items.map((item) => item.action.label), [
    "-01", "-02", "-03", "-04", "-05", "-06", "全部", "取消",
  ]);
  assert.ok(variantMessage.quickReply.items.every((item) => item.action.data.length <= 300));
  assert.equal(createWarehousePositionWizardMessage({ step: "variant", sku: "A823" }, "", {
    sku: "A823",
    variants: [{ barcode: "A823-01" }, { barcode: "A823-01" }],
  }), null, "duplicate child SKUs must fail closed");
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

  const multiItem = {
    sku: "A823",
    name: "多規格商品",
    variants: [
      { location: "01-L01-01/T1", style: "紅色", size: "小", barcode: "A823-01", available: 2 },
      { location: "01-L01-01/T2", style: "藍色", size: "大", barcode: "A823-02", available: 3 },
    ],
  };
  const selected = createWarehousePositionDryRunPreview(multiItem, metadata, "02-R04-01/T1", now, "A823-02");
  assert.match(selected, /子貨號：A823-02/);
  assert.match(selected, /原儲位：01-L01-01\/T2/);
  assert.doesNotMatch(selected, /原儲位：01-L01-01\/T1/);

  const all = createWarehousePositionDryRunPreview(multiItem, metadata, "02-R04-01/T1", now, "*");
  assert.match(all, /全部子貨號儲位修改演練（不會寫入 ERP）/);
  assert.match(all, /A823-01｜01-L01-01\/T1 → 02-R04-01\/T1/);
  assert.match(all, /A823-02｜01-L01-01\/T2 → 02-R04-01\/T1/);
  assert.match(all, /沒有呼叫 ERP 寫入/);

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
  const mixedLocations = formatWarehouseLocation({
    sku: "A856",
    name: "搬家打包袋",
    available: 3870,
    variants: [
      { location: "W2-1", style: "65*100", size: "F", available: 978 },
      { location: "W2-1", style: "75*110", size: "F", available: 978 },
      { location: "W2-1", style: "85*120", size: "F", available: 924 },
      { location: "", style: "55*80", size: "F", available: 990 },
    ],
  });
  assert.match(mixedLocations, /主倉可用庫存：3870/);
  assert.match(mixedLocations, /55\*80／F：未設定儲位（可用 990）/);
  assert.match(formatWarehouseLocation({ sku: "B1", name: "無儲位", available: 0, variants: [] }), /尚未設定儲位/);
  const privateCost = formatWarehouseLocation({
    sku: "K501",
    name: "頭盔小鴨吊飾",
    available: 30,
    costMin: 23,
    costMax: 24.5,
    priceMin: 35,
    priceMax: 38.5,
    variants: [],
  }, {}, { showCost: true, showPrice: true });
  assert.match(privateCost, /🔒 單個存貨成本：NT\$23～NT\$24\.50／個/);
  assert.match(privateCost, /💰 ERP 售價：NT\$35～NT\$38\.50／個/);
  assert.doesNotMatch(formatWarehouseLocation({
    sku: "K501",
    name: "頭盔小鴨吊飾",
    available: 30,
    costMin: 23,
    costMax: 24.5,
    priceMin: 35,
    priceMax: 38.5,
    variants: [],
  }), /存貨成本|ERP 售價|NT\$/);
  assert.match(formatWarehouseLocation({
    sku: "G888",
    name: "未設定成本商品",
    available: 1,
    costMin: 0,
    costMax: 0,
    priceMin: 0,
    priceMax: 0,
    variants: [],
  }, {}, { showCost: true, showPrice: true }), /🔒 單個存貨成本：未設定[\s\S]*💰 ERP 售價：未設定/);
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

  const privateCostMessage = createWarehouseSearchMessage([{
    sku: "K501",
    name: "頭盔小鴨吊飾",
    available: 30,
    costMin: 23,
    costMax: 23,
    priceMin: 35,
    priceMax: 35,
    variants: [],
  }], "K501", 1, { showCost: true, showPrice: true });
  const privateCostBody = JSON.stringify(privateCostMessage.contents.contents[0].body.contents);
  assert.match(privateCostBody, /🔒 單個存貨成本：NT\$23／個/);
  assert.match(privateCostBody, /💰 ERP 售價：NT\$35／個/);
  const groupCostBody = JSON.stringify(createWarehouseSearchMessage([{
    sku: "K501",
    name: "頭盔小鴨吊飾",
    available: 30,
    costMin: 23,
    costMax: 23,
    priceMin: 35,
    priceMax: 35,
    variants: [],
  }], "K501", 1).contents.contents[0].body.contents);
  assert.doesNotMatch(groupCostBody, /存貨成本|ERP 售價|NT\$/);
  const nonGkBody = JSON.stringify(createWarehouseSearchMessage([{
    sku: "A725",
    name: "細網洗衣袋",
    available: 12,
    costMin: 99,
    costMax: 99,
    priceMin: 120,
    priceMax: 125.5,
    variants: [],
  }], "A725", 1, { showCost: true, showPrice: true }).contents.contents[0].body.contents);
  assert.doesNotMatch(nonGkBody, /存貨成本/);
  assert.match(nonGkBody, /💰 ERP 售價：NT\$120～NT\$125\.50／個/);
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
  assert.match(help, /8 秒內回覆貨號/);
  assert.equal(isLineScriptPromptCommand("產生文案"), true);
  assert.equal(isLineScriptPromptCommand("商品文案"), true);
  assert.equal(isLineScriptPromptCommand("洗衣袋"), false);

  const message = createLineHelpMessage();
  assert.equal(message.type, "text");
  assert.equal(message.quickReply.items.length, 6);
  assert.deepEqual(
    message.quickReply.items.map((item) => item.action.text),
    ["查", "儲位", "要拍什麼", "改儲位", "已拍完", "產生文案"],
  );
  assert.equal(message.quickReply.items[3].action.label, "📦 改儲位");
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

test("LineActivation enforces a one-time eight-second warehouse prompt", async () => {
  const values = new Map();
  const object = new LineActivation({
    storage: {
      async put(key, value) { values.set(key, structuredClone(value)); },
      async get(key) { return values.has(key) ? structuredClone(values.get(key)) : undefined; },
      async delete(key) { values.delete(key); },
    },
  });
  let response = await object.fetch(new Request("https://line-activation/warehouse-position-prompt/arm", {
    method: "POST",
    body: JSON.stringify({ armedAt: 1000 }),
  }));
  assert.equal((await response.json()).armed, true);
  response = await object.fetch(new Request("https://line-activation/warehouse-position-prompt/take", {
    method: "POST",
    body: JSON.stringify({ now: 9000 }),
  }));
  assert.deepEqual(await response.json(), { valid: true, existed: true, elapsed: 8000 });

  await object.fetch(new Request("https://line-activation/warehouse-position-prompt/arm", {
    method: "POST",
    body: JSON.stringify({ armedAt: 1000 }),
  }));
  response = await object.fetch(new Request("https://line-activation/warehouse-position-prompt/take", {
    method: "POST",
    body: JSON.stringify({ now: 9001 }),
  }));
  assert.deepEqual(await response.json(), { valid: false, existed: true, elapsed: 8001 });
  response = await object.fetch(new Request("https://line-activation/warehouse-position-prompt/take", {
    method: "POST",
    body: JSON.stringify({ now: 9002 }),
  }));
  assert.deepEqual(await response.json(), { valid: false, existed: false });
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
        costMin: 999,
        costMax: 999,
        priceMin: 120,
        priceMax: 125.5,
        variants: [{ location: "A區-01", style: "紅色", size: "大", barcode: "4711", available: 8 }],
      }, {
        sku: "k501",
        name: "頭盔小鴨吊飾",
        available: 30,
        costMin: 23,
        costMax: 24.5,
        priceMin: 35,
        priceMax: 38.5,
        variants: [],
      }],
    }),
  }));
  let data = await response.json();
  assert.equal(data.ok, true);
  assert.equal(data.itemCount, 2);

  response = await object.fetch(new Request("https://line-schedule/warehouse-locations/query", {
    method: "POST",
    body: JSON.stringify({ sku: "A12345" }),
  }));
  data = await response.json();
  assert.equal(data.item.sku, "A12345");
  assert.equal(data.item.variants[0].location, "A區-01");
  assert.equal(data.item.costMin, undefined);
  assert.equal(data.item.costMax, undefined);
  assert.equal(data.item.priceMin, 120);
  assert.equal(data.item.priceMax, 125.5);
  assert.equal(data.metadata.warehouseName, "主倉");

  response = await object.fetch(new Request("https://line-schedule/warehouse-locations/query", {
    method: "POST",
    body: JSON.stringify({ sku: "K501" }),
  }));
  data = await response.json();
  assert.equal(data.item.costMin, 23);
  assert.equal(data.item.costMax, 24.5);
  assert.equal(data.item.priceMin, 35);
  assert.equal(data.item.priceMax, 38.5);

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

test("LineActivation publishes a sanitized ERP order index with printed and platform aliases", async () => {
  const values = new Map();
  const snapshotAt = new Date().toISOString();
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
      updatedAt: snapshotAt,
      warehouseId: 1,
      warehouseName: "主倉",
      items: [
        {
          sku: "A032",
          name: "糖果化妝包",
          available: 250,
          variants: [
            { location: "02-L09-03/T2", style: "粉", size: "1", barcode: "A032-03", available: 100 },
            { location: "02-L09-03/T2", style: "玫瑰紅", size: "1", barcode: "A032-09", available: 150 },
          ],
        },
        {
          sku: "X999",
          name: "糖果化妝包",
          available: 1,
          variants: [
            { location: "錯誤儲位", style: "粉", size: "1", barcode: "X999-03", available: 1 },
          ],
        },
      ],
    }),
  }));
  let data = await response.json();
  assert.equal(data.ok, true);

  response = await object.fetch(new Request("https://line-schedule/erp-orders/sync", {
    method: "POST",
    body: JSON.stringify({
      updatedAt: snapshotAt,
      retentionDays: 90,
      orders: [
        {
          transactionNo: "10747554",
          printableOrderNumbers: ["0350000-10747554"],
          platformOrderNumbers: ["260827EYQGCNGU"],
          recipientName: "不應儲存的姓名",
          recipientPhone: "0912345678",
          recipientAddress: "不應儲存的地址",
          status: "已出貨",
          totalAmount: 1260,
          totalQuantity: 180,
          items: [
            ...Array.from({ length: 100 }, () => ({
              orderNo: "SP1",
              subOrderNo: "035000010747554",
              sku: " a032－03 ",
              name: "糖果化妝包",
              style: "粉-1",
              quantity: 1,
              unitPrice: 7,
            })),
            ...Array.from({ length: 80 }, () => ({
              orderNo: "SP2",
              subOrderNo: "035000010747554",
              sku: "A032-09",
              name: "糖果化妝包",
              style: "玫瑰紅-1",
              quantity: 1,
              unitPrice: 7,
            })),
          ],
        },
        {
          transactionNo: "10747555",
          totalQuantity: 1,
          items: [{ sku: "UNKNOWN-03", name: "糖果化妝包", style: "粉-1", quantity: 1, unitPrice: 2 }],
        },
        {
          transactionNo: "10747556",
          totalQuantity: 1,
          items: [{
            sku: "A032-03",
            name: "糖果化妝包",
            style: "粉-1",
            quantity: 1,
            unitPrice: 2,
            warehouseArea: "ORDER-LOCK",
          }],
        },
      ],
    }),
  }));
  data = await response.json();
  assert.equal(data.ok, true);
  assert.equal(data.orderCount, 3);

  for (const query of ["0350000-10747554", "10747554", "260827EYQGCNGU"] ) {
    response = await object.fetch(new Request("https://line-schedule/erp-orders/query", {
      method: "POST",
      body: JSON.stringify({ query }),
    }));
    data = await response.json();
    assert.equal(data.order.transactionNo, "10747554");
    assert.equal(data.order.items.length, 2);
    assert.deepEqual(data.order.items.map((item) => item.sku), ["A032-03", "A032-09"]);
    assert.deepEqual(data.order.items.map((item) => item.quantity), [100, 80]);
    assert.deepEqual(data.order.items.map((item) => item.style), ["粉-1", "玫瑰紅-1"]);
    assert.deepEqual(data.order.items.map((item) => item.displayStyle), ["粉", "玫瑰紅"]);
    assert.deepEqual(data.order.items.map((item) => item.warehouseArea), ["02-L09-03/T2", "02-L09-03/T2"]);
    assert.doesNotMatch(JSON.stringify(data.order), /不應儲存|0912345678/);
  }
  const reply = createErpOrderMessage(data, "0350000-10747554", Date.now());
  assert.match(reply, /A032-03 粉x100/);
  assert.match(reply, /A032-09 玫瑰紅x80/);
  assert.equal((reply.match(/儲位 02-L09-03\/T2/gu) || []).length, 1);
  assert.equal((reply.match(/單價 NT\$7/gu) || []).length, 1);

  response = await object.fetch(new Request("https://line-schedule/erp-orders/query", {
    method: "POST",
    body: JSON.stringify({ query: "10747555" }),
  }));
  data = await response.json();
  assert.equal(data.order.items[0].sku, "UNKNOWN-03");
  assert.equal(data.order.items[0].style, "粉-1");
  assert.equal(data.order.items[0].displayStyle, undefined);
  assert.equal(data.order.items[0].warehouseArea, "");

  response = await object.fetch(new Request("https://line-schedule/erp-orders/query", {
    method: "POST",
    body: JSON.stringify({ query: "10747556" }),
  }));
  data = await response.json();
  assert.equal(data.order.items[0].sku, "A032-03");
  assert.equal(data.order.items[0].warehouseArea, "ORDER-LOCK");

  const currentWarehouseMetadata = values.get("warehouse-location-active");
  values.set("warehouse-location-active", {
    ...currentWarehouseMetadata,
    updatedAt: "2020-01-01T00:00:00Z",
  });
  response = await object.fetch(new Request("https://line-schedule/erp-orders/query", {
    method: "POST",
    body: JSON.stringify({ query: "10747554" }),
  }));
  data = await response.json();
  assert.deepEqual(data.order.items.map((item) => item.warehouseArea), ["", ""]);
  assert.deepEqual(data.order.items.map((item) => item.displayStyle), [undefined, undefined]);

  values.set("warehouse-location-active", {
    ...currentWarehouseMetadata,
    warehouseName: "副倉",
    updatedAt: snapshotAt,
  });
  response = await object.fetch(new Request("https://line-schedule/erp-orders/query", {
    method: "POST",
    body: JSON.stringify({ query: "10747554" }),
  }));
  data = await response.json();
  assert.deepEqual(data.order.items.map((item) => item.warehouseArea), ["", ""]);
});

test("LineActivation binds the real LINE webhook user with a one-time token and stores only hashes", async () => {
  const values = new Map();
  const object = new LineActivation({
    storage: {
      async put(key, value) { values.set(key, structuredClone(value)); },
      async get(key) { return values.has(key) ? structuredClone(values.get(key)) : undefined; },
      async delete(key) { values.delete(key); },
    },
  });
  const firstUser = "U-real-webhook-user-12345678";
  const secondUser = "U-other-user-87654321";
  const bindToken = "Once_9xK2p7";
  let response = await object.fetch(new Request("https://line-schedule/erp-orders/bind-user", {
    method: "POST",
    body: JSON.stringify({ userId: firstUser, bindToken }),
  }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).authorized, true);

  response = await object.fetch(new Request("https://line-schedule/erp-orders/user-authorized", {
    method: "POST",
    body: JSON.stringify({ userId: firstUser }),
  }));
  assert.equal((await response.json()).authorized, true);
  response = await object.fetch(new Request("https://line-schedule/erp-orders/user-authorized", {
    method: "POST",
    body: JSON.stringify({ userId: secondUser }),
  }));
  assert.equal((await response.json()).authorized, false);

  response = await object.fetch(new Request("https://line-schedule/erp-orders/bind-user", {
    method: "POST",
    body: JSON.stringify({ userId: secondUser, bindToken }),
  }));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "ORDER_BINDING_ALREADY_USED");
  assert.equal([...values.keys()].some((key) => key.includes(firstUser) || key.includes(bindToken)), false);
});

test("a one-time LINE binding command authorizes the exact webhook user for later order lookups", async () => {
  const originalFetch = globalThis.fetch;
  const values = new Map();
  const replies = [];
  const object = new LineActivation({
    storage: {
      async put(key, value) { values.set(key, structuredClone(value)); },
      async get(key) { return values.has(key) ? structuredClone(values.get(key)) : undefined; },
      async delete(key) { values.delete(key); },
    },
  });
  const env = {
    LINE_CHANNEL_ACCESS_TOKEN: "test-token",
    LINE_ORDER_BIND_TOKEN: "Bind_7kP3m9",
    LINE_ACTIVATION: {
      idFromName(name) { return name; },
      get() { return { fetch: (input, init) => object.fetch(new Request(input, init)) }; },
    },
  };
  globalThis.fetch = async (url, options = {}) => {
    if (String(url) === "https://api.line.me/v2/bot/message/reply") {
      replies.push(JSON.parse(options.body));
      return Response.json({ ok: true });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  try {
    const source = { type: "user", userId: "U-webhook-only-real-user" };
    await processLineEvent({
      type: "message",
      replyToken: "bind-reply",
      source,
      message: { type: "text", text: "綁定訂單 Bind_7kP3m9" },
    }, env);
    assert.match(replies.at(-1).messages[0].text, /已完成訂單查詢綁定/);

    await processLineEvent({
      type: "message",
      replyToken: "lookup-reply",
      source,
      message: { type: "text", text: "0350000-10747554" },
    }, env);
    assert.doesNotMatch(replies.at(-1).messages[0].text, /只限已授權/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("LineActivation builds an exact reverse index and paginates every item at a storage location", async () => {
  const values = new Map();
  const object = new LineActivation({
    storage: {
      async put(key, value) { values.set(key, structuredClone(value)); },
      async get(key) { return values.has(key) ? structuredClone(values.get(key)) : undefined; },
      async delete(key) { values.delete(key); },
    },
  });
  const targetLocation = "04-R05-02/T5";
  const targetBucket = warehouseLocationBucket(targetLocation, 64);
  let collidingLocation = "";
  for (let zone = 0; zone < 100 && !collidingLocation; zone += 1) {
    for (let shelf = 0; shelf < 100; shelf += 1) {
      const candidate = `${String(zone).padStart(2, "0")}-L${String(shelf).padStart(2, "0")}-01/T1`;
      if (candidate !== targetLocation && warehouseLocationBucket(candidate, 64) === targetBucket) {
        collidingLocation = candidate;
        break;
      }
    }
  }
  assert.ok(collidingLocation, "the test needs another location in the same reverse bucket");
  const items = Array.from({ length: 12 }, (_, index) => ({
    sku: `A${index + 1}`,
    name: `測試商品 ${index + 1}`,
    available: index - 1,
    variants: [{
      location: index % 2 ? "04-r05-02/t5" : "０４－Ｒ０５－０２／Ｔ５",
      style: `款式 ${index + 1}`,
      size: "",
      barcode: `A${index + 1}-01`,
      available: index - 1,
    }],
  }));
  items[0].variants.push({ ...items[0].variants[0] }, {
    ...items[0].variants[0],
    style: "另一款",
    barcode: "A1-02",
  });
  items.unshift(...Array.from({ length: 45 }, (_, index) => ({
    sku: `Z${index + 1}`,
    name: `同桶前置商品 ${index + 1}`,
    available: 1,
    variants: [{
      location: collidingLocation,
      style: "",
      size: "",
      barcode: `Z${index + 1}-01`,
      available: 1,
    }],
  })));

  let response = await object.fetch(new Request("https://line-schedule/warehouse-locations/sync", {
    method: "POST",
    body: JSON.stringify({
      updatedAt: "2026-08-26T10:00:00+08:00",
      warehouseName: "主倉",
      items,
    }),
  }));
  let data = await response.json();
  assert.equal(data.locationCount, 2);
  assert.equal(data.locatedItemCount, 58, "an exact duplicate is removed but a distinct variant remains");
  assert.ok(values.has("warehouse-location-active"));
  const reverseChunks = [...values.entries()]
    .filter(([key]) => key.startsWith("warehouse-location-reverse-items:"))
    .map(([, value]) => value);
  assert.ok(reverseChunks.length > 0);
  assert.ok(reverseChunks.every((chunk) => Array.isArray(chunk) && chunk.length <= 50));

  response = await object.fetch(new Request("https://line-schedule/warehouse-locations/query-storage-location", {
    method: "POST",
    body: JSON.stringify({ location: "04-R05-02/T5", page: 1 }),
  }));
  data = await response.json();
  assert.equal(data.indexed, true);
  assert.equal(data.location, "０４－Ｒ０５－０２／Ｔ５");
  assert.equal(data.skuCount, 12);
  assert.equal(data.totalCount, 13);
  assert.equal(data.items.length, 10);
  assert.ok(data.items.every((item) => item.sku.startsWith("A")), "a page spanning two chunks must not leak the colliding location");
  assert.equal(data.page, 1);
  assert.equal(data.totalPages, 2);
  assert.ok(data.items.some((item) => item.available === 0));
  assert.ok(data.items.some((item) => item.available < 0));

  response = await object.fetch(new Request("https://line-schedule/warehouse-locations/query-storage-location", {
    method: "POST",
    body: JSON.stringify({ location: "04-R05-02/T5", page: 1, includeUnavailable: false }),
  }));
  data = await response.json();
  assert.equal(data.includeUnavailable, false);
  assert.equal(data.allTotalCount, 13);
  assert.equal(data.totalCount, 10);
  assert.equal(data.skuCount, 10);
  assert.equal(data.totalPages, 1);
  assert.ok(data.items.every((item) => item.available > 0));

  response = await object.fetch(new Request("https://line-schedule/warehouse-locations/query-storage-location", {
    method: "POST",
    body: JSON.stringify({ location: "０４－ｒ０５－０２／ｔ５", page: 2 }),
  }));
  data = await response.json();
  assert.equal(data.items.length, 3);
  assert.equal(data.page, 2);

  response = await object.fetch(new Request("https://line-schedule/warehouse-locations/query-storage-location", {
    method: "POST",
    body: JSON.stringify({ location: "04-R05-02/T6", page: 1 }),
  }));
  data = await response.json();
  assert.equal(data.totalCount, 0);
  assert.deepEqual(data.items, []);
});

test("storage-location query remains compatible with a snapshot created before the reverse index", async () => {
  const values = new Map();
  const version = "legacy-version";
  const item = {
    sku: "A900",
    name: "舊快照商品",
    available: 0,
    variants: [{ location: "05-R04-03", style: "", size: "", barcode: "A900-01", available: 0 }],
  };
  values.set("warehouse-location-active", {
    version,
    bucketCount: 64,
    warehouseName: "主倉",
    updatedAt: "2026-08-26T10:00:00+08:00",
  });
  values.set(`warehouse-location:${version}:${warehouseLocationBucket(item.sku, 64)}`, { [item.sku]: item });
  const object = new LineActivation({
    storage: {
      async put(key, value) { values.set(key, structuredClone(value)); },
      async get(key) { return values.has(key) ? structuredClone(values.get(key)) : undefined; },
      async delete(key) { values.delete(key); },
    },
  });
  let response = await object.fetch(new Request("https://line-schedule/warehouse-locations/query-storage-location", {
    method: "POST",
    body: JSON.stringify({ location: "05-R04-03" }),
  }));
  let data = await response.json();
  assert.equal(data.indexed, false);
  assert.equal(data.totalCount, 1);
  assert.equal(data.items[0].sku, "A900");
  assert.equal(data.items[0].available, 0);

  response = await object.fetch(new Request("https://line-schedule/warehouse-locations/query-storage-location", {
    method: "POST",
    body: JSON.stringify({ location: "05-R04-03", includeUnavailable: false }),
  }));
  data = await response.json();
  assert.equal(data.indexed, false);
  assert.equal(data.includeUnavailable, false);
  assert.equal(data.allTotalCount, 1);
  assert.equal(data.totalCount, 0);
  assert.deepEqual(data.items, []);
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

test("LineActivation ignores a stale reader close after a replacement connection", () => {
  const object = new LineActivation({ storage: {} });
  const staleSocket = { name: "stale" };
  const currentSocket = { name: "current" };
  object.readerSocket = currentSocket;
  object.readerHello = { browser: { started: true } };

  object.clearReaderIfCurrent(staleSocket);
  assert.equal(object.readerSocket, currentSocket);
  assert.deepEqual(object.readerHello, { browser: { started: true } });

  object.clearReaderIfCurrent(currentSocket);
  assert.equal(object.readerSocket, null);
  assert.equal(object.readerHello, null);
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
        sku: "K501",
        name: "頭盔小鴨吊飾",
        available: 30,
        costMin: 23,
        costMax: 24.5,
        priceMin: 35,
        priceMax: 38.5,
        variants: [{ location: "K區-01", style: "", size: "", available: 30 }],
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
      message: { type: "text", text: "K501" },
    }, env);
    await processLineEvent({
      type: "message",
      replyToken: "warehouse-details",
      timestamp: Date.now(),
      source: { type: "group", groupId: "g1", userId: "u1" },
      message: { type: "text", text: "完整儲位 K501" },
    }, env);
    await processLineEvent({
      type: "message",
      replyToken: "warehouse-private-query",
      timestamp: Date.now(),
      source: { type: "user", userId: "u1" },
      message: { type: "text", text: "K501" },
    }, env);
    await processLineEvent({
      type: "message",
      replyToken: "warehouse-private-details",
      timestamp: Date.now(),
      source: { type: "user", userId: "u1" },
      message: { type: "text", text: "完整儲位 K501" },
    }, env);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(replies.length, 4);
  assert.equal(replies[0].messages[0].type, "flex");
  assert.match(replies[0].messages[0].altText, /K501.*找到 1 項/);
  assert.equal(replies[0].messages[0].contents.contents[0].footer.contents[0].action.text, "完整儲位 K501");
  assert.doesNotMatch(JSON.stringify(replies[0]), /存貨成本|ERP 售價|NT\$/);
  assert.match(replies[1].messages[0].text, /K501｜頭盔小鴨吊飾/);
  assert.match(replies[1].messages[0].text, /K區-01/);
  assert.doesNotMatch(replies[1].messages[0].text, /存貨成本|ERP 售價|NT\$/);
  assert.match(JSON.stringify(replies[2]), /🔒 單個存貨成本：NT\$23～NT\$24\.50／個/);
  assert.match(JSON.stringify(replies[2]), /💰 ERP 售價：NT\$35～NT\$38\.50／個/);
  assert.match(replies[3].messages[0].text, /🔒 單個存貨成本：NT\$23～NT\$24\.50／個/);
  assert.match(replies[3].messages[0].text, /💰 ERP 售價：NT\$35～NT\$38\.50／個/);
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

test("warehouse position wizard uses buttons to build B warehouse preview without storing or writing", async () => {
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
        variants: [{ location: "02-L02-03/T4", style: "紅色", size: "大", barcode: "A861-01", available: 12 }],
      }],
    }),
  }));
  const before = structuredClone([...values.entries()]);
  const replies = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url === "https://api.line.me/v2/bot/info") {
      return Response.json({ basicId: "@059hdfyo", displayName: "廣告文案小幫手" });
    }
    if (url === "https://api.line.me/v2/bot/message/reply") {
      replies.push(JSON.parse(init.body));
      return new Response("OK");
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  const env = {
    LINE_CHANNEL_ACCESS_TOKEN: "wizard-line-token",
    LINE_ACTIVATION: {
      idFromName(name) { return name; },
      get() { return { fetch(input, init) { return object.fetch(new Request(input, init)); } }; },
    },
  };
  const eventBase = {
    timestamp: Date.now(),
    source: { type: "user", userId: "owner-user" },
  };
  const press = async (label) => {
    const message = replies.at(-1).messages[0];
    const item = message.quickReply.items.find((candidate) => candidate.action.label === label);
    assert.ok(item, `missing quick reply button: ${label}`);
    await processLineEvent({
      ...eventBase,
      type: "postback",
      replyToken: `wizard-${replies.length}`,
      postback: { data: item.action.data },
    }, env);
  };
  try {
    await processLineEvent({
      ...eventBase,
      type: "message",
      replyToken: "wizard-start",
      message: { type: "text", text: "改儲位 A861" },
    }, env);
    assert.deepEqual(replies.at(-1).messages[0].quickReply.items.map((item) => item.action.label), ["A倉", "B倉", "取消"]);

    await press("A倉");
    assert.match(replies.at(-1).messages[0].text, /A倉目前尚未開放/);
    await press("B倉");
    assert.deepEqual(replies.at(-1).messages[0].quickReply.items.slice(0, 6).map((item) => item.action.label), ["01", "02", "03", "04", "05", "06"]);
    await press("02");
    assert.deepEqual(replies.at(-1).messages[0].quickReply.items.slice(0, 2).map((item) => item.action.label), ["左邊 L", "右邊 R"]);
    await press("右邊 R");
    assert.deepEqual(replies.at(-1).messages[0].quickReply.items.slice(0, 5).map((item) => item.action.label), ["R01", "R02", "R03", "R04", "R05"]);
    await press("R04");
    assert.deepEqual(replies.at(-1).messages[0].quickReply.items.slice(0, 4).map((item) => item.action.label), ["01", "02", "03", "04"]);
    await press("01");
    assert.deepEqual(replies.at(-1).messages[0].quickReply.items.slice(0, 5).map((item) => item.action.label), ["T1", "T2", "T3", "T4", "無 T"]);
    await press("無 T");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.match(replies.at(-1).messages[0].text, /儲位修改演練（不會寫入 ERP）/);
  assert.match(replies.at(-1).messages[0].text, /原儲位：02-L02-03\/T4/);
  assert.match(replies.at(-1).messages[0].text, /預計新儲位：02-R04-01(?:\n|$)/);
  assert.doesNotMatch(replies.at(-1).messages[0].text, /預計新儲位：02-R04-01\/T/);
  assert.deepEqual([...values.entries()], before, "wizard must not persist selections or change warehouse storage");
});

test("warehouse position wizard asks for actual child SKU first and previews all variants without writing", async () => {
  const originalFetch = globalThis.fetch;
  const values = new Map();
  const object = new LineActivation({
    storage: {
      async put(key, value) { values.set(key, structuredClone(value)); },
      async get(key) { return values.has(key) ? structuredClone(values.get(key)) : undefined; },
      async delete(key) { values.delete(key); },
    },
  });
  const variants = Array.from({ length: 6 }, (_, index) => ({
    location: `01-L01-0${(index % 4) + 1}/T${(index % 4) + 1}`,
    style: `款式${index + 1}`,
    size: "",
    barcode: `A823-0${index + 1}`,
    available: index + 1,
  }));
  await object.fetch(new Request("https://line-schedule/warehouse-locations/sync", {
    method: "POST",
    body: JSON.stringify({
      updatedAt: new Date().toISOString(),
      warehouseId: 1,
      warehouseName: "主倉",
      items: [{ sku: "A823", name: "多規格測試商品", available: 21, variants }],
    }),
  }));
  const before = structuredClone([...values.entries()]);
  const replies = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url === "https://api.line.me/v2/bot/info") {
      return Response.json({ basicId: "@059hdfyo", displayName: "廣告文案小幫手" });
    }
    if (url === "https://api.line.me/v2/bot/message/reply") {
      replies.push(JSON.parse(init.body));
      return new Response("OK");
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  const env = {
    LINE_CHANNEL_ACCESS_TOKEN: "multi-wizard-line-token",
    LINE_ACTIVATION: {
      idFromName(name) { return name; },
      get() { return { fetch(input, init) { return object.fetch(new Request(input, init)); } }; },
    },
  };
  const eventBase = { timestamp: Date.now(), source: { type: "user", userId: "owner-user" } };
  const press = async (label) => {
    const message = replies.at(-1).messages[0];
    const item = message.quickReply.items.find((candidate) => candidate.action.label === label);
    assert.ok(item, `missing quick reply button: ${label}`);
    await processLineEvent({
      ...eventBase,
      type: "postback",
      replyToken: `multi-wizard-${replies.length}`,
      postback: { data: item.action.data },
    }, env);
  };
  try {
    await processLineEvent({
      ...eventBase,
      type: "message",
      replyToken: "multi-wizard-start",
      message: { type: "text", text: "改儲位 A823" },
    }, env);
    assert.deepEqual(replies.at(-1).messages[0].quickReply.items.map((item) => item.action.label), [
      "-01", "-02", "-03", "-04", "-05", "-06", "全部", "取消",
    ]);
    await press("全部");
    assert.deepEqual(replies.at(-1).messages[0].quickReply.items.slice(0, 3).map((item) => item.action.label), [
      "A倉", "B倉", "重選子貨號",
    ]);
    await press("B倉");
    await press("02");
    await press("右邊 R");
    await press("R04");
    await press("01");
    await press("T1");
  } finally {
    globalThis.fetch = originalFetch;
  }
  const preview = replies.at(-1).messages[0].text;
  assert.match(preview, /全部子貨號儲位修改演練（不會寫入 ERP）/);
  assert.match(preview, /子貨號數：6/);
  assert.match(preview, /A823-01｜.* → 02-R04-01\/T1/);
  assert.match(preview, /A823-06｜.* → 02-R04-01\/T1/);
  assert.match(preview, /沒有呼叫 ERP 寫入/);
  assert.deepEqual([...values.entries()], before, "multi-variant wizard must remain read-only and stateless");
});

test("warehouse menu prompt accepts a private SKU for eight seconds and expires safely", async () => {
  const originalFetch = globalThis.fetch;
  const scheduleValues = new Map();
  const schedule = new LineActivation({
    storage: {
      async put(key, value) { scheduleValues.set(key, structuredClone(value)); },
      async get(key) { return scheduleValues.has(key) ? structuredClone(scheduleValues.get(key)) : undefined; },
      async delete(key) { scheduleValues.delete(key); },
    },
  });
  await schedule.fetch(new Request("https://line-schedule/warehouse-locations/sync", {
    method: "POST",
    body: JSON.stringify({
      updatedAt: new Date().toISOString(),
      warehouseId: 1,
      warehouseName: "主倉",
      items: [{
        sku: "A823",
        name: "選單測試商品",
        available: 6,
        variants: [
          { location: "01-L01-01/T1", barcode: "A823-01", available: 3 },
          { location: "01-L01-01/T2", barcode: "A823-02", available: 3 },
        ],
      }],
    }),
  }));
  const before = structuredClone([...scheduleValues.entries()]);
  const promptObjects = new Map();
  const replies = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url === "https://api.line.me/v2/bot/info") {
      return Response.json({ basicId: "@059hdfyo", displayName: "廣告文案小幫手" });
    }
    if (url === "https://api.line.me/v2/bot/message/reply") {
      replies.push(JSON.parse(init.body));
      return new Response("OK");
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  const env = {
    LINE_CHANNEL_ACCESS_TOKEN: "menu-prompt-line-token",
    LINE_ACTIVATION: {
      idFromName(name) { return name; },
      get(name) {
        if (name === "line-schedule:global-v1") {
          return { fetch(input, init) { return schedule.fetch(new Request(input, init)); } };
        }
        if (!promptObjects.has(name)) {
          const values = new Map();
          promptObjects.set(name, {
            values,
            object: new LineActivation({
              storage: {
                async put(key, value) { values.set(key, structuredClone(value)); },
                async get(key) { return values.has(key) ? structuredClone(values.get(key)) : undefined; },
                async delete(key) { values.delete(key); },
              },
            }),
          });
        }
        const entry = promptObjects.get(name);
        return { fetch(input, init) { return entry.object.fetch(new Request(input, init)); } };
      },
    },
  };
  const privateSource = { type: "user", userId: "menu-owner" };
  try {
    await processLineEvent({
      type: "message",
      replyToken: "menu-prompt",
      timestamp: 10_000,
      source: privateSource,
      message: { type: "text", text: "改儲位" },
    }, env);
    assert.match(replies.at(-1).messages[0].text, /請在 8 秒內回覆貨號/);

    await processLineEvent({
      type: "message",
      replyToken: "menu-sku-valid",
      timestamp: 18_000,
      source: privateSource,
      message: { type: "text", text: "a823" },
    }, env);
    assert.deepEqual(replies.at(-1).messages[0].quickReply.items.slice(0, 3).map((item) => item.action.label), [
      "-01", "-02", "全部",
    ]);

    await processLineEvent({
      type: "message",
      replyToken: "menu-prompt-expiring",
      timestamp: 20_000,
      source: privateSource,
      message: { type: "text", text: "改儲位" },
    }, env);
    await processLineEvent({
      type: "message",
      replyToken: "menu-sku-expired",
      timestamp: 28_001,
      source: privateSource,
      message: { type: "text", text: "A823" },
    }, env);
    assert.match(replies.at(-1).messages[0].text, /已超過 8 秒/);
    assert.match(replies.at(-1).messages[0].text, /本次沒有寫入 ERP/);

    await processLineEvent({
      type: "message",
      replyToken: "menu-group-blocked",
      timestamp: 30_000,
      source: { type: "group", groupId: "g1", userId: "menu-owner" },
      message: { type: "text", text: "改儲位" },
    }, env);
    assert.match(replies.at(-1).messages[0].text, /只能在 @059hdfyo 私訊中使用/);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual([...scheduleValues.entries()], before, "menu prompt and timeout must not change warehouse data");
  assert.ok([...promptObjects.values()].every((entry) => entry.values.size === 0), "one-time prompt state must be consumed");
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

test("private LINE users can page through ERP-known storage locations while groups receive no inventory list", async () => {
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
      warehouseName: "主倉",
      items: [
        ...Array.from({ length: 12 }, (_, index) => ({
          sku: `P${index + 1}`,
          name: `儲位商品 ${index + 1}`,
          available: index - 1,
          variants: [{
            location: "04-R05-02/T5",
            style: `款 ${index + 1}`,
            size: "",
            barcode: `P${index + 1}-01`,
            available: index - 1,
          }],
        })),
        ...Array.from({ length: 12 }, (_, index) => ({
          sku: `ARITEM${index + 1}`,
          name: `AR 儲位商品 ${index + 1}`,
          available: index + 1,
          variants: [{
            location: "AR01-03",
            style: `AR 款 ${index + 1}`,
            size: "",
            barcode: `ARITEM${index + 1}-01`,
            available: index + 1,
          }],
        })),
      ],
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
      get() { return { fetch(input, init) { return object.fetch(new Request(input, init)); } }; },
    },
  };
  try {
    await processLineEvent({
      type: "message",
      replyToken: "storage-location-private",
      timestamp: Date.now(),
      source: { type: "user", userId: "owner-user" },
      message: { type: "text", text: "儲位 04-R05-02/T5" },
    }, env);
    assert.equal(replies.length, 1);
    assert.match(replies[0].messages[0].text, /是否顯示無庫存品項/);
    assert.deepEqual(
      replies[0].messages[0].quickReply.items.map((item) => item.action.label),
      ["只看有庫存", "顯示無庫存"],
    );
    const showUnavailableData = replies[0].messages[0].quickReply.items[1].action.data;

    await processLineEvent({
      type: "postback",
      replyToken: "storage-location-show-unavailable",
      timestamp: Date.now(),
      source: { type: "user", userId: "owner-user" },
      postback: { data: showUnavailableData },
    }, env);
    assert.equal(replies.length, 2);
    assert.match(replies[1].messages[0].text, /共 12 個貨號、12 個品項｜第 1\/2 頁/);
    assert.match(replies[1].messages[0].text, /篩選：顯示無庫存/);
    assert.match(replies[1].messages[0].text, /1\. P1｜儲位商品 1/);
    assert.match(replies[1].messages[0].text, /⚠️ 可用 -1/);
    assert.doesNotMatch(replies[1].messages[0].text, /成本|售價/);
    const nextPageData = replies[1].messages[0].quickReply.items[0].action.data;

    await processLineEvent({
      type: "message",
      replyToken: "storage-location-group",
      timestamp: Date.now(),
      source: { type: "group", groupId: "g1", userId: "owner-user" },
      message: { type: "text", text: "04-R05-02/T5" },
    }, env);
    assert.equal(replies.length, 2, "physical storage-location inventory must stay private by default");

    await processLineEvent({
      type: "postback",
      replyToken: "storage-location-page-2",
      timestamp: Date.now(),
      source: { type: "user", userId: "owner-user" },
      postback: { data: nextPageData },
    }, env);
    assert.equal(replies.length, 3);
    assert.match(replies[2].messages[0].text, /第 2\/2 頁/);
    assert.match(replies[2].messages[0].text, /11\. P11｜儲位商品 11/);
    assert.match(replies[2].messages[0].text, /篩選：顯示無庫存/);
    assert.deepEqual(replies[2].messages[0].quickReply.items.map((item) => item.action.label), ["⬅️ 上一頁"]);

    await processLineEvent({
      type: "message",
      replyToken: "storage-location-available-only-command",
      timestamp: Date.now(),
      source: { type: "user", userId: "owner-user" },
      message: { type: "text", text: "04-R05-02/T5 只看有庫存" },
    }, env);
    assert.equal(replies.length, 4);
    assert.match(replies[3].messages[0].text, /共 10 個貨號、10 個有庫存品項｜第 1\/1 頁/);
    assert.match(replies[3].messages[0].text, /篩選：只看有庫存/);
    assert.doesNotMatch(replies[3].messages[0].text, /⚠️ 可用/);

    await processLineEvent({
      type: "message",
      replyToken: "erp-known-location-bare",
      timestamp: Date.now(),
      source: { type: "user", userId: "owner-user" },
      message: { type: "text", text: "AR01-03" },
    }, env);
    assert.equal(replies.length, 5);
    assert.match(replies[4].messages[0].text, /📍 主倉｜AR01-03/);
    assert.match(replies[4].messages[0].text, /是否顯示無庫存品項/);

    await processLineEvent({
      type: "message",
      replyToken: "erp-known-location-prefixed",
      timestamp: Date.now(),
      source: { type: "user", userId: "owner-user" },
      message: { type: "text", text: "儲位 ar01-03 顯示無庫存" },
    }, env);
    assert.equal(replies.length, 6);
    assert.match(replies[5].messages[0].text, /📍 主倉｜AR01-03/);
    assert.match(replies[5].messages[0].text, /共 12 個貨號、12 個品項｜第 1\/2 頁/);
    const arNextPageData = replies[5].messages[0].quickReply.items[0].action.data;

    await processLineEvent({
      type: "postback",
      replyToken: "erp-known-location-page-2",
      timestamp: Date.now(),
      source: { type: "user", userId: "owner-user" },
      postback: { data: arNextPageData },
    }, env);
    assert.equal(replies.length, 7);
    assert.match(replies[6].messages[0].text, /第 2\/2 頁/);
    assert.match(replies[6].messages[0].text, /11\. ARITEM11｜AR 儲位商品 11/);

    await processLineEvent({
      type: "message",
      replyToken: "erp-known-location-group",
      timestamp: Date.now(),
      source: { type: "group", groupId: "g1", userId: "owner-user" },
      message: { type: "text", text: "AR01-03" },
    }, env);
    assert.equal(replies.length, 7, "ERP-known storage locations must stay private even with an unrecognized shape");

    await processLineEvent({
      type: "message",
      replyToken: "unknown-location-falls-back-to-sku",
      timestamp: Date.now(),
      source: { type: "user", userId: "owner-user" },
      message: { type: "text", text: "AR99-99" },
    }, env);
    assert.equal(replies.length, 8);
    assert.match(replies[7].messages[0].text, /ERP 主倉查無此貨號/);
  } finally {
    globalThis.fetch = originalFetch;
  }
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
