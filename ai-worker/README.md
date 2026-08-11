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

The Worker contains the LINE webhook, global shooting schedule, completed-history undo, OpenAI script generation, and the Durable Object broker used by the authenticated NAS Shopee reader.

Never commit secret values, `.dev.vars`, Wrangler caches, NAS cookies, or browser profiles.
