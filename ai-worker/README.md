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

The NAS ERP sync posts versioned location snapshots to `/erp/locations/push` with the `ERP_SYNC_TOKEN` secret. LINE users can query the active snapshot by directly sending a SKU such as `A725`; the older `儲位 A725` form remains supported. The snapshot is published only after all hashed storage buckets are written, so an empty or failed sync cannot replace the last good data.

Each successful ERP sync also reconciles the Shopee product-image queue. Images are copied into the dedicated `PRODUCT_IMAGES` Workers KV namespace and served from `/product-images/{sku}`; LINE keyword searches read this persistent cache and never perform a burst of live Shopee image requests. The Durable Object alarm processes exactly one product at a time, waits a randomized 45-75 seconds between products, pauses 15 minutes after every 20 attempts, caps work at 100 attempts per Taipei calendar day, and exponentially backs off when the NAS reader or Shopee is unavailable. A searched uncached product is only added to the priority queue; it is not fetched during the LINE reply.

Image queue status is available to the ERP integration at `GET /erp/images/status` using the same `X-Erp-Sync-Token` header. The endpoint reports queue progress, current-day attempts, priority count, and the most recent success or error without exposing secret values.

Schedule lists use Shopee product IDs to look up `skuLabel` in the current pure-profit dashboard period and display `【貨號】商品名稱`. This requires the `PROFIT_DASHBOARD_BYPASS_TOKEN` Worker secret and gracefully falls back to the original name if the dashboard is unavailable.

Never commit secret values, `.dev.vars`, Wrangler caches, NAS cookies, or browser profiles.
