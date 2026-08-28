# Shopee Video Script Tool — Handoff

## 下一台電腦開始工作前（必須先執行）

下一位 Codex 在公司電腦讀到本文件後，必須先同步本交接分支，再進行任何修改；不需要使用者自行輸入指令：

```powershell
git status -sb
git fetch origin
git switch agent/line-schedule-handoff
git pull --ff-only origin agent/line-schedule-handoff
```

- 同步後確認 `git rev-parse HEAD` 至少包含本次交接提交，並重新讀取完整 `HANDOFF.md`。
- 如果 `git status -sb` 顯示公司電腦有未提交或未追蹤的內容，不可覆蓋、重設或刪除；先檢查差異並向使用者回報，再安全整合。
- 工作目標帳號是 `@059hdfyo`。`@037vajci` 是使用者另外使用的帳號，不可修改。
- 正式功能目前仍是純演練版：只預覽儲位，不得寫入 ERP。除非使用者之後明確同意進入下一階段，否則維持唯讀。

## 交接文件維護規則（永久執行）

- 每次修改程式、設定、測試、LINE 選單、Cloudflare Worker、NAS、ERP 整合或操作流程，都必須在同一次工作中主動更新本 `HANDOFF.md`，不需要等待使用者另外下指令。
- 交接更新至少記錄：台北時間日期、修改內容與原因、影響帳號／服務、安全限制、測試結果、是否已部署、部署版本或提交，以及尚未完成或被阻擋的事項。
- 如果修改尚未發布，必須明確寫「尚未部署」；如果已發布，必須記錄可核對的部署版本。不可讓交接文件把本機修改誤寫成正式上線。
- 修改完成後應將交接文件與相關程式一起提交並推送到目前的雲端交接分支，除非使用者明確要求不要提交或不要推送。
- 不得把密碼、Token、Cookie、登入狀態、私鑰或其他秘密值寫入交接文件或 Git。

## LINE 私訊查 ERP 訂單（2026-08-28，尚未部署）

- 目標帳號仍是 `@059hdfyo`。一對一私訊可直接輸入出貨單右上角列印號碼（例如 `0350000-10747554`），也支援 `訂單 {編號}`、ERP 交易序號與平台訂單編號；群組及聊天室不回傳訂單資料。
- NAS 以 ERP「訂單管理／匯出訂單」內既有的 `codex抓資料` 設定，唯讀抓最近 7 個台北日。每次先把 Big5/CP950 原始 CSV 與 SHA-256 manifest 保存到 NAS 私有設定區，再解析；去識別化訂單索引累積保留 90 天，原始匯出保留 30 天。
- 傳到 Worker 的欄位只含交易／平台單號、狀態、出貨資訊、品項、樣式、數量、單價、總計與儲位區；收件人姓名、買家姓名、電話及地址不會進入 payload。Worker 會再次白名單化欄位，陌生欄位即使被送入也不會保存。
- 訂單查詢由 `LINE_ORDER_ALLOWED_USER_IDS` Cloudflare Secret 控制，只允許指定 LINE user ID 的私訊。Secret 不得寫入 Git；目前仍待使用者於本次工作確認傳送後設定。資料更新超過 30 分鐘時停止回覆明細，避免回傳舊訂單。
- NAS 新增 `/erp/orders/push` 推送，沿用既有 `ERP_SYNC_TOKEN`；Worker Durable Object 以版本化 chunk 與 128 個 alias bucket 原子發布，空資料可代表查詢期間沒有訂單，但失敗同步不覆蓋前一版。
- 驗證：Worker `node --check` 與 67/67 項測試通過；NAS `py_compile` 與 60/60 項測試通過。測試包含列印號碼正規化、平台單號別名、PII 丟棄、30 分鐘失效保護、Big5 CSV、原始雜湊 manifest 與 90 天索引。
- 尚未部署：等待 Cloudflare 白名單 Secret 的使用者明確確認；之後仍需部署 Worker、備份並更新 NAS 正式檔、確認第一次訂單快照成功，以及用真實 `0350000-10747554` 完成 LINE 私訊驗收。

