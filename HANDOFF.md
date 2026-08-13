# Shopee Video Script Tool — Handoff

## Current production state

- Frontend: <https://jachou123-afk.github.io/shopee-video-script-tool/>
- Cloudflare Worker: <https://shopee-video-script-ai.jachou123-afk.workers.dev>
- Worker version at handoff: `4b261311-1537-4ceb-8c9f-647c0a93a68a`
- LINE bot commands and schedules are implemented in `ai-worker/src/index.js`.
- The authenticated Shopee reader source is in `nas-shopee-reader/` and runs separately on the NAS. Its `.env`, browser profile, login session, and token are intentionally not committed.
- Validation status: all 48 Worker tests and all 9 NAS reader tests pass.

## Persistent product-image cache (2026-08-13)

- Shopee first images are now copied into a dedicated Cloudflare Workers KV namespace (`PRODUCT_IMAGES`, namespace ID `a3dd5675565242ab939fc138030dba5f`) and served by the Worker at `/product-images/{sku}`. LINE cards use this stored copy, so an already-cached image does not depend on the NAS browser, Shopee login state, or the Shopee image URL remaining available at query time.
- A successful ERP main-warehouse sync reconciles all SKUs that have a Shopee product mapping in the pure-profit dashboard. A LINE keyword search can also add the displayed uncached SKUs to the priority queue, but never waits for a live image fetch.
- The image worker is a Durable Object alarm queue: exactly one product is processed per alarm, the randomized interval is 45-75 seconds, every 20 attempts is followed by a 15-minute pause, and the Taipei-day cap is 100 attempts. Errors use exponential backoff up to six hours; a single product is skipped after three failures so it cannot block the entire queue forever. A later ERP sync queues failed products again.
- When the dashboard already exposes a Shopee image ID/URL, the Worker downloads that image without using the NAS. When it does not (for example A235 at diagnosis time), the alarm asks the authenticated NAS reader for the first image and then copies the resulting bytes into Cloudflare KV.
- While a dashboard image is waiting for its persistent Cloudflare copy, LINE cards continue showing the dashboard-provided Shopee image immediately. The background queue still caches it, and subsequent cards prefer the Cloudflare copy. This prevents existing image cards (for example a `洗衣袋` search) from temporarily losing their image during cache warm-up.
- The protected queue status endpoint is `GET /erp/images/status` and uses the existing `X-Erp-Sync-Token` header. It reports queue progress, priority count, daily attempt count, and the last cache error/success.
- R2 was intentionally not used because the Cloudflare account returned API code `10042` (R2 not enabled). Workers KV was already available, supports binary values, and avoids requiring a new Cloudflare billing/storage activation for this feature.

### NAS-local G/K images deployed (2026-08-13)

- The NAS `shopee-reader` container was rebuilt from the checked-in G/K image source and is healthy with `workerConnected: true`. Its read-only mounts are `/volume1/圖片區/G類-娃娃機吊飾` and `/volume1/圖片區/K類-娃娃機吊飾2`.
- Production selection chose `G041爆米花吊飾/圖片_20230306172853.jpg` from 3 candidates (source 3000×3000) and `K017鴻圖大展吊飾/01.jpg` from 8 candidates (source 1200×1680).
- Both selected files were converted in memory to 1200×1200 JPEG derivatives and uploaded successfully to `PRODUCT_IMAGES`. The public endpoints `/product-images/G041` and `/product-images/K017` both returned HTTP 200 and were independently decoded as 1200×1200 JPEG files. The original NAS materials were not modified or exposed.
- The temporary root SSH public key was removed from `/root/.ssh/authorized_keys` after verification, and the recovered local private-key file was deleted.
- A final visual check still requires sending `G041` and `K017` from a personal LINE account; LINE Official Account Manager can only send outbound operator messages and does not invoke the webhook.

### G/K LINE image-index repair deployed (2026-08-13)

