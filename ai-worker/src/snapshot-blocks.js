// Publish complete snapshots while sharing immutable, unchanged storage blocks.
// Callers own input validation, block boundaries, and legacy reader compatibility.
const encoder = new TextEncoder();
const metadataLimitBytes = 128 * 1024;
const manifestPageBytes = 48 * 1024;
const reservedFields = new Set([
  "version", "updatedAt", "previousSnapshot", "blockRefs", "snapshotHash",
  "snapshotFormat", "pendingGarbageKeys", "blockRefPages", "pendingGarbagePages",
]);
const queues = new WeakMap();

export function stableSerialize(value) {
  const parents = new Set();
  function serialize(item, arrayElement = false) {
    if (item === null) return "null";
    if (typeof item === "string" || typeof item === "boolean") return JSON.stringify(item);
    if (typeof item === "number") {
      if (!Number.isFinite(item)) throw new TypeError("SNAPSHOT_NON_FINITE_NUMBER");
      return JSON.stringify(item);
    }
    if (item === undefined) return arrayElement ? "null" : undefined;
    if (typeof item !== "object") throw new TypeError("SNAPSHOT_NON_JSON_VALUE");
    if (parents.has(item)) throw new TypeError("SNAPSHOT_CIRCULAR_VALUE");
    const prototype = Object.getPrototypeOf(item);
    if (!Array.isArray(item) && prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("SNAPSHOT_NON_JSON_OBJECT");
    }
    parents.add(item);
    let result;
    if (Array.isArray(item)) {
      result = `[${Array.from(item, (entry) => serialize(entry, true)).join(",")}]`;
    } else {
      const entries = [];
      for (const key of Object.keys(item).sort()) {
        const serialized = serialize(item[key]);
        if (serialized !== undefined) entries.push(`${JSON.stringify(key)}:${serialized}`);
      }
      result = `{${entries.join(",")}}`;
    }
    parents.delete(item);
    return result;
  }
  const serialized = serialize(value);
  if (serialized === undefined) throw new TypeError("SNAPSHOT_UNDEFINED_VALUE");
  return serialized;
}

export async function snapshotValueHash(value) {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(stableSerialize(value)));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function businessMetadata(metadata) {
  return Object.fromEntries(Object.entries(metadata || {}).filter(([key]) => !reservedFields.has(key)));
}

function shallowSnapshot(metadata) {
  if (!metadata || typeof metadata !== "object" || !metadata.version) return null;
  const { previousSnapshot, pendingGarbageKeys, pendingGarbagePages, ...snapshot } = metadata;
  if (snapshot.blockRefPages) delete snapshot.blockRefs;
  else if (metadata.blockRefs) snapshot.blockRefs = metadata.blockRefs;
  return snapshot;
}

function validateKey(key, activeKey) {
  if (typeof key !== "string" || !key || key === activeKey || encoder.encode(key).byteLength > 2048) {
    throw new TypeError("SNAPSHOT_INVALID_BLOCK_KEY");
  }
  return key;
}

export async function loadSnapshot(storage, metadata) {
  if (!metadata || typeof metadata !== "object") return metadata;
  if (!Array.isArray(metadata.blockRefPages)) {
    if (!metadata.blockRefs) return metadata;
    const { blockRefs, ...hydrated } = metadata;
    Object.defineProperty(hydrated, "blockRefs", { value: blockRefs, enumerable: false });
    return hydrated;
  }
  const blockRefs = Object.create(null);
  for (const descriptor of metadata.blockRefPages) {
    const page = await storage.get(descriptor.key);
    if (!page || !page.refs || typeof page.refs !== "object"
        || await snapshotValueHash(page) !== descriptor.hash) {
      throw new Error("SNAPSHOT_MANIFEST_MISSING_OR_CORRUPT");
    }
    for (const [slot, ref] of Object.entries(page.refs)) {
      if (Object.hasOwn(blockRefs, slot) || !ref || typeof ref.key !== "string" || typeof ref.hash !== "string") {
        throw new Error("SNAPSHOT_MANIFEST_INVALID_REFERENCE");
      }
      blockRefs[slot] = ref;
    }
  }
  const hydrated = { ...metadata };
  Object.defineProperty(hydrated, "blockRefs", { value: blockRefs, enumerable: false });
  return hydrated;
}

export function resolveSnapshotKey(metadata, slot, legacyKey) {
  if (metadata?.blockRefs) return metadata.blockRefs[slot]?.key;
  if (Array.isArray(metadata?.blockRefPages)) throw new Error("SNAPSHOT_MANIFEST_NOT_LOADED");
  return legacyKey;
}

async function snapshotKeys(storage, metadata, legacyKeys, activeKey) {
  if (!metadata || !metadata.version) return new Set();
  const hydrated = metadata.blockRefs ? metadata : await loadSnapshot(storage, metadata);
  const keys = hydrated.blockRefs && typeof hydrated.blockRefs === "object"
    ? Object.values(hydrated.blockRefs).map((ref) => ref.key)
    : await legacyKeys(metadata);
  const result = new Set(Array.from(keys || [], (key) => validateKey(key, activeKey)));
  for (const page of metadata.blockRefPages || []) result.add(validateKey(page.key, activeKey));
  return result;
}