## LINE 私訊查貨號顯示 ERP 售價（2026-08-27，已正式部署，待 LINE 私訊驗收）

- NAS ERP 主倉快照現在會為每個貨號帶入所有正數 `售價` 的最低值與最高值；同貨號各款式價格相同時顯示單一價格，不同時顯示區間，未設定或 0 顯示「未設定」，不修改 ERP 資料。
- `@059hdfyo` 一對一私訊查貨號、品名關鍵字卡片與 `完整儲位 {貨號}` 會顯示「ERP 售價：NT$…／個」。群組／聊天室回覆、依實體儲位反查的品項清單仍不顯示售價或成本。
- 原 G／K 私訊存貨成本顯示與其他查詢規則均保留；沒有 D1／KV schema、環境變數或密鑰變更，也沒有修改 `@037vajci`。
- 驗證：Worker `node --check` 通過且 `63/63` 項測試通過；NAS ERP 同步端 `57/57` 項測試通過。回歸測試涵蓋單一價格、價格區間、未設定價格、所有貨號系列、群組隱藏與舊快照相容。
- GitHub 正式來源已推送：本儲存庫 `agent/line-schedule-handoff` commit `b8efc5b4b330c61b1040660c01d63ee959592dd1`；NAS 同步來源已快轉至 `profit-analysis-cloud/main` commit `cac70041a60ac8f2cec2ebecec9e7108ccbe7291`。
- Cloudflare Worker version `b2c7cf17-3c48-4027-8e25-c669237da3e8` 已於 2026-08-27 21:59:36 +08:00 部署並確認承接 100% 流量；公開根端點回讀為預期 HTTP 405。
- NAS 正式檔已先備份為 `/volume1/docker/erp-sync/backups/erp_sync.py.before-line-sale-price-20260827-221057`，再更新 `/volume1/docker/erp-sync/erp_sync.py`。正式檔為 79,324 Bytes，DSM MD5 `B080AE1CD2AD1F17375D90A5F525683D` 與本機交付檔完全一致；容器維持運作、未停止或重建。
- NAS 更新後的新一輪主倉快照已於 2026-08-27 22:32:07 +08:00 由 `Synology-ERP-Sync/1.0` 推送；正式 `/erp/locations/push` 與 Durable Object `/warehouse-locations/sync` 均回 HTTP 200，承接版本為 `b2c7cf17-3c48-4027-8e25-c669237da3e8`，請求內容長度為 1,320,854 Bytes。
- 待完成：請使用者於 `@059hdfyo` 一對一私訊實查貨號及 `完整儲位 {貨號}`；真實 LINE 畫面完成前不標為最終驗收完成。

## 儲位反查「先詢問／明確指令直查」（2026-08-27，已正式部署，待 LINE 私訊驗收）

