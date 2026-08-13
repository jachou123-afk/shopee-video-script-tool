const SHOPEE_HOST = /(^|\.)shopee\.tw$/i;

export function normalizeShopeeUrl(raw) {
  const url = new URL(String(raw || "").trim());
  if (!SHOPEE_HOST.test(url.hostname)) throw new Error("ONLY_SHOPEE_TW_URLS_ARE_ALLOWED");
  if (url.protocol !== "https:") url.protocol = "https:";
  return url.toString();
}

export function parseShopeeIds(raw) {
  const url = new URL(String(raw || ""));
  const decodedPath = decodeURIComponent(url.pathname);
  const product = decodedPath.match(/^\/product\/(\d+)\/(\d+)/i);
  const legacy = decodedPath.match(/-i\.(\d+)\.(\d+)(?:\/|$)/i);
  const match = product || legacy;
  return match ? { shopId: match[1], itemId: match[2] } : null;
}

export function cleanText(value, limit = 12000) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, limit);
}

export function normalizeShopeeImageUrl(value) {
  const raw = typeof value === "object" && value
    ? value.url || value.imageUrl || value.image_url || value.id || value.image_id || ""
    : value;
  const text = String(raw || "").trim();
  if (/^https:\/\/[^\s]+$/iu.test(text)) return text.slice(0, 2000);
  if (/^[A-Za-z0-9_-]{10,300}$/u.test(text)) {
    return `https://down-tw.img.susercontent.com/file/${text}`;
  }
  return "";
}

function attributeLines(attributes) {
  if (!Array.isArray(attributes)) return [];
  return attributes.flatMap((attribute) => {
    const name = cleanText(attribute?.name, 120);
    const values = Array.isArray(attribute?.values)
      ? attribute.values.map((value) => cleanText(value?.name || value?.value, 200)).filter(Boolean)
      : [];
    const value = values.join(" / ") || cleanText(attribute?.value, 300);
    return name && value ? [`${name}：${value}`] : [];
  });
}

function variationLines(variations) {
  if (!Array.isArray(variations)) return [];
  return variations.flatMap((variation) => {
    const name = cleanText(variation?.name, 120);
    const options = Array.isArray(variation?.options)
      ? variation.options.map((option) => cleanText(option, 120)).filter(Boolean)
      : [];
    return name && options.length ? [`${name}：${options.join("、")}`] : [];
  });
}

export function normalizePdpResponse(payload) {
  const item = payload?.data?.item || payload?.data;
  if (!item || typeof item !== "object") return null;

  const title = cleanText(item.name, 500);
  const description = cleanText(item.description, 10000);
  const details = [
    ...attributeLines(item.attributes),
    ...variationLines(item.tier_variations),
  ];
  const combined = cleanText([
    description,
    details.length ? `商品細節\n${details.join("\n")}` : "",
  ].filter(Boolean).join("\n\n"));
  const imageUrl = normalizeShopeeImageUrl(
    (Array.isArray(item.images) ? item.images[0] : "")
      || item.image
      || item.image_url
      || item.cover,
  );

  if (!title && !combined) return null;
  return { title, description: combined, imageUrl, source: "authenticated_api" };
}

export function normalizeMetaContent(snapshot) {
  const title = cleanText(snapshot?.ogTitle || snapshot?.title, 500)
    .replace(/\s*\|\s*蝦皮購物.*$/u, "")
    .trim();
  const description = cleanText(snapshot?.ogDescription || snapshot?.description, 12000);
  if (!title && !description) return null;
  return {
    title,
    description,
    imageUrl: normalizeShopeeImageUrl(snapshot?.ogImage || snapshot?.imageUrl),
    source: "authenticated_meta",
  };
}

export function looksLikeLoginWall(snapshot) {
  const text = cleanText([
    snapshot?.title,
    snapshot?.ogTitle,
    snapshot?.ogDescription,
    snapshot?.bodyText,
  ].join("\n"), 3000);
  return /login|sign[ -]?in|buyer\/login|verification|captcha|登入|登錄|驗證碼|請先登入/i.test(text);
}
