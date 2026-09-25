import assert from "node:assert/strict";
import test from "node:test";
import { loadSnapshot, publishSnapshot, resolveSnapshotKey, snapshotValueHash, stableSerialize } from "../src/snapshot-blocks.js";

function fixture(initial = []) {
  const values = new Map(initial);
  const calls = [];
  const faults = { put: null, delete: null };
  const storage = {
    async get(key) { return structuredClone(values.get(key)); },
    async put(key, value) {
      calls.push(["put", key]);
      if (faults.put?.(key, value)) throw new Error("injected put failure");
      values.set(key, structuredClone(value));
    },
    async delete(key) {
      calls.push(["delete", key]);
      if (faults.delete?.(key)) throw new Error("injected delete failure");
      return values.delete(key);
    },
  };
  const push = async (entries, minute, extra = {}) => {
    const result = await publishSnapshot(storage, {
    activeKey: "test-active",
    metadata: { count: entries.length, updatedAt: `2026-09-26T00:${String(minute).padStart(2, "0")}:00Z` },
    blocks: entries.map(([slot, value]) => ({ slot, value })),
    ...extra,
    });
    return { ...result, metadata: await loadSnapshot(storage, result.metadata) };
  };
  return { values, calls, faults, storage, push };
}

test("canonical hashes ignore object key insertion order and preserve array order", async () => {
  assert.equal(await snapshotValueHash({ b: 2, a: [1, { z: "甲", c: true }] }),
    await snapshotValueHash({ a: [1, { c: true, z: "甲" }], b: 2 }));
  assert.notEqual(await snapshotValueHash([1, 2]), await snapshotValueHash([2, 1]));
  assert.equal(stableSerialize({ a: undefined, b: [undefined] }), '{"b":[null]}');
  assert.throws(() => stableSerialize({ value: Infinity }), /NON_FINITE/);
  const cyclic = {}; cyclic.self = cyclic;
  assert.throws(() => stableSerialize(cyclic), /CIRCULAR/);
});

test("unchanged blocks keep the version and refresh freshness with exactly one put", async () => {
  const f = fixture();
  const first = await f.push([["product:0", { sku: "G831", available: 2 }]], 0);
  f.calls.length = 0;
  const second = await f.push([["product:0", { available: 2, sku: "G831" }]], 10);
  assert.equal(second.changed, false);
  assert.equal(second.writtenBlocks, 0);
  assert.equal(second.reusedBlocks, 1);
  assert.equal(second.metadata.version, first.metadata.version);
  assert.equal(second.metadata.updatedAt, "2026-09-26T00:10:00Z");
  assert.deepEqual(f.calls, [["put", "test-active"]]);
});

test("three changed rounds retain shared blocks and one complete fallback, reclaim only retired keys", async () => {
  const f = fixture();
  const a = await f.push([["stock", { quantity: 1 }], ["name", { name: "測試" }]], 0);
  const b = await f.push([["stock", { quantity: 2 }], ["name", { name: "測試" }]], 10);
  assert.equal(b.writtenBlocks, 1);
  assert.equal(b.metadata.previousSnapshot.version, a.metadata.version);
  const c = await f.push([["stock", { quantity: 3 }], ["name", { name: "測試" }]], 20);
  const commonKey = a.metadata.blockRefs.name.key;
  assert.equal(c.metadata.blockRefs.name.key, commonKey);
  assert.equal((await loadSnapshot(f.storage, c.metadata.previousSnapshot)).blockRefs.name.key, commonKey);
  assert.equal(c.metadata.previousSnapshot.previousSnapshot, undefined);
  assert.equal(f.values.has(commonKey), true);
  assert.equal(f.values.has(a.metadata.blockRefs.stock.key), false);
  assert.equal(f.values.has(b.metadata.blockRefs.stock.key), true);
  assert.equal(f.values.has(c.metadata.blockRefs.stock.key), true);
  assert.equal(c.deletedBlocks, 2, "one retired data block and its old reference page are reclaimed");
});

test("removed slots disappear from active but remain available for the fallback generation", async () => {
  const f = fixture();
  const a = await f.push([["keep", 1], ["remove", 2]], 0);
  const b = await f.push([["keep", 1]], 10);
  assert.equal(b.metadata.blockRefs.remove, undefined);
  assert.equal(f.values.has(a.metadata.blockRefs.remove.key), true);
  await f.push([["keep", 3]], 20);
  assert.equal(f.values.has(a.metadata.blockRefs.remove.key), false);
});

