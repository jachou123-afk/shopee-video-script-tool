import http from "node:http";
import { WebSocket } from "ws";
import { browserStatus, extractShopeeProduct, startBrowser } from "./browser.mjs";

const workerUrl = process.env.WORKER_WS_URL;
const readerToken = process.env.READER_TOKEN;
if (!workerUrl || !readerToken) throw new Error("WORKER_WS_URL and READER_TOKEN are required");

let socket;
let queue = Promise.resolve();
let reconnectTimer;

function send(payload) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

async function handleJob(job) {
  try {
    const product = await extractShopeeProduct(job.url);
    send({ id: job.id, ok: true, product });
  } catch (error) {
    send({ id: job.id, ok: false, error: error?.message || "SHOPEE_READER_FAILED" });
  }
}

function connect() {
  clearTimeout(reconnectTimer);
  socket = new WebSocket(workerUrl, {
    headers: { Authorization: `Bearer ${readerToken}` },
  });

  socket.on("open", () => {
    console.log("Connected to Worker broker");
    send({ type: "hello", browser: browserStatus() });
  });
  socket.on("message", (raw) => {
    let job;
    try {
      job = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (job?.type !== "extract" || !job.id || !job.url) return;
    queue = queue.then(() => handleJob(job), () => handleJob(job));
  });
  socket.on("close", () => {
    reconnectTimer = setTimeout(connect, 5000);
  });
  socket.on("error", (error) => {
    console.error("Worker connection error", error?.message || error);
  });
}

const server = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      ok: true,
      workerConnected: socket?.readyState === WebSocket.OPEN,
      browser: browserStatus(),
    }));
    return;
  }
  response.writeHead(404);
  response.end("Not found");
});

await startBrowser();
connect();
server.listen(8788, "127.0.0.1", () => console.log("Health server ready"));

async function shutdown() {
  clearTimeout(reconnectTimer);
  socket?.close();
  server.close();
  setTimeout(() => process.exit(0), 1000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
