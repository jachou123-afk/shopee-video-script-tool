import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { join } from "node:path";

// Point WORKER_TEST_NODE_MODULES at an installation containing miniflare and esbuild.
const require = createRequire(process.env.WORKER_TEST_NODE_MODULES
  ? join(process.env.WORKER_TEST_NODE_MODULES, "package.json") : import.meta.url);
const { Miniflare, convertV4MiniflareOptions } = require("miniflare");
const { build } = require("esbuild");

test("real Workers runtime preserves both NAS connections through hibernation", { timeout: 30000 }, async t => {
  const bundled = await build({
    stdin: { contents: `import { LineActivation as Broker } from "./src/index.js";
      export class LineActivation extends Broker {
        constructor(state, env) { super(state, env); this.instance = crypto.randomUUID(); }
        fetch(request) {
          if (new URL(request.url).pathname === "/test-instance") return Response.json({ instance: this.instance });
          return super.fetch(request);
        }
      }
      export default { fetch(request, env) {
        const url = new URL(request.url);
        const kind = url.searchParams.get("kind") || (url.pathname.startsWith("/erp/") ? "erp" : "reader");
        return env.BROKERS.get(env.BROKERS.idFromName(kind)).fetch(request);
      } };`, resolveDir: process.cwd() },
    bundle: true, write: false, format: "esm", platform: "browser", target: "es2022",
  });
  const options = {
    name: "hibernation-test", modules: true, script: bundled.outputFiles[0].text,
    compatibilityDate: "2026-07-14", unsafeInspectDurableObjects: true,
    durableObjects: { BROKERS: { className: "LineActivation", useSQLite: true } },
    bindings: { SHOPEE_READER_TOKEN: "test-reader", ERP_SYNC_TOKEN: "test-erp" },
  };
  const mf = new Miniflare(convertV4MiniflareOptions ? convertV4MiniflareOptions(options) : options);
  const clients = [];
  t.after(async () => {
    for (const ws of clients) { try { ws.close(1000, "test complete"); } catch {} }
    await mf.dispose();
  });
  for (const kind of ["reader", "erp"]) {
    const path = kind === "reader" ? "/reader" : "/erp/writeback";
    const auth = kind === "reader" ? { Authorization: "Bearer test-reader" } : { "X-Erp-Sync-Token": "test-erp" };
    const connected = await mf.dispatchFetch("http://local" + path + "/connect", { headers: { Upgrade: "websocket", ...auth } });
    assert.equal(connected.status, 101);
    const ws = connected.webSocket;
    clients.push(ws);
    ws.accept();
    const jobs = [];
    ws.addEventListener("message", event => {
      const job = JSON.parse(event.data);
      jobs.push(job);
      ws.send(JSON.stringify({ id: job.id, ok: true, product: { title: "local fixture" }, result: "local-only" }));
    });
    if (kind === "reader") ws.send(JSON.stringify({ type: "hello", browser: { started: true, controlUrl: "about:blank" } }));
    const instanceUrl = "http://local/test-instance?kind=" + kind;
    const before = await (await mf.dispatchFetch(instanceUrl)).json();
    await mf.unsafeEvictDurableObject("hibernation-test", "LineActivation", { name: kind, webSockets: "hibernate" });
    const status = await (await mf.dispatchFetch("http://local" + path + "/status", { headers: auth })).json();
    const after = await (await mf.dispatchFetch(instanceUrl)).json();
    assert.notEqual(before.instance, after.instance, "constructor must run again after actual eviction");
    assert.equal(status.connected, true, "existing client must stay connected while the object sleeps");
    if (kind === "reader") assert.deepEqual(status.hello.browser, { started: true, controlUrl: "about:blank" });
    const route = kind === "reader" ? "/extract" : "/erp/writeback/dispatch";
    const payload = kind === "reader" ? { url: "https://example.invalid/local-fixture" } : { type: "apply", goodId: "local-fixture" };
    const response = await mf.dispatchFetch("http://local" + route, { method: "POST", body: JSON.stringify(payload) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).result, "local-only");
    assert.equal(jobs.length, 1, "wake must deliver a single job without duplicate execution");
    await mf.unsafeEvictDurableObject("hibernation-test", "LineActivation", { name: kind, webSockets: "hibernate" });
    ws.send(JSON.stringify({ id: jobs[0].id, ok: true, result: "late-duplicate" }));
    const finalStatus = await (await mf.dispatchFetch("http://local" + path + "/status", { headers: auth })).json();
    assert.equal(finalStatus.connected, true);
    assert.equal(jobs.length, 1, "late replies after another wake must not replay jobs");
  }
});