function splitReferencePages(blockRefs) {
  const pages = [];
  let refs = Object.create(null);
  let bytes = 11;
  for (const slot of Object.keys(blockRefs).sort()) {
    const entryBytes = encoder.encode(`${JSON.stringify(slot)}:${stableSerialize(blockRefs[slot])},`).byteLength;
    if (entryBytes + 11 >= manifestPageBytes) throw new Error("SNAPSHOT_REFERENCE_TOO_LARGE");
    if (bytes + entryBytes >= manifestPageBytes && Object.keys(refs).length) {
      pages.push({ refs });
      refs = Object.create(null);
      bytes = 11;
    }
    refs[slot] = blockRefs[slot];
    bytes += entryBytes;
  }
  if (Object.keys(refs).length) pages.push({ refs });
  return pages;
}

function splitGarbagePages(keys) {
  const pages = [];
  let chunk = [];
  let bytes = 11;
  for (const key of keys) {
    const addedBytes = encoder.encode(`${JSON.stringify(key)},`).byteLength;
    if (bytes + addedBytes >= manifestPageBytes && chunk.length) {
      pages.push({ keys: chunk }); chunk = []; bytes = 11;
    }
    chunk.push(key); bytes += addedBytes;
  }
  if (chunk.length) pages.push({ keys: chunk });
  return pages;
}

async function preparePage(storage, activeKey, kind, value, writes) {
  const hash = await snapshotValueHash(value);
  const key = validateKey(`${activeKey}:${kind}:${hash}`, activeKey);
  const existing = await storage.get(key);
  if (existing === undefined) writes.push({ key, value });
  else if (await snapshotValueHash(existing) !== hash) throw new Error("SNAPSHOT_PAGE_CONTENT_MISMATCH");
  return { key, hash };
}

function validateFreshness(metadata, previous) {
  if (metadata.updatedAt === undefined) return;
  const incoming = Date.parse(String(metadata.updatedAt));
  if (!Number.isFinite(incoming)) throw new TypeError("SNAPSHOT_INVALID_UPDATED_AT");
  const stored = Date.parse(String(previous?.updatedAt || ""));
  if (Number.isFinite(stored) && incoming < stored) throw new Error("SNAPSHOT_STALE_UPDATE");
}

