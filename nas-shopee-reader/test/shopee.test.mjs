import assert from "node:assert/strict";
import test from "node:test";
import {
  looksLikeLoginWall,
  normalizeMetaContent,
  normalizePdpResponse,
  normalizeShopeeUrl,
  parseShopeeIds,
} from "../src/shopee.mjs";

test("normalizeShopeeUrl only accepts Shopee Taiwan", () => {
  assert.match(normalizeShopeeUrl("https://shopee.tw/item-i.1.2"), /^https:\/\/shopee\.tw\//);
  assert.throws(() => normalizeShopeeUrl("https://example.com/item"));
});

test("parseShopeeIds accepts canonical and legacy product URLs", () => {
  assert.deepEqual(parseShopeeIds("https://shopee.tw/product/52793230/19594252862"), {
    shopId: "52793230",
    itemId: "19594252862",
  });
  assert.deepEqual(parseShopeeIds("https://shopee.tw/商品-i.52793230.19594252862"), {
    shopId: "52793230",
    itemId: "19594252862",
  });
});

test("normalizeMetaContent keeps the full product description", () => {
  const result = normalizeMetaContent({
    ogTitle: "日式純色坐墊 | 蝦皮購物",
    ogDescription: "商品材質：滌綸與珍珠棉\n商品尺寸：40x40 公分",
  });
  assert.equal(result.title, "日式純色坐墊");
  assert.match(result.description, /珍珠棉/);
});

test("normalizePdpResponse adds attributes and variations", () => {
  const result = normalizePdpResponse({
    data: {
      item: {
        name: "日式純色坐墊",
        description: "舒適減壓好坐",
        attributes: [{ name: "材質", values: [{ name: "珍珠棉" }] }],
        tier_variations: [{ name: "顏色", options: ["黑色", "灰色"] }],
      },
    },
  });
  assert.match(result.description, /材質：珍珠棉/);
  assert.match(result.description, /顏色：黑色、灰色/);
});

test("looksLikeLoginWall recognizes Shopee login interstitials", () => {
  assert.equal(looksLikeLoginWall({ bodyText: "登入必要，看起來您尚未登入。" }), true);
  assert.equal(looksLikeLoginWall({ bodyText: "商品材質與尺寸" }), false);
});
