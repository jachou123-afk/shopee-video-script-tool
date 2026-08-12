# Shopee Video Script Tool — Handoff

## Current production state

- Frontend: <https://jachou123-afk.github.io/shopee-video-script-tool/>
- Cloudflare Worker: <https://shopee-video-script-ai.jachou123-afk.workers.dev>
- Worker version at handoff: `9f027c84-c0a8-41d3-ad4a-8344c661bdf5`
- LINE bot commands and schedules are implemented in `ai-worker/src/index.js`.
- The authenticated Shopee reader source is in `nas-shopee-reader/` and runs separately on the NAS. Its `.env`, browser profile, login session, and token are intentionally not committed.
- Validation status: all 38 Worker tests and all 5 NAS reader tests pass.

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

## Script-generation latency

- Worker version `9f027c84-c0a8-41d3-ad4a-8344c661bdf5` sends `reasoning: { effort: "none" }` to `gpt-5.6-luna`, while retaining the same structured 40-second script schema and full-product-content requirement.
- A production request after the Worker change completed successfully with `pageContentRead: true` in 27.76 seconds. This showed that the remaining bottleneck was primarily the NAS browser path.
- `nas-shopee-reader/src/browser.mjs` now checks a six-hour in-memory product cache, then calls Shopee's authenticated product API through the already-open control page, and opens a full product page only as a fallback.
- The NAS fast path was deployed on 2026-08-12. The host source and running container both had SHA-256 `aa7e0733d92545546a4cb47033690d077dcf029d2bae5945aaad4b7204939ad8`; `.env` and `data/profile` were preserved. Because rebuilding the full Playwright base image exceeded ten minutes on the NAS, production uses a safe incremental image layer based on the existing image. A future normal full build from the committed source will contain the same code.
- Production benchmarks after deployment all returned HTTP 200 with `pageContentRead: true`: 7.17 seconds for the first request, 5.43 seconds for the repeated cached request, and 5.50 seconds for a different uncached product. Before the NAS fast path, the same workflow took 27.76 seconds.
- The pre-deployment reader source is retained on the NAS as `src/browser.mjs.bak-20260812-173917`. The temporary root SSH key and temporary build context were removed after verification.

## Continue from another computer

1. Clone this repository.
2. Install Node.js 22 or newer and Wrangler.
3. Run `node --test ai-worker/test/index.test.mjs`.
4. Run `node --test nas-shopee-reader/test/shopee.test.mjs`.
5. Authenticate with `wrangler login`.
6. Deploy from `ai-worker` with `wrangler deploy`.

Required Worker secrets are listed in `ai-worker/wrangler.jsonc`. Secret values, NAS browser state, logs, and local Wrangler caches are not stored in GitHub.

Recent handoff changes on `agent/line-schedule-handoff` include LINE generation concurrency protection, direct SKU warehouse lookup, pure-profit SKU labels, and ERP main-warehouse location sync.

The separate NAS ERP project downloads both `InventoryId=-1` (不分倉, used by the existing calculations) and `InventoryId=1` (主倉, used for `倉庫儲位`) during one authenticated run. It retains the previous Worker snapshot whenever the main-warehouse export or location push fails.
