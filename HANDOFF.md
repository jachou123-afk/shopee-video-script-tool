# Shopee Video Script Tool — Handoff

## Current production state

- Frontend: <https://jachou123-afk.github.io/shopee-video-script-tool/>
- Cloudflare Worker: <https://shopee-video-script-ai.jachou123-afk.workers.dev>
- Worker version at handoff: `bf2e9e4f-092f-407e-a789-30c6877f6443`
- LINE bot commands and schedules are implemented in `ai-worker/src/index.js`.
- The authenticated Shopee reader runs separately on the NAS. Its login session and token are intentionally not committed.
- Validation status: all 38 Worker tests pass.

## LINE workflow

- `@文案小幫手`: show all commands and open the 10-second single-link window.
- `廣告影片排程` plus one or more Shopee URLs: add items to the global queue.
- `要拍什麼`: list the global pending queue.
- A number such as `2`: generate the stored item's default 40-second script without asking for the URL again.
- `完成2`: move pending item 2 to completed.
- `已拍完`: list completed details, employee, and completion time.
- `取消完成1`: move completed item 1 back to pending.
- `A12345`: directly return the ERP 主倉 location and available quantity; no mention is required. Lowercase input is normalized to uppercase.
- `儲位 A12345`: remains supported for backward compatibility.

All groups and private chats share one global schedule. When an older chat first uses a schedule command, its previous per-chat records are merged into the global queue.

Pending and completed schedule lists extract the Shopee product ID from `/product/{shopId}/{productId}` and query the current pure-profit dashboard data. When a match is available, the item is displayed as `【貨號】商品名稱`, for example `【A725】水垢魔力擦`. Existing schedule records do not need to be re-added.

The pure-profit lookup uses the `PROFIT_DASHBOARD_BYPASS_TOKEN` Cloudflare Worker secret. The value is intentionally not committed. Lookup failures fall back to the original product name so schedule listing remains available.

## LINE schedule generation concurrency

Sending two schedule numbers almost simultaneously previously overloaded the single authenticated NAS browser. Reproduction showed one request taking 36.8 seconds and returning 503 while another took 28.3 seconds, exceeding or approaching Cloudflare's 30-second `waitUntil()` window. Production now uses a Durable Object generation lock: one schedule script runs at a time, a concurrent number receives an immediate busy reply, and a 24-second abort deadline returns a retry message instead of silently losing the LINE reply.

## Continue from another computer

1. Clone this repository.
2. Install Node.js 22 or newer and Wrangler.
3. Run `node --test ai-worker/test/index.test.mjs`.
4. Authenticate with `wrangler login`.
5. Deploy from `ai-worker` with `wrangler deploy`.

Required Worker secrets are listed in `ai-worker/wrangler.jsonc`. Secret values, NAS browser state, logs, and local Wrangler caches are not stored in GitHub.

Recent handoff changes on `agent/line-schedule-handoff` include LINE generation concurrency protection, direct SKU warehouse lookup, pure-profit SKU labels, and ERP main-warehouse location sync.

The separate NAS ERP project downloads both `InventoryId=-1` (不分倉, used by the existing calculations) and `InventoryId=1` (主倉, used for `倉庫儲位`) during one authenticated run. It retains the previous Worker snapshot whenever the main-warehouse export or location push fails.