- `@059hdfyo` 私訊只輸入 ERP 已知儲位（例如 `AR03-03` 或 `儲位 AR03-03`）時，現在先詢問「是否顯示無庫存品項？」並提供 `只看有庫存`／`顯示無庫存` 兩個 LINE 快速按鈕。
- 明確指令不再詢問，直接回覆：支援 `AR03-03 顯示無庫存`、`AR03-03 只看有庫存`、`儲位 AR03-03 不顯示無庫存`，並保留全形字元與大小寫正規化。
- `只看有庫存` 排除可用量 `0` 與負數；回覆的貨號數、品項數及總頁數均依篩選後資料重新計算。上一頁／下一頁 postback 會攜帶同一篩選條件，不會翻頁後恢復顯示無庫存。
- 詢問按鈕直接攜帶正規化儲位與篩選選項，不保存待處理使用者狀態。實體儲位清單仍只限一對一私訊、仍不顯示成本或售價、仍只讀 Cloudflare 的 ERP 主倉快照，沒有寫入 ERP、沒有 D1／KV schema 或密鑰變更，也沒有修改 `@037vajci`。
- 驗證：`node --check ai-worker/src/index.js` 通過；Worker `63/63` 項測試通過，涵蓋明確指令、先詢問按鈕、正／零／負庫存篩選、正確總數與分頁、舊快照相容及群組不回傳實體儲位清單。
- 功能與交接文件已提交並推送到正式 `agent/line-schedule-handoff` 分支，來源 commit 為 `279cc5724de8f10d2c533fc2d28c5ddfacf79cb0`。
- Cloudflare Worker version `5a68527f-e6e0-4ded-8ee7-3502e2f4b324` 已於 2026-08-27 21:45:38 +08:00 部署並確認承接 100% 流量；21:46 正式公開端點回讀為預期的 HTTP 405 JSON `Method not allowed`，證明新 Worker 可連線且路由正常。
- 尚待使用者在 `@059hdfyo` 一對一私訊分別測試 `AR03-03`、`AR03-03 只看有庫存`、`AR03-03 顯示無庫存`，確認實際 LINE 問句、兩個快速按鈕與結果內容；完成這項使用者端驗收前，不把 LINE 畫面流程標成最終驗收完成。

## Location-to-items lookup deployed (2026-08-26)

- Source commit `2643a9f1cd2d5597d118fde7a9390defb9b4cd35` adds a read-only private-chat lookup from an exact main-warehouse location to every item stored there. The user approved production release on 2026-08-26, and the commit was fast-forwarded to the formal `agent/line-schedule-handoff` branch before deployment.
- Accepted forms include `04-R05-02/T5`, `05-R04-03`, and `儲位 04-R05-02/T5`. Parsing happens before SKU parsing so a no-tray location is not mistaken for a SKU.
- The NAS snapshot sync now builds a chunked 64-bucket reverse index before switching the active version; row chunks are capped at 50 records to stay below either Durable Object storage backend's per-value limit. Each LINE reply shows 10 rows per page, preserves zero/negative availability with a warning, omits cost and price, and warns after 30 minutes. Group and room messages are ignored for this reverse inventory list.
- The Worker remains compatible with the currently active pre-index snapshot by scanning the bounded 64 SKU buckets only until the next normal NAS sync creates the reverse index.
- Validation: all 62 Worker tests pass and `node --check ai-worker/src/index.js` passes. Cloudflare Worker version `e0a87ea9-dcdd-415a-a56b-047ec39cf475` was deployed at 2026-08-26 12:15:54 +08:00 with 100% traffic; the public endpoint returned the expected HTTP 405 JSON response for a root GET after deployment.
- A fresh private-chat LINE query still needs to be sent by the user to confirm the final user-facing reply with live warehouse data. The pre-index compatibility scan means the exact-location query can work immediately; the next normal NAS snapshot sync will replace that fallback with the reverse index.

### ERP-driven location recognition deployed (2026-08-26)

- The user confirmed that any normalized input exactly present in the current ERP main-warehouse `倉庫儲位` values must be treated as a storage location, rather than relying only on the original numeric pattern. This covers `AR01-03`, `A區-01`, and future ERP-defined shapes without adding one regular expression per format.
- The Worker probes the exact reverse index before SKU and keyword routing. A matching ERP location wins; a miss falls back to the existing SKU or keyword behavior, preserving commands such as `儲位 A725` and ordinary product searches. Pagination postbacks now accept the normalized ERP location value instead of reapplying the old numeric-only parser. Physical-location lists remain private-chat only.
- Validation: all 62 Worker tests and `node --check ai-worker/src/index.js` pass. Regression coverage includes bare and prefixed `AR01-03`, two-page results, the AR-format pagination postback, group suppression, and fallback of an unknown location-like value to the SKU flow.
- Source commit `02aacf28d9cab2b9b2914e909d7dd61b31130714` was fast-forwarded to the formal `agent/line-schedule-handoff` branch and deployed as Cloudflare Worker version `5db64fd9-51fa-4a07-b21b-f6372c62fbac` at 2026-08-26 12:39:06 +08:00 with 100% traffic. The public endpoint returned the expected HTTP 405 JSON response for a root GET after deployment.
- The last confirmed NAS cycle before deployment completed at 12:34:44 with 3,694 LINE main-warehouse locations. This routing-only release reuses that existing reverse index and does not require a new schema or index rebuild. The NAS share became unavailable during the 12:40 post-deployment readback, so a later successful cycle has not yet been confirmed. A fresh private-chat `AR01-03` query is still required for final user-facing verification.

