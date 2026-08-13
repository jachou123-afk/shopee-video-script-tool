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

The private-chat command `改儲位 {SKU}` starts a stateless, button-based dry-run wizard for `@059hdfyo` only. A multi-variant product first shows the actual ERP child SKUs; the user can choose one child or, for up to 10 children, `全部`. Empty or duplicate child IDs fail closed. The first release keeps A warehouse visible but unavailable; B warehouse supports zone `01`-`06`, side `L`/`R`, shelf `01`-`05`, level `01`-`04`, and tray `T1`-`T4`, producing a location such as `02-R04-01/T1`. Every selection is carried only in the LINE postback context and is not persisted. The final step re-reads the recent `InventoryId=1` snapshot and previews either the selected child or every selected child line by line. It deliberately performs no ERP write and refuses groups, malformed choices, stale snapshots, non-main warehouses, missing products, and stale child selections. The older full command `改儲位 {SKU} {新儲位}` remains available as a single-variant read-only shortcut.

The NAS ERP sync posts versioned location snapshots to `/erp/locations/push` with the `ERP_SYNC_TOKEN` secret. LINE users can query the active snapshot by directly sending a SKU such as `A725`; the older `儲位 A725` form remains supported. Exact-SKU queries and keyword searches use the same product card with image, stock, and primary locations. Its `完整儲位` action sends `完整儲位 {sku}` and returns the full text details for every variant. The snapshot is published only after all hashed storage buckets are written, so an empty or failed sync cannot replace the last good data.

Each successful ERP sync also reconciles the Shopee product-image queue. Images are copied into the dedicated `PRODUCT_IMAGES` Workers KV namespace and served from `/product-images/{sku}`; LINE keyword searches read this persistent cache and never perform a burst of live Shopee image requests. The Durable Object alarm processes exactly one product at a time, waits a randomized 45-75 seconds between products, pauses 15 minutes after every 20 attempts, caps work at 100 attempts per Taipei calendar day, and exponentially backs off when the NAS reader or Shopee is unavailable. A searched uncached product is only added to the priority queue; it is not fetched during the LINE reply.

During cache warm-up, a product image already supplied by the pure-profit dashboard remains visible on the LINE card. The queue copies it in the background, and the persistent Cloudflare image takes priority once available. Products for which the dashboard has no image still require one successful NAS lookup before their first cached image can appear.

G/K SKUs are handled separately because they are not listed on Shopee. On the first exact-SKU or keyword search without a cached image, the Worker asks the connected NAS reader to select the best local material, resize it to a LINE-safe square JPEG, and upload it through the authenticated `/reader/images/{sku}` endpoint. The Worker stores the bytes in the same `PRODUCT_IMAGES` KV namespace and records the selected file metadata in the Durable Object cache. Later searches use the persistent public Worker image URL immediately.

The authenticated `POST /reader/precache` endpoint starts a slow full warm-up for every G/K SKU in the active ERP main-warehouse snapshot. Its queue lives in the reader-broker Durable Object, processes only one NAS image every 45-75 seconds, skips existing KV images, and continues past missing folders. `GET /reader/precache` reports its queue and last result. Both methods require the existing NAS reader bearer token.

Image queue status is available to the ERP integration at `GET /erp/images/status` using the same `X-Erp-Sync-Token` header. The endpoint reports queue progress, current-day attempts, priority count, and the most recent success or error without exposing secret values.

Schedule lists use Shopee product IDs to look up `skuLabel` in the current pure-profit dashboard period and display `【貨號】商品名稱`. This requires the `PROFIT_DASHBOARD_BYPASS_TOKEN` Worker secret and gracefully falls back to the original name if the dashboard is unavailable.

Never commit secret values, `.dev.vars`, Wrangler caches, NAS cookies, or browser profiles.
