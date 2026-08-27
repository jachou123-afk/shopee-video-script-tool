# AI Worker

Cloudflare Worker backend for the Shopee script web tool and LINE official account.

## Validate

```bash
node --check src/index.js
node --test test/index.test.mjs
```

## Deploy

Use Node.js 22 or newer:

```bash
wrangler login
wrangler deploy
```

The Worker contains the LINE webhook, global shooting schedule, completed-history undo, ERP main-warehouse location lookup, pure-profit SKU enrichment, OpenAI script generation, and the Durable Object broker used by the authenticated NAS Shopee reader.

The private-chat command `改儲位 {SKU}` starts a stateless, button-based dry-run wizard for `@059hdfyo` only. A multi-variant product first shows the actual ERP child SKUs; the user can choose one child or, for up to 10 children, `全部`. Empty or duplicate child IDs fail closed. The first release keeps A warehouse visible but unavailable; B warehouse supports zone `01`-`06`, side `L`/`R`, shelf `01`-`05`, level `01`-`04`, tray `T1`-`T4`, and a no-tray option, producing locations such as `02-R04-01/T1` or `05-R04-03`. Every selection is carried only in the LINE postback context and is not persisted. The final step re-reads the recent `InventoryId=1` snapshot and previews either the selected child or every selected child line by line. It deliberately performs no ERP write and refuses groups, malformed choices, stale snapshots, non-main warehouses, missing products, and stale child selections. The older full command `改儲位 {SKU} {新儲位}` remains available as a single-variant read-only shortcut.

The `@059hdfyo` help quick replies use `📦 改儲位` instead of `➕ 新增排程`. Pressing it sends the bare `改儲位` message and opens a one-time eight-second private-chat window for a bare SKU reply. That short activation timestamp is stored in a per-user Durable Object and consumed on the next SKU; it never stores a selected warehouse location and never writes ERP data. An expired reply tells the user to press the menu action again. The separate rich menu documented for `@037vajci` is not changed.

The NAS ERP sync posts versioned location snapshots to `/erp/locations/push` with the `ERP_SYNC_TOKEN` secret. LINE users can query the active snapshot by directly sending a SKU such as `A725`; the older `儲位 A725` form remains supported. Exact-SKU queries and keyword searches use the same product card with image, stock, and primary locations. Its `完整儲位` action sends `完整儲位 {sku}` and returns the full text details for every ERP variant; a variant whose warehouse location is blank remains visible as `未設定儲位` with its available quantity. The snapshot is published only after all hashed storage buckets are written, so an empty or failed sync cannot replace the last good data.

Every snapshot item carries the minimum and maximum positive ERP `售價` values. Private-chat SKU cards, keyword-search cards, and `完整儲位` replies show the per-unit sale price; group and room replies never include it. Positive equal values show one price, differing values show a range, and missing or zero values show `未設定`. Physical-location reverse lists also omit prices.

G/K snapshot items additionally carry the ERP `存貨成本` range. Private-chat cards and full details show it as a locked per-unit cost; group and room replies never include cost. Other SKU families discard cost fields even if a caller supplies them.

In a private chat, sending an exact main-warehouse location such as `04-R05-02/T5`, `05-R04-03`, `AR01-03`, or `儲位 AR01-03` first asks whether unavailable items should be shown. The quick replies are `只看有庫存` and `顯示無庫存`; the selected filter is carried in the postback and remains active across every page without storing a pending user state. Explicit commands skip the question: for example, `AR03-03 顯示無庫存`, `AR03-03 只看有庫存`, and `儲位 AR03-03 不顯示無庫存`. Before SKU and keyword handling, the Worker normalizes the input and checks whether it exactly matches a current ERP `倉庫儲位` value; a match is treated as a physical location regardless of its shape, while a miss falls back to the existing SKU or keyword flow. Results include SKU, product name, style, size, and available quantity. `只看有庫存` excludes zero and negative availability; `顯示無庫存` keeps them visible with a warning. Replies show 10 rows per page with previous/next postbacks, omit costs and prices, and warn when the ERP snapshot is older than 30 minutes. Group and room messages do not expose this reverse inventory list. Each successful NAS sync builds a chunked 64-bucket exact-location reverse index before atomically publishing the new snapshot, keeping every stored value safely bounded even when one location contains many items. Snapshots created by an older Worker remain queryable through a bounded legacy fallback until the next sync.

Each successful ERP sync also reconciles the Shopee product-image queue. Images are copied into the dedicated `PRODUCT_IMAGES` Workers KV namespace and served from `/product-images/{sku}`; LINE keyword searches read this persistent cache and never perform a burst of live Shopee image requests. The Durable Object alarm processes exactly one product at a time, waits a randomized 45-75 seconds between products, pauses 15 minutes after every 20 attempts, caps work at 100 attempts per Taipei calendar day, and exponentially backs off when the NAS reader or Shopee is unavailable. A searched uncached product is only added to the priority queue; it is not fetched during the LINE reply.

During cache warm-up, a product image already supplied by the pure-profit dashboard remains visible on the LINE card. The queue copies it in the background, and the persistent Cloudflare image takes priority once available. Products for which the dashboard has no image still require one successful NAS lookup before their first cached image can appear.

G/K SKUs are handled separately because they are not listed on Shopee. On the first exact-SKU or keyword search without a cached image, the Worker asks the connected NAS reader to select the best local material, resize it to a LINE-safe square JPEG, and upload it through the authenticated `/reader/images/{sku}` endpoint. The Worker stores the bytes in the same `PRODUCT_IMAGES` KV namespace and records the selected file metadata in the Durable Object cache. Later searches use the persistent public Worker image URL immediately.

The authenticated `POST /reader/precache` endpoint starts a slow full warm-up for every G/K SKU in the active ERP main-warehouse snapshot. Its queue lives in the reader-broker Durable Object, processes only one NAS image every 45-75 seconds, skips existing KV images, and continues past missing folders. `GET /reader/precache` reports its queue and last result. Both methods require the existing NAS reader bearer token.

Image queue status is available to the ERP integration at `GET /erp/images/status` using the same `X-Erp-Sync-Token` header. The endpoint reports queue progress, current-day attempts, priority count, and the most recent success or error without exposing secret values.

Schedule lists use Shopee product IDs to look up `skuLabel` in the current pure-profit dashboard period and display `【貨號】商品名稱`. This requires the `PROFIT_DASHBOARD_BYPASS_TOKEN` Worker secret and gracefully falls back to the original name if the dashboard is unavailable.

Never commit secret values, `.dev.vars`, Wrangler caches, NAS cookies, or browser profiles.
