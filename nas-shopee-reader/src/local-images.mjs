import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const preferredNamePattern = /(主圖|首圖|封面|商品圖|展示圖)/iu;
const pricedCompositeNamePattern = /(文字圖|價格圖|售價圖|報價圖|價目圖|價錢圖)/iu;
const discouragedNamePattern = /(詳情|尺寸|規格|價格|售價|說明|步驟|注意|證書|檢驗|條碼|qrcode|qr|logo|影片|包裝)/iu;

export function normalizeLocalImageSku(value) {
  const sku = String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .toUpperCase();
  return /^(?=[GK])(?=.*\d)[A-Z0-9._-]{2,32}$/u.test(sku) ? sku : "";
}

export function localImageRootForSku(sku, env = process.env) {
  const normalized = normalizeLocalImageSku(sku);
  if (!normalized) return "";
  return normalized.startsWith("G")
    ? String(env.NAS_G_IMAGE_ROOT || "/nas-images/G")
    : String(env.NAS_K_IMAGE_ROOT || "/nas-images/K");
}

function normalizedFolderName(value) {
  return String(value || "").normalize("NFKC").replace(/\s+/g, "").toUpperCase();
}

export async function findLocalSkuDirectory(sku, options = {}) {
  const normalized = normalizeLocalImageSku(sku);
  if (!normalized) throw new Error("NAS_IMAGE_SKU_INVALID");
  const root = options.root || localImageRootForSku(normalized, options.env);
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    throw new Error(`NAS_IMAGE_ROOT_UNAVAILABLE:${error?.code || "UNKNOWN"}`);
  }
  const matches = entries
    .filter((entry) => entry.isDirectory() && normalizedFolderName(entry.name).startsWith(normalized))
    .sort((a, b) => {
      const aName = normalizedFolderName(a.name);
      const bName = normalizedFolderName(b.name);
      const aBoundary = /[^A-Z0-9]/u.test(aName.slice(normalized.length, normalized.length + 1)) ? 0 : 1;
      const bBoundary = /[^A-Z0-9]/u.test(bName.slice(normalized.length, normalized.length + 1)) ? 0 : 1;
      return aBoundary - bBoundary || a.name.length - b.name.length || a.name.localeCompare(b.name, "zh-Hant");
    });
  if (!matches.length) throw new Error("NAS_IMAGE_SKU_FOLDER_NOT_FOUND");
  return { directory: path.join(root, matches[0].name), folderName: matches[0].name };
}

async function collectImageFiles(directory, options = {}, depth = 0, output = []) {
  const maxDepth = Math.max(0, Number(options.maxDepth) || 2);
  const maxCandidates = Math.max(1, Number(options.maxCandidates) || 80);
  if (output.length >= maxCandidates) return output;
  let entries = [];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return output;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant", { numeric: true }));
  for (const entry of entries) {
    if (output.length >= maxCandidates) break;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory() && depth < maxDepth) {
      await collectImageFiles(fullPath, options, depth + 1, output);
      continue;
    }
    if (entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase())) output.push(fullPath);
  }
  return output;
}

export function localImageBaseScore(candidate) {
  const width = Math.max(0, Number(candidate?.width) || 0);
  const height = Math.max(0, Number(candidate?.height) || 0);
  const size = Math.max(0, Number(candidate?.size) || 0);
  const stem = path.basename(String(candidate?.fileName || ""), path.extname(String(candidate?.fileName || "")))
    .normalize("NFKC")
    .replace(/\s+/g, "");
  const lowerStem = stem.toLowerCase();
  const isPricedComposite = pricedCompositeNamePattern.test(stem);
  let score = 0;
  if (isPricedComposite) score += 2400;
  if (preferredNamePattern.test(stem)) score += 520;
  if (/^0+1$/u.test(lowerStem)) score += 460;
  else if (lowerStem === "1") score += 170;
  else if (/^0+2$/u.test(lowerStem)) score += 100;
  if (!isPricedComposite && discouragedNamePattern.test(stem)) score -= 520;
  if (!width || !height || Math.min(width, height) < 400) score -= 700;
  const pixels = width * height;
  if (pixels > 0) score += Math.min(190, Math.max(0, Math.log2(pixels / 250_000) * 35));
  const ratio = width && height ? width / height : 0;
  if (ratio > 0) {
    const squareCloseness = 1 - Math.min(1, Math.abs(Math.log(ratio)) / Math.log(3));
    score += squareCloseness * 150;
    if (ratio < 0.45 || ratio > 2.2) score -= 220;
  }
  if (size > 0) score += Math.min(45, Math.log2(Math.max(1, size / 100_000)) * 12);
  return score;
}