- Worker version `2a251c55-84dd-4c0b-a29f-0e46c9d5736e` fixes the case where a NAS image existed in `PRODUCT_IMAGES` but LINE exact-SKU and keyword cards still had no image because the Durable Object image index was missing.
- A new NAS upload now stores the binary in KV and immediately records its public URL in the global Durable Object index. If an older G/K image is already in KV, an exact SKU query or image-cache request repairs the missing index automatically without asking the NAS to upload again.
- The regression test covers immediate indexing and recovery from a deliberately cleared Durable Object cache. Production checks after deployment returned HTTP 200 `image/jpeg` for both `/product-images/G041` (115068 bytes) and `/product-images/K017` (238557 bytes).
- Final LINE rendering must still be confirmed from a personal LINE account by sending `G041` and `K017`; that inbound message is what invokes the production webhook and also backfills any older missing index record.
- Worker version `ccea41a2-2ba1-4529-9b88-522721017da8` fixes a second G/K on-demand bug: uncached local-image jobs were previously sent to the global schedule Durable Object, while the NAS WebSocket belongs to `shopee-reader-broker-v1`. This made every uncached SKU (for example `G045`) fail with `SHOPEE_READER_OFFLINE` even when `/reader/status` reported connected. On-demand work is now dispatched through the reader broker and the resulting image record is copied into the global schedule index.
- Production evidence before the fix: `G045` at 16:52:49 and `G101` at 16:53:06 both logged `WAREHOUSE_NAS_IMAGE ... SHOPEE_READER_OFFLINE`. NAS File Station confirmed `G045重機吊飾+掛繩` exists with five JPG candidates. The new cross-Durable-Object regression test verifies a `G045` LINE query reaches the broker, returns the image card, and persists the global index.

### G/K full precache queue started (2026-08-13)

- Worker version `4b261311-1537-4ceb-8c9f-647c0a93a68a` adds a dedicated NAS-local image precache queue inside `shopee-reader-broker-v1`, the same Durable Object that owns the live NAS WebSocket. It reads the active ERP main-warehouse snapshot, filters only G/K SKUs, processes one SKU per alarm, and waits a randomized 45-75 seconds between every success or non-connectivity failure. Reader-offline failures wait five minutes without advancing the item.
- Existing `PRODUCT_IMAGES` objects are skipped in small groups of at most 20 KV reads per alarm. A missing NAS folder or unusable material is counted as failed and the queue proceeds, so one SKU cannot stop the whole run. Re-running the protected start endpoint retries failures while immediately skipping images already cached.
- The protected control endpoint is `POST /reader/precache`; `GET /reader/precache` reports progress. Both use the existing NAS reader bearer token and do not expose it. The production queue was started from the current ERP snapshot with 1,488 G/K SKUs. Initial verification advanced from `G001` to `G002`; both were correctly recorded as `NAS_IMAGE_SKU_FOLDER_NOT_FOUND`, proving missing folders do not block progress.

## LINE rich menu (2026-08-13)

- A 2500 x 1686 six-button rich menu is active as the Messaging API default for `@037vajci` (`【長頸鹿】下單小幫手`). Its LINE ID is `richmenu-4e7e2a8351c483b285c2d8b0a1038473`.
- The six message actions are `查`, `要拍什麼`, `廣告影片排程`, `已拍完`, `產生文案`, and `使用方法`.
- The image source is `line-assets/rich-menu-v2.png`; regenerate it deterministically with `line-assets/build-rich-menu.ps1`.
- `使用方法` and a mention-only message return six quick-reply shortcuts. `產生文案` asks for a Shopee product URL instead of falling through to ERP keyword search.
- Rich menus appear in the LINE mobile app, not LINE for PC. After a change, reopen the chat; LINE may take up to one minute to refresh the default menu.
- The menu was created through the official Messaging API because the Chrome extension could not pass a local file to LINE Official Account Manager. The temporary Cloudflare setup route and `RICH_MENU_SETUP_TOKEN` secret were removed immediately after activation. The unsaved Manager create form can be discarded.

## LINE workflow

- `@文案小幫手`: show all commands and open the 10-second single-link window.
- `廣告影片排程` plus one or more Shopee URLs: add items to the global queue.
- `要拍什麼`: list the global pending queue.
- A number such as `2`: generate the stored item's default 40-second script without asking for the URL again.
- `完成2`: move pending item 2 to completed.
- `已拍完`: list completed details, employee, and completion time.
- `取消完成1`: move completed item 1 back to pending.
- `A12345`: return the same product card as a keyword search, including the cached image when available, stock, and primary ERP 主倉 locations; no mention is required. Lowercase input is normalized to uppercase.
- `儲位 A12345`: remains supported for backward compatibility.
- `完整儲位 A12345`: return the full text location details for every variant. Product-card buttons emit this command so exact-SKU cards do not loop back into themselves.
- A bare product keyword such as `洗衣袋`: search the ERP catalog without mentioning the bot and return up to ten Flex cards with product image (when available), SKU, name, stock, primary locations, a full-location button, and a Shopee product button.
- Single-character keywords are supported, so `襪`, `搜 襪`, and `查 襪` all search the existing ERP catalog index.
- `查 洗衣袋` and `儲位 洗衣袋`: explicit keyword-search forms with the same result. These forms work in private chats and groups.

All groups and private chats share one global schedule. When an older chat first uses a schedule command, its previous per-chat records are merged into the global queue.

Pending and completed schedule lists extract the Shopee product ID from `/product/{shopId}/{productId}` and query the current pure-profit dashboard data. When a match is available, the item is displayed as `【貨號】商品名稱`, for example `【A725】水垢魔力擦`. Existing schedule records do not need to be re-added.

