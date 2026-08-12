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

Schedule lists use Shopee product IDs to look up `skuLabel` in the current pure-profit dashboard period and display `【貨號】商品名稱`. This requires the `PROFIT_DASHBOARD_BYPASS_TOKEN` Worker secret and gracefully falls back to the original name if the dashboard is unavailable.

Never commit secret values, `.dev.vars`, Wrangler caches, NAS cookies, or browser profiles.
