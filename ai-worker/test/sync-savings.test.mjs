import assert from "node:assert/strict";
import test from "node:test";
import { LineActivation } from "../src/index.js";
import { loadSnapshot } from "../src/snapshot-blocks.js";

const at = (minute) => `2026-09-26T00:${String(minute).padStart(2, "0")}:00Z`;

function fixture(initial = []) {
  const values = new Map(initial);
  const calls = [];
  const faults = { put: null };
  const storage = {
    async get(key) { return structuredClone(values.get(key)); },
    async put(key, value) {
      calls.push(["put", key]);
      if (faults.put?.(key, value)) throw new Error("injected storage failure");
      values.set(key, structuredClone(value));
    },
    async delete(key) {
      calls.push(["delete", key]);
      values.delete(key);
    },
  };
  const object = new LineActivation({ storage });
  async function post(path, body) {
    const response = await object.fetch(new Request(`https://line-schedule${path}`, {
      method: "POST", body: JSON.stringify(body),
    }));
    return { status: response.status, data: await response.json() };
  }
  const active = (kind) => loadSnapshot(storage, values.get(`${kind}-active`));
  return { values, calls, faults, storage, object, post, active };
}

function warehouse(items, minute = 0) {
  return { updatedAt: at(minute), warehouseId: 1, warehouseName: "主倉", items };
}

function stock(sku, available, location = "A區-01") {
  return { sku, name: `${sku} 測試商品`, available,
    variants: [{ location, style: "標準", barcode: `${sku}-01`, available }] };
}

function order(transactionNo, status = "新訂單", sku = "A817-01", alias = `SHOP-${transactionNo}`) {
  const item = { sku, name: "測試商品", quantity: 1, unitPrice: 10 };
  return { transactionNo, status, platformOrderNumbers: [alias],
    printableOrderNumbers: [`0350000-${transactionNo}`], items: [item] };
}

async function success(f, path, payload) {
  const result = await f.post(path, payload);
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.ok, true);
  return result.data;
}

async function queryOrder(f, query) {
  const result = await f.post("/erp-orders/query", { query });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  return result.data.order;
}

async function queryStatus(f, sku, status) {
  const result = await f.post("/erp-orders/query-sku-status", { sku, status });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  return result.data;
}

test("warehouse and order heartbeat refresh only active metadata, preserving version and data refs", async () => {
  const f = fixture();
  const items = [stock("G831", 8)];
  const orders = [{ ...order("10760001"), lastSeenAt: at(0) }];
  for (const [kind, path, makePayload] of [
    ["warehouse-location", "/warehouse-locations/sync", (minute) => warehouse(items, minute)],
    ["erp-order", "/erp-orders/sync", (minute) => ({ updatedAt: at(minute), orders: orders.map((entry) => ({ ...entry, lastSeenAt: at(minute) })) })],
  ]) {
    await success(f, path, makePayload(0));
    const before = await f.active(kind);
    f.calls.length = 0;
    const result = await success(f, path, makePayload(1));
    const after = await f.active(kind);
    assert.equal(result.unchanged, true);
    assert.equal(result.syncStats.writtenBlocks, 0);
    assert.equal(after.version, before.version);
    assert.equal(after.updatedAt, at(1));
    assert.deepEqual(after.blockRefs, before.blockRefs);
    assert.deepEqual(f.calls, [["put", `${kind}-active`]]);
  }
});

test("one warehouse quantity change updates direct, search and reverse reads while reusing search block", async () => {
  const f = fixture();
  const first = [stock("G831", 8), stock("A100", 3, "B區-02")];
  await success(f, "/warehouse-locations/sync", warehouse(first, 0));
  const a = await f.active("warehouse-location");
  const searchKey = a.blockRefs["warehouse-location-search:0"].key;
  const changed = [stock("G831", 12), first[1]];
  await success(f, "/warehouse-locations/sync", warehouse(changed, 1));
  const b = await f.active("warehouse-location");
  assert.notEqual(b.version, a.version);
  assert.equal(b.blockRefs["warehouse-location-search:0"].key, searchKey);
  assert.equal((await f.post("/warehouse-locations/query", { sku: "G831", includeImage: false })).data.item.available, 12);
  const search = await f.post("/warehouse-locations/search", { keyword: "G831" });
  assert.equal(search.data.items[0].available, 12);
  const reverse = await f.post("/warehouse-locations/query-storage-location", { location: "A區-01" });
  assert.equal(reverse.data.totalCount, 1);
  assert.equal(reverse.data.items[0].available, 12);
  assert.equal((await f.post("/warehouse-locations/query", { sku: "A100", includeImage: false })).data.item.available, 3);
});