The pure-profit lookup uses the `PROFIT_DASHBOARD_BYPASS_TOKEN` Cloudflare Worker secret. The value is intentionally not committed. Lookup failures fall back to the original product name so schedule listing remains available.

ERP keyword search is backed by the same atomic Durable Object snapshot as direct SKU lookup. New location syncs publish compact search chunks; the deployed Worker can also search the existing 64 legacy location buckets immediately, so no forced ERP re-sync is required for this release. Product IDs, Shopee URLs, and available image fields are enriched from the private pure-profit dashboard. Missing images use the authenticated NAS reader as a best-effort fallback, and cards still render without an image when Shopee blocks the fallback.

## LINE schedule generation concurrency

Sending two schedule numbers almost simultaneously previously overloaded the single authenticated NAS browser. Reproduction showed one request taking 36.8 seconds and returning 503 while another took 28.3 seconds, exceeding or approaching Cloudflare's 30-second `waitUntil()` window. Production now uses a Durable Object generation lock: one schedule script runs at a time, a concurrent number receives an immediate busy reply, and a 24-second abort deadline returns a retry message instead of silently losing the LINE reply.

## Script-generation latency

- Worker version `9f027c84-c0a8-41d3-ad4a-8344c661bdf5` sends `reasoning: { effort: "none" }` to `gpt-5.6-luna`, while retaining the same structured 40-second script schema and full-product-content requirement.
- A production request after the Worker change completed successfully with `pageContentRead: true` in 27.76 seconds. This showed that the remaining bottleneck was primarily the NAS browser path.
- `nas-shopee-reader/src/browser.mjs` now checks a six-hour in-memory product cache, then calls Shopee's authenticated product API through the already-open control page, and opens a full product page only as a fallback.
- The NAS fast path was deployed on 2026-08-12. The host source and running container both had SHA-256 `aa7e0733d92545546a4cb47033690d077dcf029d2bae5945aaad4b7204939ad8`; `.env` and `data/profile` were preserved. Because rebuilding the full Playwright base image exceeded ten minutes on the NAS, production uses a safe incremental image layer based on the existing image. A future normal full build from the committed source will contain the same code.
- Production benchmarks after deployment all returned HTTP 200 with `pageContentRead: true`: 7.17 seconds for the first request, 5.43 seconds for the repeated cached request, and 5.50 seconds for a different uncached product. Before the NAS fast path, the same workflow took 27.76 seconds.
- The pre-deployment reader source is retained on the NAS as `src/browser.mjs.bak-20260812-173917`. The temporary root SSH key and temporary build context were removed after verification.
- The keyword-card image update was deployed to the NAS on 2026-08-13. The host source and running container both match SHA-256 `f5de4f3527471bb66909446371701e92208efbe0d5d230eb5b120c1ad9b9b138` for `browser.mjs` and `b3df5e3ff9625daa04bb32aa61de3e4d47a212cc0a0c71db7bf4125d75a20544` for `shopee.mjs`. Backups are `src/browser.mjs.bak-20260813-130701` and `src/shopee.mjs.bak-20260813-130701`; `.env` and `data/profile` were preserved. The temporary root SSH key and incremental build context were removed after verification.
- Operational note at this handoff: the NAS health endpoint is up and connected to the Worker, but the persistent Shopee control page is currently on a Shopee CAPTCHA URL. A production script request therefore returned HTTP 503 until that CAPTCHA/login check is completed through the NAS noVNC page. This does not prevent ERP keyword text/location results; it only affects authenticated product-content reads and best-effort missing-image fallback.

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

## `@059hdfyo` warehouse-position dry run (button workflow, 2026-08-13)

