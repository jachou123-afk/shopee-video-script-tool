import http from "node:http";
import { WebSocket } from "ws";
import { browserStatus, extractShopeeProduct, startBrowser } from "./browser.mjs";
import { localImageRootForSku, normalizeLocalImageSku, selectLocalProductImage } from "./local-images.mjs";

const workerUrl = process.env.WORKER_WS_URL;
const readerToken = process.env.READER_TOKEN;
if (!workerUrl || !readerToken) throw new Error("WORKER_WS_URL and READER_TOKEN are required");

let socket;
let queue = Promise.resolve();
let reconnectTimer;

function send(payload) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

function workerImageUploadUrl(sku) {
  const url = new URL(workerUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  url.pathname = `/reader/images/${encodeURIComponent(sku)}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function uploadLocalImage(image) {
  const response = await fetch(workerImageUploadUrl(image.sku), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${readerToken}`,
      "Content-Type": image.contentType,
      "Content-Length": String(image.bytes.byteLength),
      "X-Nas-Image-File": encodeURIComponent(image.fileName).slice(0, 500),
      "X-Nas-Image-Folder": encodeURIComponent(image.folderName).slice(0, 500),
      "X-Nas-Image-Width": String(image.width),
      "X-Nas-Image-Height": String(image.height),
      "X-Nas-Image-Candidates": String(image.candidateCount),
      "X-Nas-Image-Score": String(image.score),
    },
    body: image.bytes,
  });
  let result = null;
  try {
    result = await response.json();
  } catch {}
  if (!response.ok || !result?.ok) {
    throw new Error(String(result?.error || `NAS_IMAGE_UPLOAD_HTTP_${response.status}`).slice(0, 160));
  }
  return result;
}

async function handleJob(job) {
  try {
    if (job.type === "extract" && job.url) {
      const product = await extractShopeeProduct(job.url);
      send({ id: job.id, ok: true, product });
      return;
    }
    if (job.type === "local-image" && job.sku) {
      const sku = normalizeLocalImageSku(job.sku);
      if (!sku) throw new Error("NAS_IMAGE_SKU_INVALID");
      const image = await selectLocalProductImage(sku);
      const uploaded = await uploadLocalImage(image);
      send({
        id: job.id,
        ok: true,
        image: {
          ...uploaded,
          fileName: image.fileName,
          folderName: image.folderName,
          sourceWidth: image.sourceWidth,
          sourceHeight: image.sourceHeight,
          candidateCount: image.candidateCount,
          score: image.score,
        },
      });
      return;
    }
    throw new Error("READER_JOB_INVALID");
  } catch (error) {
    send({ id: job.id, ok: false, error: error?.message || "READER_JOB_FAILED" });
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
    if (!job?.id || !["extract", "local-image"].includes(job.type)) return;
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
      localImages: {
        gRoot: localImageRootForSku("G001"),
        kRoot: localImageRootForSku("K001"),
      },
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
