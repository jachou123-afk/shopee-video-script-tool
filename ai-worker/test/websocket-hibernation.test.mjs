import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { LineActivation } from "../src/index.js";

const env = { SHOPEE_READER_TOKEN: "test-reader", ERP_SYNC_TOKEN: "test-erp" };
class Socket {
  readyState = 1;
  sent = [];
  close(code, reason) { this.readyState = 2; this.closed = { code, reason }; }
  send(raw) { this.sent.push(JSON.parse(raw)); }
  serializeAttachment(value) { this.attachment = structuredClone(value); }
  deserializeAttachment() { return structuredClone(this.attachment); }
  accept() { throw new Error("Standard accept prevents hibernation"); }
  addEventListener() { throw new Error("Use Durable Object WebSocket handlers"); }
}
function fixture(t) {
  const NativeResponse = globalThis.Response;
  const NativePair = globalThis.WebSocketPair;
  const NativeSocket = globalThis.WebSocket;
  globalThis.Response = function(body, init) {
    return init?.status === 101 ? { status: 101, webSocket: init.webSocket } : new NativeResponse(body, init);
  };
  globalThis.Response.json = NativeResponse.json.bind(NativeResponse);
  globalThis.WebSocket = { OPEN: 1 };
  globalThis.WebSocketPair = class { constructor() { this[0] = new Socket(); this[1] = new Socket(); } };
  t.after(() => {
    globalThis.Response = NativeResponse;
    if (NativePair) globalThis.WebSocketPair = NativePair; else delete globalThis.WebSocketPair;
    if (NativeSocket) globalThis.WebSocket = NativeSocket; else delete globalThis.WebSocket;
  });
  const sockets = [];
  const state = {
    storage: new Proxy({}, { get() { throw new Error("Connection handling must not write storage"); } }),
    acceptWebSocket(socket, tags) { sockets.push({ socket, tags }); },
    getWebSockets(tag) { return sockets.filter(entry => entry.tags.includes(tag)).map(entry => entry.socket); },
  };
  const object = new LineActivation(state, env);
  function connect(kind, auth = true) {
    const reader = kind === "reader";
    return object.fetch(new Request("https://broker" + (reader ? "/reader/connect" : "/erp/writeback/connect"), {
      headers: { Upgrade: "websocket", ...(auth ? (reader ? { Authorization: "Bearer test-reader" } : { "X-Erp-Sync-Token": "test-erp" }) : {}) },
    }));
  }
  return { object, state, sockets, connect };
}
for (const kind of ["reader", "erp"]) {
  test(kind + " authenticates before accepting a hibernating connection", async t => {
    const f = fixture(t);
    assert.equal((await f.connect(kind, false)).status, 401);
    assert.equal(f.sockets.length, 0);
    const path = kind === "reader" ? "/reader/connect" : "/erp/writeback/connect";
    const headers = kind === "reader" ? { Authorization: "Bearer test-reader" } : { "X-Erp-Sync-Token": "test-erp" };
    assert.equal((await f.object.fetch(new Request("https://broker" + path, { headers }))).status, 426);
    assert.equal((await f.connect(kind)).status, 101);
    assert.deepEqual(f.sockets[0].tags, [kind === "reader" ? "nas-reader" : "erp-writeback"]);
  });
  test(kind + " restores its connection after losing all in-memory state", async t => {
    const f = fixture(t);
    await f.connect(kind);
    const socket = f.sockets[0].socket;
    if (kind === "reader") f.object.webSocketMessage(socket, JSON.stringify({ type: "hello", browser: { started: true, controlUrl: "about:blank" } }));
    const awake = new LineActivation(f.state, env);
    const path = kind === "reader" ? "/reader/status" : "/erp/writeback/status";
    const headers = kind === "reader" ? { Authorization: "Bearer test-reader" } : { "X-Erp-Sync-Token": "test-erp" };
    const status = await (await awake.fetch(new Request("https://broker" + path, { headers }))).json();
    assert.equal(status.connected, true);
    if (kind === "reader") assert.deepEqual(status.hello.browser, { started: true, controlUrl: "about:blank" });
    const pending = kind === "reader" ? awake.dispatchReaderJob({ type: "local-image", sku: "G041" }) : awake.dispatchErpWritebackJob(new Request("https://broker/dispatch", { method: "POST", body: JSON.stringify({ type: "plan", goodId: "test-only" }) }));
    await setImmediate();
    const job = socket.sent[0];
    awake.webSocketMessage(socket, JSON.stringify({ id: job.id, ok: true, result: "after-wake" }));
    assert.equal((await (await pending).json()).result, "after-wake");
  });
  test(kind + " ignores replaced connection messages and completes each job once", async t => {
    const f = fixture(t);
    await f.connect(kind);
    const old = f.sockets[0].socket;
    const dispatch = () => kind === "reader" ? f.object.dispatchReaderJob({ type: "extract", url: "https://example.invalid" }) : f.object.dispatchErpWritebackJob(new Request("https://broker/dispatch", { method: "POST", body: JSON.stringify({ type: "apply", goodId: "mock-only" }) }));
    const previousJob = dispatch();
    await setImmediate();
    await f.connect(kind);
    assert.equal((await previousJob).status, 503);
    const current = f.sockets[1].socket;
    const currentJob = dispatch();
    await setImmediate();
    const id = current.sent[0].id;
    f.object.webSocketClose(old);
    f.object.webSocketError(old);
    f.object.webSocketMessage(old, JSON.stringify({ id, ok: true, result: "wrong" }));
    f.object.webSocketMessage(current, JSON.stringify({ id, ok: true, result: "correct" }));
    assert.equal((await (await currentJob).json()).result, "correct");
    f.object.webSocketMessage(current, JSON.stringify({ id, ok: true, result: "duplicate" }));
    assert.equal(current.sent.length, 1);
    const awake = new LineActivation(f.state, env);
    assert.equal(kind === "reader" ? awake.readerSocket : awake.erpWritebackSocket, current);
  });
  test(kind + " closes pending work on disconnect without resending", async t => {
    const f = fixture(t);
    await f.connect(kind);
    const socket = f.sockets[0].socket;
    const pending = kind === "reader" ? f.object.dispatchReaderJob({ type: "local-image", sku: "G041" }) : f.object.dispatchErpWritebackJob(new Request("https://broker/dispatch", { method: "POST", body: JSON.stringify({ type: "apply", goodId: "mock-only" }) }));
    await setImmediate();
    f.object.webSocketClose(socket);
    assert.equal((await pending).status, 503);
    assert.equal(socket.sent.length, 1);
    assert.equal(kind === "reader" ? f.object.readerPending.size : f.object.erpWritebackPending.size, 0);
  });
}
test("reader correlates concurrent out-of-order replies and ignores other sockets", async t => {
  const f = fixture(t);
  await f.connect("reader");
  const socket = f.sockets[0].socket;
  const first = f.object.dispatchReaderJob({ type: "local-image", sku: "G041" });
  const second = f.object.dispatchReaderJob({ type: "local-image", sku: "K017" });
  f.object.webSocketMessage(new Socket(), JSON.stringify({ id: socket.sent[0].id, ok: true, sku: "wrong" }));
  f.object.webSocketMessage(socket, JSON.stringify({ id: socket.sent[1].id, ok: true, sku: "K017" }));
  f.object.webSocketMessage(socket, JSON.stringify({ id: socket.sent[0].id, ok: true, sku: "G041" }));
  assert.equal((await (await first).json()).sku, "G041");
  assert.equal((await (await second).json()).sku, "K017");
  assert.equal(f.object.readerPending.size, 0);
});
test("hello diagnostics fit attachment limits without breaking subsequent jobs", async t => {
  const f = fixture(t);
  await f.connect("reader");
  const socket = f.sockets[0].socket;
  f.object.webSocketMessage(socket, JSON.stringify({ type: "hello", browser: { controlUrl: "圖".repeat(5000) } }));
  assert.ok(new TextEncoder().encode(JSON.stringify(socket.attachment)).byteLength < 2048);
  const awake = new LineActivation(f.state, env);
  assert.equal(awake.readerHello.browser, null);
  assert.ok(awake.readerHello.receivedAt > 0);
  awake.webSocketMessage(socket, "invalid JSON");
  awake.webSocketMessage(socket, new ArrayBuffer(2));
  assert.equal(awake.readerSocket, socket);
});
test("broker deadlines clear pending state and never replay a timed-out write", async t => {
  const f = fixture(t);
  await f.connect("reader");
  await f.connect("erp");
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const reader = f.object.dispatchReaderJob({ type: "extract", url: "https://example.invalid" }, 1000);
  const erp = f.object.dispatchErpWritebackJob(new Request("https://broker/dispatch", { method: "POST", body: JSON.stringify({ type: "apply", goodId: "mock-only" }) }));
  await setImmediate();
  t.mock.timers.tick(35000);
  assert.equal((await reader).status, 504);
  assert.equal((await erp).status, 504);
  assert.equal(f.object.readerPending.size, 0);
  assert.equal(f.object.erpWritebackPending.size, 0);
  assert.deepEqual(f.sockets.map(({ socket }) => socket.sent.length), [1, 1]);
});
test("wake ignores closing connections and tolerates missing diagnostic attachments", async t => {
  const f = fixture(t);
  await f.connect("reader");
  const socket = f.sockets[0].socket;
  socket.deserializeAttachment = () => { throw new Error("missing attachment"); };
  assert.equal(new LineActivation(f.state, env).readerSocket, socket);
  socket.close(1000, "closed");
  assert.equal(new LineActivation(f.state, env).readerSocket, null);
});
