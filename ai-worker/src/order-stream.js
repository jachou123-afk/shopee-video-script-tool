import { JSONParser, TokenType } from "@streamparser/json";

// Keep only the current raw order. The caller retains normalized business data.
export class OrderStreamError extends Error {
  constructor(error, status = 400, details = {}) {
    super(error); this.status = status; this.data = { ok: false, error, ...details };
  }
}
export async function readOrderSnapshot(request, onOrder, maxBytes = 100 * 1024 * 1024) {
  if (!request.body) throw new OrderStreamError("INVALID_JSON");
  const parser = new JSONParser({ paths: ["$.orders.*", "$.updatedAt", "$.retentionDays"], keepStack: false });
  const metadata = {};
  const topKeys = new Set();
  let depth = 0, previous, key, seenOrders = false, count = 0, bytes = 0;
  parser.onToken = ({ token, value }) => {
    if (depth === 0 && previous === undefined && token !== TokenType.LEFT_BRACE) throw new OrderStreamError("INVALID_ORDER_DATA");
    if (depth === 1 && token === TokenType.STRING && (previous === TokenType.LEFT_BRACE || previous === TokenType.COMMA)) {
      key = value;
      if (topKeys.has(key)) throw new OrderStreamError("DUPLICATE_ORDER_FIELD");
      topKeys.add(key);
    }
    if (depth === 1 && previous === TokenType.COLON && key === "orders") {
      if (token !== TokenType.LEFT_BRACKET) throw new OrderStreamError("INVALID_ORDER_DATA");
      seenOrders = true;
    }
    if (token === TokenType.LEFT_BRACE || token === TokenType.LEFT_BRACKET) depth++;
    else if (token === TokenType.RIGHT_BRACE || token === TokenType.RIGHT_BRACKET) depth--;
    previous = token;
  };
  parser.onValue = ({ value, key: valueKey, stack }) => {
    if (stack.length === 2 && stack[1].key === "orders") onOrder(value, count++);
    else if (stack.length === 1) metadata[valueKey] = value;
  };
  const reader = request.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new OrderStreamError("ORDER_PAYLOAD_TOO_LARGE", 413, { limitBytes: maxBytes, receivedBytes: bytes });
      for (let offset = 0; offset < value.byteLength; offset += 64 * 1024) parser.write(value.subarray(offset, offset + 64 * 1024));
    }
    if (!parser.isEnded) parser.end();
    if (!seenOrders) throw new OrderStreamError("INVALID_ORDER_DATA");
    return { ...metadata, orderCount: count, receivedBytes: bytes };
  } catch (error) {
    // Finish bounded, authenticated uploads before responding to validation errors.
    // Cancelling an incomplete HTTP body can reset the caller's connection.
    if (error instanceof OrderStreamError && error.status === 413) await reader.cancel().catch(() => {});
    else {
      try {
        while (true) {
          const remainder = await reader.read();
          if (remainder.done) break;
          bytes += remainder.value.byteLength;
          if (bytes > maxBytes) { await reader.cancel(); break; }
        }
      } catch { /* Preserve the original validation error. */ }
    }
    if (error instanceof OrderStreamError) throw error;
    throw new OrderStreamError("INVALID_JSON");
  } finally { reader.releaseLock(); }
}