### Complete-location blank-row fix deployed (2026-08-26)

- A live read-only ERP main-warehouse export confirmed that A856 has four variants totaling 3,870 available units. The 55*80 / F variant has 990 units but a blank `倉庫儲位`; the other three variants have W2-1 and total 2,880 units. No ERP data was changed.
- `formatWarehouseLocation` previously removed every blank-location variant whenever at least one located variant existed. `完整儲位 A856` therefore showed only three rows even though its product total included all four.
- Source commit `fb049627d3d04f40d16874be36d7f96fa010ecab` now lists every ERP variant and renders a blank location as `未設定儲位` with the original available quantity. The 40-row safety cap now counts all variants consistently.
- Validation: all 62 Worker tests and `node --check ai-worker/src/index.js` pass. Regression coverage reproduces A856 with all four variants and verifies `55*80／F：未設定儲位（可用 990）` while preserving the 3,870 product total.
- Cloudflare Worker version `e371c6ea-cfd6-448d-a63c-9c261a1033e5` was deployed at 2026-08-26 13:03:46 +08:00 with 100% traffic. The public endpoint returned the expected HTTP 405 JSON response for a root GET after deployment. A fresh private-chat `完整儲位 A856` query is still required for final user-facing verification.

## Current production state

- Frontend: <https://jachou123-afk.github.io/shopee-video-script-tool/>
- Cloudflare Worker: <https://shopee-video-script-ai.jachou123-afk.workers.dev>
- Latest feature source before the reader hotfix: `b8efc5b4b330c61b1040660c01d63ee959592dd1` (`feat(line): 私訊查貨號顯示 ERP 售價`).
- Latest production deployment: `3ace1805-96de-4027-97dd-42cc1429b72e` at 2026-08-28 16:17 +08:00, containing the reader repair plus every newer formal-branch ERP price and storage-location filter change.
- LINE bot commands and schedules are implemented in `ai-worker/src/index.js`.
- The authenticated Shopee reader source is in `nas-shopee-reader/` and runs separately on the NAS. Its `.env`, browser profile, login session, and token are intentionally not committed.
- Validation status: `node --check ai-worker/src/index.js`, all 64 Worker tests, and all 12 NAS reader tests pass on the integrated formal source.

## Shopee reader restart repair deployed (2026-08-28)