test("status, SKU and alias changes remove stale order index entries", async () => {
  const f = fixture();
  await success(f, "/erp-orders/sync", { updatedAt: at(0), orders: [order("10760001", "新訂單", "A817-01", "OLD-ALIAS")] });
  assert.equal((await queryOrder(f, "OLD-ALIAS")).transactionNo, "10760001");
  assert.equal((await queryStatus(f, "A817", "新訂單")).totalCount, 1);
  await success(f, "/erp-orders/sync", { updatedAt: at(1), orders: [order("10760001", "可出貨", "B900-02", "NEW-ALIAS")] });
  assert.equal(await queryOrder(f, "OLD-ALIAS"), null);
  assert.equal((await queryOrder(f, "NEW-ALIAS")).transactionNo, "10760001");
  assert.equal((await queryStatus(f, "A817", "新訂單")).totalCount, 0);
  assert.equal((await queryStatus(f, "B900", "可出貨")).totalCount, 1);
  await success(f, "/erp-orders/sync", { updatedAt: at(2), orders: [order("10760002", "出貨中", "C100-01", "THIRD-ALIAS")] });
  assert.equal(await queryOrder(f, "NEW-ALIAS"), null);
  assert.equal((await queryStatus(f, "B900", "可出貨")).totalCount, 0);
  assert.equal((await queryStatus(f, "C100", "出貨中")).totalCount, 1);
});

test("large order re-chunking keeps every alias and SKU-status lookup correct", async () => {
  const f = fixture();
  const makeLarge = (i) => {
    const transactionNo = String(10770000 + i);
    const sku = `A${800 + i}-01`;
    return {
      ...order(transactionNo, "新訂單", sku, `SHOP-${transactionNo}`),
      items: Array.from({ length: 8 }, (_, n) => ({
        sku, name: `商品 ${i} ${n} ${"測".repeat(190)}`,
        style: `規格 ${n} ${"長".repeat(70)}`, quantity: 1, unitPrice: 10,
      })),
    };
  };
  const original = Array.from({ length: 96 }, (_, i) => makeLarge(i + 1));
  await success(f, "/erp-orders/sync", { updatedAt: at(0), orders: original });
  const a = await f.active("erp-order");
  assert.ok(a.chunkCount > 1);
  const storedBytes = Array.from({ length: a.chunkCount }, (_, i) =>
    Buffer.byteLength(JSON.stringify(f.values.get(a.blockRefs[`erp-order:${i}`].key))))
    .reduce((sum, size) => sum + size, 0);
  assert.ok(storedBytes > 496 * 1024, `stored order chunks must exceed 496 KiB; got ${storedBytes}`);
  await success(f, "/erp-orders/sync", { updatedAt: at(1), orders: [makeLarge(0), ...original] });
  const b = await f.active("erp-order");
  assert.ok(b.chunkCount > 1);
  assert.ok(Array.from({ length: Math.min(a.chunkCount, b.chunkCount) }, (_, i) =>
    a.blockRefs[`erp-order:${i}`].key !== b.blockRefs[`erp-order:${i}`].key).some(Boolean),
  "inserting the first order must change at least one chunk position");
  for (const entry of [makeLarge(0), ...original]) {
    for (const alias of [entry.transactionNo, entry.printableOrderNumbers[0], entry.platformOrderNumbers[0]]) {
      assert.equal((await queryOrder(f, alias))?.transactionNo, entry.transactionNo);
    }
    assert.equal((await queryStatus(f, entry.items[0].sku, "新訂單")).totalCount, 1);
  }
});

for (const failurePoint of ["block", "active"]) {
  test(`failed ${failurePoint} publication preserves old order and warehouse API reads and retries`, async () => {
    for (const kind of ["warehouse", "orders"]) {
      const f = fixture();
      const path = kind === "warehouse" ? "/warehouse-locations/sync" : "/erp-orders/sync";
      const oldPayload = kind === "warehouse" ? warehouse([stock("G831", 8)], 0)
        : { updatedAt: at(0), orders: [order("10760001")] };
      const newPayload = kind === "warehouse" ? warehouse([stock("G831", 12)], 1)
        : { updatedAt: at(1), orders: [order("10760002")] };
      await success(f, path, oldPayload);
      const before = structuredClone([...f.values]);
      const activeKey = kind === "warehouse" ? "warehouse-location-active" : "erp-order-active";
      let stagedBlocks = 0;
      f.faults.put = (key) => failurePoint === "active" ? key === activeKey
        : key.startsWith(`${activeKey}:block:`) && ++stagedBlocks === 2;
      const failed = await f.post(path, newPayload);
      assert.equal(failed.status, 503);
      assert.deepEqual([...f.values], before);
      if (kind === "warehouse") {
        assert.equal((await f.post("/warehouse-locations/query", { sku: "G831", includeImage: false })).data.item.available, 8);
        assert.equal((await f.post("/warehouse-locations/search", { keyword: "G831" })).data.items[0].available, 8);
        assert.equal((await f.post("/warehouse-locations/query-storage-location", { location: "A區-01" })).data.items[0].available, 8);
      } else {
        assert.equal((await queryOrder(f, "10760001"))?.transactionNo, "10760001");
        assert.equal(await queryOrder(f, "10760002"), null);
        assert.equal((await queryStatus(f, "A817", "新訂單")).totalCount, 1);
      }
      f.faults.put = null;
      await success(f, path, newPayload);
      if (kind === "warehouse") {
        assert.equal((await f.post("/warehouse-locations/query", { sku: "G831", includeImage: false })).data.item.available, 12);
      } else {
        assert.equal((await queryOrder(f, "10760002"))?.transactionNo, "10760002");
      }
    }
  });
}

