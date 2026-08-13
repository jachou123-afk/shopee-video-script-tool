import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  findLocalSkuDirectory,
  localImageBaseScore,
  normalizeLocalImageSku,
  selectLocalProductImage,
} from "../src/local-images.mjs";

test("normalizes only G and K local-image SKUs", () => {
  assert.equal(normalizeLocalImageSku(" g041 "), "G041");
  assert.equal(normalizeLocalImageSku("Ｋ017"), "K017");
  assert.equal(normalizeLocalImageSku("A235"), "");
  assert.equal(normalizeLocalImageSku("K"), "");
});

test("prefers a named cover image over a larger detail graphic", () => {
  const cover = localImageBaseScore({ fileName: "01.jpg", width: 1200, height: 1680, size: 700_000 });
  const detail = localImageBaseScore({ fileName: "尺寸說明.jpg", width: 3000, height: 3000, size: 3_000_000 });
  const closeup = localImageBaseScore({ fileName: "1.jpg", width: 2400, height: 2400, size: 2_000_000 });
  assert.ok(cover > detail);
  assert.ok(cover > closeup);
});

test("finds a SKU folder and produces a square LINE image", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nas-local-image-"));
  try {
    const folder = path.join(root, "K017鴻圖大展吊飾");
    await mkdir(folder, { recursive: true });
    await sharp({ create: { width: 1200, height: 1680, channels: 3, background: "#f4dfb8" } })
      .composite([{ input: Buffer.from('<svg width="1200" height="1680"><rect x="100" y="220" width="1000" height="1000" rx="80" fill="#b22020"/><circle cx="600" cy="720" r="260" fill="#f0c84b"/></svg>') }])
      .jpeg({ quality: 88 })
      .toFile(path.join(folder, "01.jpg"));
    await sharp({ create: { width: 2400, height: 2400, channels: 3, background: "#777777" } })
      .jpeg({ quality: 88 })
      .toFile(path.join(folder, "1.jpg"));
    await sharp({ create: { width: 3000, height: 3000, channels: 3, background: "#ffffff" } })
      .composite([{ input: Buffer.from('<svg width="3000" height="3000"><text x="100" y="300" font-size="180">SIZE 10 x 20</text></svg>') }])
      .jpeg({ quality: 88 })
      .toFile(path.join(folder, "尺寸說明.jpg"));

    const located = await findLocalSkuDirectory("k017", { root });
    assert.equal(located.folderName, "K017鴻圖大展吊飾");

    const selected = await selectLocalProductImage("K017", { root });
    assert.equal(selected.fileName, "01.jpg");
    assert.equal(selected.width, 1200);
    assert.equal(selected.height, 1200);
    assert.equal(selected.contentType, "image/jpeg");
    assert.ok(selected.bytes.byteLength > 10_000);
    assert.equal(selected.candidateCount, 3);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