- Warehouse-position work is scoped only to `@059hdfyo` (`廣告文案小幫手`). `@037vajci` is a separate official account and must not receive this workflow.
- Private-chat command: `改儲位 A861`. It opens LINE quick-reply buttons; the older full command `改儲位 A861 02-R04-01/T3` remains a read-only shortcut.
- A multi-variant product such as `A823` first reads the current ERP snapshot and shows its real child SKUs (for example `-01` through `-06`) plus `全部`. A single child preview selects exactly one matching barcode. `全部` is offered only when there are at most 10 children and lists every old-to-new location line in the final preview. Missing or duplicate child IDs stop the entire flow.
- A倉 remains visible but returns an unavailable notice. B倉 supports zone `01`-`06`, direction `L`/`R`, shelf `01`-`05`, level `01`-`04`, and tray `T1`-`T4`. For example, B倉 → `02` → `R` → `R04` → `01` → `T1` builds `02-R04-01/T1`.
- The wizard is stateless: each LINE postback carries the already-selected values, every value is checked against an allowlist, and no selection is written to KV, Durable Object storage, or ERP.
- The Worker calls LINE `GET /v2/bot/info` and refuses the command unless the active channel token reports Basic ID `@059hdfyo`. Group and room commands are refused.
- This phase reads only the existing ERP main-warehouse cloud snapshot with image lookup disabled. It does not create a confirmation transaction, call an ERP write endpoint, or change Durable Object storage.
- The preview fails closed unless the snapshot is `InventoryId=1`, is no more than 30 minutes old, and every requested child SKU still resolves uniquely when the final button is pressed. Missing, duplicate, or changed variants are never guessed.
- The reply shows product, variant, stock, old location, proposed location, snapshot time, and states that only `DepotPosition` would be allowed to change in a later write phase.
- Worker validation is 55/55 tests passing after this change, including single-child, `全部`, complete button paths, and assertions that Durable Object storage remains unchanged.

## Planned LINE-to-ERP warehouse-position writeback (investigated 2026-08-13; not implemented)

The requested future workflow is a LINE command such as `改儲位 A861 02-R04-01/T3`. It must update the actual uSale ERP product inventory record, not the exported workbook or the Cloudflare lookup snapshot. The example currently resolves to product `A861`, item UID `A861-01`, main warehouse `InventoryId=1`, and current `DepotPosition=02-R04-01/T4`.

Read-only inspection was performed while the ERP page showed `Hi ! codex`; no form was submitted and no data was modified. The product detail UI exposes `編輯庫存資料`. The published uSale frontend implementation in `Component/GoodDetailDialog/GoodDetailDialog.js` shows that it loads the product with `Mallbic.U.Sale.Ajax.GoodUtil.GetGoodData(aGoodId)` and saves inventory details through `Mallbic.U.Sale.Ajax.GoodUtil.SaveInventoryDetail(aData)`. The AjaxPro proxy is `/ajaxpro/Mallbic.U.Sale.Ajax.GoodUtil,uSale.ashx`.

Important safety finding: `SaveInventoryDetail` is not a narrow `set location` call. The UI packs every product specification and every warehouse into `SubGoodList`; each warehouse entry contains `GKey { ID, StyleIdx, InventoryId }`, `DepotPosition`, `Inventory`, `SafetyStock`, and `OrigInventory`. The same payload also contains item UID, sale mode, price, firm information, costs, dimensions, lead time, expiry, and `BaseMD5=m_current_good_data.GoodMD5`. Therefore an incomplete or stale payload could overwrite unrelated product or inventory fields. uSale uses the MD5/original-inventory values to detect concurrent changes and can return an `InconsistList`; automation must fail closed on any such response.

Do not implement the LINE command by export/edit/import. The ERP batch importer (`Good_BatchImporter.aspx`) requires `overwrite_existed`, optionally `update_inventory`, and `target_warehouse`. It is intended for batch product creation/overwrite and creates an unnecessarily large blast radius for a one-field LINE update: a malformed workbook or wrong option can affect item UIDs, styles, sizes, price, cost, stock, or the wrong warehouse. Mouse-coordinate automation is also not recommended because dialogs, horizontal scrolling, loading delay, and multiple specifications make it fragile.

Recommended implementation for the next session:

1. Accept write commands only from an explicit LINE user-ID allowlist, initially in private chat only.
2. Resolve the exact ERP product, item UID/specification, and `InventoryId=1`. If a product has more than one specification, require the user to select the exact item; never update all variants implicitly.
3. Use the NAS `codex` ERP session to call `GetGoodData` immediately before presenting confirmation. Show product/item, main warehouse, old position, and requested new position.
4. Store a short-lived confirmation transaction. After `確認修改`, call `GetGoodData` again and reject the request if `GoodMD5`, current position, item mapping, or any expected identifier changed.
5. Clone the complete latest ERP payload and change only the matched main-warehouse entry's `DepotPosition`; preserve every other field byte-for-byte/semantically identical. Send `SaveInventoryDetail` with the fresh `BaseMD5` and `OrigInventory` values.
6. Treat any ERP error, inconsistency response, timeout, or ambiguous item match as failure. Never retry a write blindly.
7. Re-read with `GetGoodData` after success. Report success only if the selected `DepotPosition` exactly matches and non-position fields remain unchanged. Then trigger a main-warehouse snapshot refresh so LINE reads the new value immediately instead of waiting for the normal sync.
8. Write an immutable audit record containing LINE user/group, product, item UID, warehouse ID, old/new position, request time, confirmation time, ERP result, and verification result. Provide undo only after re-reading and confirming that the current value still equals the value written by that audit record.

No writeback code or credential changes were made during this investigation.