test("three generations retain shared refs and one complete fallback, then collect retired keys", async () => {
  const f = fixture();
  const unchanged = stock("A100", 3, "B區-02");
  await success(f, "/warehouse-locations/sync", warehouse([stock("G831", 8), unchanged], 0));
  const a = await f.active("warehouse-location");
  await success(f, "/warehouse-locations/sync", warehouse([stock("G831", 12), unchanged], 1));
  const b = await f.active("warehouse-location");
  await success(f, "/warehouse-locations/sync", warehouse([stock("G831", 15), unchanged], 2));
  const c = await f.active("warehouse-location");
  assert.equal(c.previousSnapshot.version, b.version);
  assert.equal(c.previousSnapshot.previousSnapshot, undefined);
  const stableSlot = Object.keys(a.blockRefs).find((slot) => slot.startsWith("warehouse-location:")
    && f.values.get(a.blockRefs[slot].key)?.A100
    && a.blockRefs[slot].key === b.blockRefs[slot]?.key && b.blockRefs[slot]?.key === c.blockRefs[slot]?.key);
  assert.ok(stableSlot);
  assert.equal(f.values.has(a.blockRefs[stableSlot].key), true);
  const retired = Object.values(a.blockRefs).map((ref) => ref.key)
    .filter((key) => !Object.values(b.blockRefs).some((ref) => ref.key === key)
      && !Object.values(c.blockRefs).some((ref) => ref.key === key));
  assert.ok(retired.length);
  for (const key of retired) assert.equal(f.values.has(key), false);
  assert.equal((await f.post("/warehouse-locations/query", { sku: "G831", includeImage: false })).data.item.available, 15);
  f.values.set("warehouse-location-active", c.previousSnapshot);
  assert.equal((await f.post("/warehouse-locations/query", { sku: "G831", includeImage: false })).data.item.available, 12);
  assert.equal((await f.post("/warehouse-locations/search", { keyword: "G831" })).data.items[0].available, 12);
  assert.equal((await f.post("/warehouse-locations/query-storage-location", { location: "A區-01" })).data.items[0].available, 12);
});

for (const indexFormat of [undefined, 2]) {
  test(`legacy ${indexFormat || 1} order snapshot remains readable across first replacement`, async () => {
    const version = `legacy-${indexFormat || 1}`;
    const transactionNo = "10760001";
    const aliasBucketCount = 128;
    const bucket = (() => {
      let hash = 2166136261;
      for (const char of transactionNo) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 16777619); }
      return (hash >>> 0) % aliasBucketCount;
    })();
    const old = { version, updatedAt: at(0), orderCount: 1, aliasCount: 1, chunkCount: 1, aliasBucketCount,
      ...(indexFormat === 2 ? { indexFormat, aliasChunkCounts: Array.from({ length: 128 }, (_, i) => Number(i === bucket)) } : {}) };
    const aliasKey = `erp-order-alias:${version}:${bucket}${indexFormat === 2 ? ":0" : ""}`;
    const f = fixture([
      ["erp-order-active", old],
      [`erp-order:${version}:0`, { [transactionNo]: order(transactionNo) }],
      [aliasKey, { [transactionNo]: { transactionNo, chunkIndex: 0 } }],
    ]);
    assert.equal((await queryOrder(f, transactionNo))?.transactionNo, transactionNo);
    await success(f, "/erp-orders/sync", { updatedAt: at(1), orders: [order("10760002")] });
    const next = await f.active("erp-order");
    assert.equal(next.previousSnapshot.version, version);
    assert.equal((await queryOrder(f, "10760002"))?.transactionNo, "10760002");
    f.values.set("erp-order-active", next.previousSnapshot);
    assert.equal((await queryOrder(f, transactionNo))?.transactionNo, transactionNo);
  });
}

test("empty warehouse and order syncs reject without touching a published snapshot", async () => {
  const f = fixture();
  await success(f, "/warehouse-locations/sync", warehouse([stock("G831", 8)], 0));
  await success(f, "/erp-orders/sync", { updatedAt: at(0), orders: [order("10760001")] });
  const before = structuredClone([...f.values]);
  assert.equal((await f.post("/warehouse-locations/sync", warehouse([], 1))).status, 400);
  assert.equal((await f.post("/erp-orders/sync", { updatedAt: at(1), orders: [] })).status, 400);
  assert.deepEqual([...f.values], before);
});