- The user-visible LINE failure said the NAS read service might be offline or the Shopee account might no longer be signed in. Production diagnosis found two restart defects rather than a newly configured password problem.
- In the Worker Durable Object, replacing a reader WebSocket left the old socket's delayed `close` or `error` listener active. That stale event could clear the new live reader reference, so `/reader/status` incorrectly returned `connected: false` even though the NAS log showed a successful new connection. `clearReaderIfCurrent` now clears state only when the event belongs to the current socket. A regression test reproduces replacement followed by the stale close.
- On the NAS, an unclean container restart could leave `/tmp/.X99-lock` or `/tmp/.X11-unix/X99`. Xvfb then exited with `Server is already active for display 99`, causing the container restart loop. `docker-entrypoint.sh` removes only those display-99 stale runtime files before starting Xvfb. `.gitattributes` forces LF for shell scripts because an intermediate CRLF copy was rejected by Linux as `bash\r`.
- Cloudflare Worker version `79388504-63eb-4c2d-a1b8-2f2339c8be31` first restored reader connectivity, but it was built from a branch four commits behind the formal source. It was superseded by integrated production version `3ace1805-96de-4027-97dd-42cc1429b72e` at 2026-08-28 16:17 +08:00 after the combined source passed 64/64 Worker tests. The later version preserves the ERP price and storage-location filter features. The NAS source and deployed entrypoint were verified with matching SHA-256 `63758AAF0987107BFD28334E050260E78FCA2EE16DE69CE0515FF5BD9E1AF7F2`.
- The successful NAS rebuild ran from 2026-08-28 16:08:50 to 16:09:38 +08:00 and produced image `sha256:c04db3f3eb48eef474d2de3efbeb97a62f0a6c21a29b5a93e89c7725a9f9cd34`. Existing `.env`, browser profile, and Shopee session data were preserved.
- Post-deployment production verification returned public root HTTP 405 as expected, `connected: true`, and `browser.started: true`. The new reader hello captured a Shopee CAPTCHA URL, so reader transport is healthy but a fresh schedule-number reply from the user's personal LINE account remains the final content-read acceptance check. If that reply still fails, the user must complete Shopee's CAPTCHA in the NAS noVNC session; automation must not solve or bypass it.
- The one-off DSM task `codex-shopee-reader-rebuild-20260828` was disabled after the successful repair and DSM readback confirmed its checkbox state as false, so it will not rebuild again at the next scheduled time. It remains as a recoverable audit artifact; delete it only after receiving separate action-time confirmation. Do not delete either NAS source backup.

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

## LINE rich menu (updated 2026-08-14)

- A 2500 x 1686 six-button rich menu is active as the Messaging API default for `@059hdfyo` (`廣告文案小幫手`). Its LINE ID is `richmenu-26f08e00e3f4df577a775f9b7622bee6`.
- The six message actions are `查`, `要拍什麼`, `改儲位`, `已拍完`, `產生文案`, and `使用方法`. The top-right action displays `改儲位` and sends exactly `改儲位`, which opens the eight-second SKU reply window.
- The deployed image source is `line-assets/rich-menu-059.png`. Regenerate it deterministically with `line-assets/build-rich-menu.ps1` after setting `RICH_MENU_OUTPUT_FILE=rich-menu-059.png`, `RICH_MENU_THIRD_LABEL=改儲位`, and `RICH_MENU_THIRD_SUBTITLE=問答選擇新儲位` in the PowerShell process environment. With no overrides, the script still regenerates the previous `rich-menu-v2.png` asset.
- The previous menu `richmenu-4e7e2a8351c483b285c2d8b0a1038473` remains in the `@059hdfyo` Messaging API account as a non-default rollback copy. The excluded account `@037vajci` was not changed.
- `使用方法` and a mention-only message return six quick-reply shortcuts. `產生文案` asks for a Shopee product URL instead of falling through to ERP keyword search.
- Rich menus appear in the LINE mobile app, not LINE for PC. After a change, reopen the chat; LINE may take up to one minute to refresh the default menu.
- The menu was created through the official Messaging API, so LINE Official Account Manager does not list it under its native rich-menu editor. The temporary Cloudflare setup route and `RICH_MENU_SETUP_TOKEN` secret were removed immediately after activation.

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
- The 2026-08-28 repair restored the NAS transport and the Worker now reports an active connection and started browser. The latest reconnect hello captured a Shopee CAPTCHA URL, so current authenticated content access still needs one fresh user-driven LINE request and, if necessary, manual CAPTCHA completion through the NAS noVNC page.

## Continue from another computer

1. Clone this repository.
2. Install Node.js 22 or newer and Wrangler.
3. Run `node --test ai-worker/test/index.test.mjs`.
4. Run `node --test nas-shopee-reader/test/*.test.mjs`.
5. Authenticate with `wrangler login`.
6. Deploy from `ai-worker` with `wrangler deploy`.