function localImageVisualScore(stats) {
  const sharpness = Math.max(0, Number(stats?.sharpness) || 0);
  const entropy = Math.max(0, Number(stats?.entropy) || 0);
  const mean = Number(stats?.channels?.[0]?.mean);
  let score = Math.min(110, Math.log2(sharpness + 1) * 22) + Math.min(90, entropy * 13);
  if (Number.isFinite(mean) && (mean < 24 || mean > 245)) score -= 100;
  return score;
}

async function inspectCandidate(filePath) {
  const [metadata, fileStat] = await Promise.all([
    sharp(filePath, { limitInputPixels: 120_000_000, animated: false }).metadata(),
    stat(filePath),
  ]);
  const candidate = {
    filePath,
    fileName: path.basename(filePath),
    width: Number(metadata.width) || 0,
    height: Number(metadata.height) || 0,
    size: Number(fileStat.size) || 0,
    format: String(metadata.format || ""),
  };
  candidate.score = localImageBaseScore(candidate);
  return candidate;
}

export async function rankLocalProductImages(sku, options = {}) {
  const located = await findLocalSkuDirectory(sku, options);
  const files = await collectImageFiles(located.directory, options);
  if (!files.length) throw new Error("NAS_IMAGE_FILE_NOT_FOUND");
  const inspected = [];
  for (const filePath of files) {
    try {
      inspected.push(await inspectCandidate(filePath));
    } catch {}
  }
  if (!inspected.length) throw new Error("NAS_IMAGE_READ_FAILED");
  inspected.sort((a, b) => b.score - a.score || b.size - a.size || a.fileName.localeCompare(b.fileName));
  const visualCount = Math.min(inspected.length, Math.max(1, Number(options.visualCandidates) || 8));
  for (const candidate of inspected.slice(0, visualCount)) {
    try {
      const stats = await sharp(candidate.filePath, { limitInputPixels: 120_000_000, animated: false })
        .rotate()
        .resize({ width: 320, height: 320, fit: "inside", withoutEnlargement: true })
        .greyscale()
        .stats();
      candidate.score += localImageVisualScore(stats);
      candidate.sharpness = Number(stats.sharpness) || 0;
      candidate.entropy = Number(stats.entropy) || 0;
    } catch {}
  }
  inspected.sort((a, b) => b.score - a.score || b.size - a.size || a.fileName.localeCompare(b.fileName));
  return { folderName: located.folderName, candidates: inspected };
}

export async function selectLocalProductImage(sku, options = {}) {
  const normalized = normalizeLocalImageSku(sku);
  if (!normalized) throw new Error("NAS_IMAGE_SKU_INVALID");
  const ranked = await rankLocalProductImages(normalized, options);
  const selected = ranked.candidates[0];
  const output = await sharp(selected.filePath, { limitInputPixels: 120_000_000, animated: false })
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({ width: 1200, height: 1200, fit: "contain", background: "#ffffff" })
    .jpeg({ quality: 84, progressive: true, chromaSubsampling: "4:2:0" })
    .toBuffer({ resolveWithObject: true });
  return {
    sku: normalized,
    bytes: output.data,
    contentType: "image/jpeg",
    fileName: selected.fileName,
    folderName: ranked.folderName,
    sourceWidth: selected.width,
    sourceHeight: selected.height,
    width: Number(output.info.width) || 1200,
    height: Number(output.info.height) || 1200,
    candidateCount: ranked.candidates.length,
    score: Math.round(selected.score),
  };
}