for (const atActive of [false, true]) {
  test(`a failure at ${atActive ? "active publication" : "a data block"} preserves the complete prior snapshot`, async () => {
    const f = fixture();
    const a = await f.push([["first", 1], ["second", 2]], 0);
    const before = structuredClone([...f.values]);
    f.faults.put = (key) => atActive ? key === "test-active" : key.endsWith(":1");
    await assert.rejects(f.push([["first", 3], ["second", 4]], 10), /injected put/);
    assert.deepEqual([...f.values], before);
    assert.equal(f.values.get("test-active").version, a.metadata.version);
    f.faults.put = null;
    const retry = await f.push([["first", 3], ["second", 4]], 10);
    assert.equal(retry.changed, true);
    assert.equal(retry.metadata.previousSnapshot.version, a.metadata.version);
  });
}

test("an ambiguous successful active put never rolls back its published data", async () => {
  const f = fixture();
  await f.push([["stock", 1]], 0);
  const put = f.storage.put;
  f.storage.put = async (key, value) => {
    await put(key, value);
    if (key === "test-active") throw new Error("lost acknowledgement");
  };
  await assert.rejects(f.push([["stock", 2]], 10), /lost acknowledgement/);
  const active = await loadSnapshot(f.storage, f.values.get("test-active"));
  assert.equal(f.values.get(active.blockRefs.stock.key), 2);
});

test("manifest publication failure rolls back staged blocks without touching active or fallback", async () => {
  const f = fixture();
  await f.push([["stock", 1]], 0);
  const before = structuredClone([...f.values]);
  f.faults.put = (key) => key.includes(":manifest:");
  await assert.rejects(f.push([["stock", 2]], 10), /injected put/);
  assert.deepEqual([...f.values], before);
});

test("metadata overflow and duplicate slots are rejected before any write", async () => {
  const f = fixture();
  await assert.rejects(f.push([["stock", 1]], 0, { metadata: { huge: "x".repeat(128 * 1024) } }), /METADATA_TOO_LARGE/);
  await assert.rejects(f.push([["stock", 1], ["stock", 2]], 0), /DUPLICATE_SLOT/);
  assert.equal(f.calls.length, 0);
});

test("legacy keys are reused without rewriting, then collected only after leaving both snapshots", async () => {
  const old = { version: "legacy", count: 1, updatedAt: "2026-09-26T00:00:00Z" };
  const f = fixture([["test-active", old], ["legacy:data:0", { quantity: 1 }]]);
  const opts = { legacyKeys: (meta) => meta.version === "legacy" ? ["legacy:data:0"] : [] };
  const adopted = await f.push([["stock", { quantity: 1 }]], 10, {
    ...opts, blocks: [{ slot: "stock", value: { quantity: 1 }, legacyKey: "legacy:data:0" }],
  });
  assert.equal(adopted.writtenBlocks, 0);
  assert.equal(adopted.metadata.version, "legacy");
  assert.equal(adopted.metadata.blockRefs.stock.key, "legacy:data:0");
  await f.push([["stock", { quantity: 2 }]], 20, opts);
  assert.equal(f.values.has("legacy:data:0"), true);
  await f.push([["stock", { quantity: 3 }]], 30, opts);
  assert.equal(f.values.has("legacy:data:0"), false);
});

test("cleanup failures do not undo publication and are retried on the next refresh", async () => {
  const f = fixture();
  const a = await f.push([["stock", 1]], 0);
  await f.push([["stock", 2]], 10);
  f.faults.delete = (key) => key === a.metadata.blockRefs.stock.key;
  const c = await f.push([["stock", 3]], 20);
  assert.equal(c.cleanupFailed, 1);
  assert.equal(f.values.get("test-active").version, c.metadata.version);
  assert.equal(c.metadata.pendingGarbagePages.length, 1);
  assert.ok(f.values.get(c.metadata.pendingGarbagePages[0].key).keys.includes(a.metadata.blockRefs.stock.key));
  f.faults.delete = null;
  const refresh = await f.push([["stock", 3]], 30);
  assert.equal(refresh.changed, false);
  assert.equal(refresh.deletedBlocks, 1);
  assert.equal(f.values.has(a.metadata.blockRefs.stock.key), false);
});

test("small inline reference snapshots remain readable and upgrade to manifest pages without data writes", async () => {
  const value = { quantity: 2 };
  const ref = { key: "old-immutable-data", hash: await snapshotValueHash(value) };
  const old = { version: "inline-v1", snapshotFormat: 1, count: 1,
    updatedAt: "2026-09-26T00:00:00Z", blockRefs: { stock: ref } };
  const f = fixture([["test-active", old], [ref.key, value]]);
  const hydrated = await loadSnapshot(f.storage, old);
  assert.equal(resolveSnapshotKey(hydrated, "stock", "legacy"), ref.key);
  assert.equal(Object.keys(hydrated).includes("blockRefs"), false);
  const next = await f.push([["stock", value]], 10);
  assert.equal(next.writtenBlocks, 0);
  assert.equal(next.metadata.version, old.version);
  assert.equal(f.values.get("test-active").blockRefs, undefined);
  assert.equal(next.metadata.blockRefs.stock.key, ref.key);
});

