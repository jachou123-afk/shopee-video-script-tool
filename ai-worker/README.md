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

The Worker contains the LINE webhook, global shooting schedule, completed-history undo, ERP main-warehouse location lookup, OpenAI script generation, and the Durable Object broker used by the authenticated NAS Shopee reader.

The NAS ERP sync posts versioned location snapshots to `/erp/locations/push` with the `ERP_SYNC_TOKEN` secret. LINE users can then query the active snapshot with `儲位 貨號`. The snapshot is published only after all hashed storage buckets are written, so an empty or failed sync cannot replace the last good data.

Never commit secret values, `.dev.vars`, Wrangler caches, NAS cookies, or browser profiles.