Required Worker secrets are listed in `ai-worker/wrangler.jsonc`. Secret values, NAS browser state, logs, and local Wrangler caches are not stored in GitHub.

Recent handoff changes on `agent/line-schedule-handoff` include LINE generation concurrency protection, direct SKU warehouse lookup, pure-profit SKU labels, and ERP main-warehouse location sync.

The separate NAS ERP project downloads both `InventoryId=-1` (不分倉, used by the existing calculations) and `InventoryId=1` (主倉, used for `倉庫儲位`) during one authenticated run. It retains the previous Worker snapshot whenever the main-warehouse export or location push fails.

## `@059hdfyo` warehouse-position dry run (button workflow, 2026-08-13)

- Warehouse-position work is scoped only to `@059hdfyo` (`廣告文案小幫手`). `@037vajci` is a separate official account and must not receive this workflow.
- Private-chat command: `改儲位 A861`. It opens LINE quick-reply buttons; the older full command `改儲位 A861 02-R04-01/T3` remains a read-only shortcut.
- The `@059hdfyo` help/function quick reply previously labeled `➕ 新增排程` is now `📦 改儲位` and sends the bare command `改儲位`. The bot then accepts one bare SKU reply for exactly eight seconds. The one-time per-user activation timestamp is kept in a separate Durable Object and consumed on reply; expiry produces a safe timeout message. This does not change the independent `@037vajci` rich menu.
- A multi-variant product such as `A823` first reads the current ERP snapshot and shows its real child SKUs (for example `-01` through `-06`) plus `全部`. A single child preview selects exactly one matching barcode. `全部` is offered only when there are at most 10 children and lists every old-to-new location line in the final preview. Missing or duplicate child IDs stop the entire flow.
- A倉 remains visible but returns an unavailable notice. B倉 supports zone `01`-`06`, direction `L`/`R`, shelf `01`-`05`, level `01`-`04`, and tray `T1`-`T4` or `無 T`. For example, B倉 → `02` → `R` → `R04` → `01` → `T1` builds `02-R04-01/T1`; choosing `無 T` builds `02-R04-01` without a tray suffix.
- The wizard is stateless: each LINE postback carries the already-selected values, every value is checked against an allowlist, and no selection is written to KV, Durable Object storage, or ERP.
- The Worker calls LINE `GET /v2/bot/info` and refuses the command unless the active channel token reports Basic ID `@059hdfyo`. Group and room commands are refused.
- This phase reads only the existing ERP main-warehouse cloud snapshot with image lookup disabled. It does not create a confirmation transaction, call an ERP write endpoint, or change Durable Object storage.
- The preview fails closed unless the snapshot is `InventoryId=1`, is no more than 30 minutes old, and every requested child SKU still resolves uniquely when the final button is pressed. Missing, duplicate, or changed variants are never guessed.
- The reply shows product, variant, stock, old location, proposed location, snapshot time, and states that only `DepotPosition` would be allowed to change in a later write phase.
- Worker validation is 57/57 tests passing after this change, including the exact eight-second one-time window, timeout handling, single-child, `全部`, complete button paths, and assertions that warehouse data remains unchanged.

### Current ERP snapshot blocker (checked 2026-08-14)

- LINE accepted the eight-second SKU reply correctly, but the dry run stopped because the latest main-warehouse snapshot was `2026-08-14T00:01:43+08:00`, older than the 30-minute safety limit.
- The snapshot comes from the separate NAS `nas-erp-sync` project, which directly signs in to uSale and exports `商品管理／商品資料` for `InventoryId=1`; no browser workbench needs to remain open.
- The most likely fault is that the NAS container/scheduler stopped after midnight or later ERP login, main-warehouse export, or location push attempts failed. The NAS DSM/QuickConnect session was not available during the external check, so container logs remain unverified.
- Do not weaken or remove the 30-minute fail-closed check to work around this outage. Restore and verify the NAS sync first.

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