async function publish(storage, { activeKey, metadata, blocks, legacyKeys = () => [] }) {
  if (typeof activeKey !== "string" || !activeKey || !Array.isArray(blocks)
      || !metadata || typeof metadata !== "object" || Array.isArray(metadata)
      || typeof legacyKeys !== "function") {
    throw new TypeError("SNAPSHOT_INVALID_ARGUMENTS");
  }
  const previous = await loadSnapshot(storage, await storage.get(activeKey));
  validateFreshness(metadata, previous);
  const generation = crypto.randomUUID();
  const blockRefs = Object.create(null);
  const writes = [];
  const hashes = [];
  let reusedBlocks = 0;
  for (const block of blocks) {
    const slot = block?.slot;
    if (typeof slot !== "string" || !slot || Object.hasOwn(blockRefs, slot)) {
      throw new TypeError("SNAPSHOT_INVALID_OR_DUPLICATE_SLOT");
    }
    const hash = await snapshotValueHash(block.value);
    const priorRef = previous?.blockRefs?.[slot];
    let key;
    if (priorRef?.hash === hash && typeof priorRef.key === "string") {
      key = validateKey(priorRef.key, activeKey);
    } else if (!previous?.blockRefs && previous?.version && block.legacyKey) {
      const candidate = validateKey(block.legacyKey, activeKey);
      const oldValue = await storage.get(candidate);
      if (oldValue !== undefined && await snapshotValueHash(oldValue) === hash) key = candidate;
    }
    if (key) {
      reusedBlocks += 1;
    } else {
      key = validateKey(`${activeKey}:block:${generation}:${writes.length}`, activeKey);
      writes.push({ key, value: block.value });
    }
    blockRefs[slot] = { key, hash };
    hashes.push([slot, hash]);
  }
  hashes.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  const business = businessMetadata(metadata);
  const snapshotHash = await snapshotValueHash({ metadata: business, blocks: hashes });
  const previousSlots = previous?.blockRefs && Object.keys(previous.blockRefs);
  const legacyUnchanged = !previous?.blockRefs && previous?.version
    ? await snapshotKeys(storage, previous, legacyKeys, activeKey)
    : null;
  const allLegacyKeysReused = legacyUnchanged
    && legacyUnchanged.size === blocks.length
    && Object.values(blockRefs).every((ref) => legacyUnchanged.has(ref.key));
  const unchanged = Boolean(previous?.version) && writes.length === 0
    && stableSerialize(business) === stableSerialize(businessMetadata(previous))
    && (previous.snapshotHash === snapshotHash
      || (!previous.snapshotHash && (previousSlots
        ? previousSlots.length === blocks.length
        : allLegacyKeysReused)));
  const fallback = shallowSnapshot(unchanged ? previous?.previousSnapshot : previous);
  const manifestWrites = [];
  const blockRefPages = [];
  for (const page of splitReferencePages(blockRefs)) {
    blockRefPages.push(await preparePage(storage, activeKey, "manifest", page, manifestWrites));
  }
  const next = {
    ...business,
    version: unchanged ? previous.version : generation,
    updatedAt: metadata.updatedAt ?? previous?.updatedAt,
    snapshotFormat: 2,
    snapshotHash,
    blockRefPages,
    ...(fallback ? { previousSnapshot: fallback } : {}),
  };
  const retained = new Set(Object.values(blockRefs).map((ref) => ref.key));
  for (const page of blockRefPages) retained.add(page.key);
  for (const key of await snapshotKeys(storage, fallback, legacyKeys, activeKey)) retained.add(key);
  const garbage = new Set();
  const garbagePages = [];
  const previouslyQueued = new Set();
  for (const descriptor of previous?.pendingGarbagePages || []) {
    validateKey(descriptor.key, activeKey);
    const page = await storage.get(descriptor.key);
    // Queue pages are deleted only after all their tasks have completed.
    if (page === undefined) continue;
    if (!Array.isArray(page?.keys) || await snapshotValueHash(page) !== descriptor.hash) {
      throw new Error("SNAPSHOT_GARBAGE_PAGE_CORRUPT");
    }
    for (const key of page.keys) previouslyQueued.add(validateKey(key, activeKey));
    garbagePages.push({ descriptor, value: page });
  }
  // Migrate the initial inline cleanup queue without scanning storage.
  for (const key of previous?.pendingGarbageKeys || []) {
    validateKey(key, activeKey);
    if (!retained.has(key) && await storage.get(key) !== undefined) garbage.add(key);
  }
  if (!unchanged) {
    for (const key of await snapshotKeys(storage, previous?.previousSnapshot, legacyKeys, activeKey)) {
      if (!retained.has(key)) garbage.add(key);
    }
  }
  for (const key of previouslyQueued) garbage.delete(key);
  const garbageWrites = [];
  for (const value of splitGarbagePages([...garbage].sort())) {
    const descriptor = await preparePage(storage, activeKey, "garbage", value, garbageWrites);
    garbagePages.push({ descriptor, value });
  }
  if (garbagePages.length) next.pendingGarbagePages = garbagePages.map((page) => page.descriptor);
  if (encoder.encode(stableSerialize(next)).byteLength >= metadataLimitBytes) {
    throw new Error("SNAPSHOT_METADATA_TOO_LARGE");
  }
  // Complete preflight validation before the first storage mutation.
  const staged = [];
  try {
    for (const { key, value } of [...writes, ...manifestWrites, ...garbageWrites]) {
      staged.push(key);
      await storage.put(key, value);
    }
    await storage.put(activeKey, next);
  } catch (error) {
    // An ambiguous active write must never result in deleting the published data.
    let published = true;
    try {
      const observed = await storage.get(activeKey);
      published = observed?.version === next.version && observed?.snapshotHash === next.snapshotHash;
    } catch { /* Retain staged data if publication cannot be checked safely. */ }
    if (!published) {
      for (const key of staged) {
        try { await storage.delete(key); } catch { /* Preserve the original failure. */ }
      }
    }
    throw error;
  }
  let deletedBlocks = 0;
  let cleanupFailed = 0;
  for (const page of garbagePages) {
    let completed = true;
    for (const key of page.value.keys) {
      if (retained.has(key)) continue;
      try {
        if (await storage.get(key) === undefined) continue;
        await storage.delete(key);
        deletedBlocks += 1;
      } catch {
        cleanupFailed += 1;
        completed = false;
      }
    }
    if (completed) {
      try { await storage.delete(page.descriptor.key); }
      catch { cleanupFailed += 1; }
    }
  }
  // pendingGarbagePages remains recorded until the next refresh; a failed delete
  // can be retried, and successful deletes cost no additional metadata writes.
  return {
    metadata: next, changed: !unchanged, writtenBlocks: writes.length, reusedBlocks,
    writtenManifestPages: manifestWrites.length, reusedManifestPages: blockRefPages.length - manifestWrites.length,
    writtenGarbagePages: garbageWrites.length, deletedBlocks, cleanupFailed,
  };
}

export function publishSnapshot(storage, options) {
  if (!storage || typeof storage !== "object") return Promise.reject(new TypeError("SNAPSHOT_INVALID_STORAGE"));
  let pending = queues.get(storage);
  if (!pending) queues.set(storage, pending = new Map());
  const key = options?.activeKey;
  const prior = pending.get(key) || Promise.resolve();
  const task = prior.catch(() => {}).then(() => publish(storage, options));
  pending.set(key, task);
  const release = () => {
    if (pending.get(key) === task) pending.delete(key);
  };
  task.then(release, release);
  return task;
}