test("concurrent publishers serialize and a late older snapshot cannot replace the newer one", async () => {
  const f = fixture();
  const [a, b] = await Promise.all([f.push([["stock", 1]], 0), f.push([["stock", 2]], 10)]);
  assert.equal(b.metadata.previousSnapshot.version, a.metadata.version);
  f.calls.length = 0;
  await assert.rejects(f.push([["stock", 9]], 0), /STALE_UPDATE/);
  assert.equal(f.calls.length, 0);
  assert.equal(f.values.get("test-active").version, b.metadata.version);
  const c = await f.push([["stock", 3]], 20);
  assert.equal(c.metadata.previousSnapshot.version, b.metadata.version);
});

test("four thousand blocks use bounded manifests, reuse pages, and keep hydration out of metadata JSON", async () => {
  const f = fixture();
  const entries = Array.from({ length: 4000 }, (_, i) => [`order:${i}`, { transactionNo: String(10800000 + i) }]);
  const a = await f.push(entries, 0);
  assert.equal(a.writtenBlocks, 4000);
  assert.ok(a.metadata.blockRefPages.length > 1);
  assert.equal(Object.keys(a.metadata).includes("blockRefs"), false);
  assert.equal(Object.hasOwn({ ...a.metadata }, "blockRefs"), false);
  assert.ok(Buffer.byteLength(JSON.stringify(f.values.get("test-active"))) < 128 * 1024);
  for (const descriptor of a.metadata.blockRefPages) {
    assert.ok(Buffer.byteLength(JSON.stringify(f.values.get(descriptor.key))) < 48 * 1024);
  }
  f.calls.length = 0;
  const b = await f.push(entries, 10);
  assert.equal(b.changed, false);
  assert.equal(b.writtenManifestPages, 0);
  assert.deepEqual(f.calls, [["put", "test-active"]]);
  const c = await f.push(entries.map(([slot, value], i) => [slot, i === 0 ? { ...value, status: "新訂單" } : value]), 20);
  assert.equal(c.writtenBlocks, 1);
  assert.ok(c.reusedManifestPages > 0);
  assert.ok(Buffer.byteLength(JSON.stringify(f.values.get("test-active"))) < 128 * 1024);
  assert.equal(resolveSnapshotKey(c.metadata, "order:3000", "legacy-key"), a.metadata.blockRefs["order:3000"].key);
  assert.equal(resolveSnapshotKey(c.metadata, "missing", "legacy-key"), undefined);
  assert.equal(resolveSnapshotKey({ version: "legacy" }, "old", "legacy-key"), "legacy-key");
  assert.throws(() => resolveSnapshotKey(f.values.get("test-active"), "order:1", "legacy"), /NOT_LOADED/);
});

test("large third-generation cleanup queues are paged and do not enlarge active metadata", async () => {
  const f = fixture();
  const make = (generation) => Array.from({ length: 4000 }, (_, i) => [`order:${i}`, { i, generation }]);
  await f.push(make(1), 0);
  await f.push(make(2), 10);
  const c = await f.push(make(3), 20);
  assert.ok(c.writtenGarbagePages > 1);
  assert.ok(Buffer.byteLength(JSON.stringify(f.values.get("test-active"))) < 128 * 1024);
  assert.ok(c.deletedBlocks >= 4000);
  f.calls.length = 0;
  await f.push(make(3), 30);
  assert.deepEqual(f.calls, [["put", "test-active"]]);
});

test("missing or corrupted manifest pages fail closed before publishing or resolving any data", async () => {
  const f = fixture();
  const a = await f.push([["stock", 1]], 0);
  const key = a.metadata.blockRefPages[0].key;
  const original = f.values.get(key);
  f.values.delete(key);
  await assert.rejects(loadSnapshot(f.storage, f.values.get("test-active")), /MISSING_OR_CORRUPT/);
  f.calls.length = 0;
  await assert.rejects(f.push([["stock", 2]], 10), /MISSING_OR_CORRUPT/);
  assert.equal(f.calls.length, 0);
  f.values.set(key, { refs: {} });
  await assert.rejects(loadSnapshot(f.storage, f.values.get("test-active")), /MISSING_OR_CORRUPT/);
  f.values.set(key, original);
  assert.equal((await loadSnapshot(f.storage, f.values.get("test-active"))).blockRefs.stock.key, a.metadata.blockRefs.stock.key);
});
