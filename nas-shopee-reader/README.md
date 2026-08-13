# NAS Shopee Reader

The service keeps a persistent Chromium profile on the Synology NAS, reads Shopee product metadata with the logged-in browser session, selects local G/K product images, and maintains an outbound authenticated WebSocket connection to the Cloudflare Worker.

No public NAS port is required for Worker communication. Port 6080 is only for the local noVNC login screen.

## Synology deployment

1. Copy this directory to `/volume1/docker/shopee-reader`.
2. Create `.env` from `.env.example` and set independent random secrets.
3. Create a Container Manager project using `compose.yaml`.
4. Open `http://192.168.1.126:6080/vnc.html` on the LAN, enter the VNC password, and sign into Shopee once.

The browser profile persists in `./data/profile`.

## G/K local product images

The compose project mounts these NAS folders read-only:

- `/volume1/圖片區/G類-娃娃機吊飾` as `/nas-images/G`
- `/volume1/圖片區/K類-娃娃機吊飾2` as `/nas-images/K`

For a requested G/K SKU, the reader finds the folder whose name starts with the normalized SKU, ignores non-image material, and ranks up to 80 JPG/PNG/WebP candidates. Cover-like names (`主圖`, `首圖`, `封面`, `01.jpg`) are preferred; detail, size, price, instruction, QR, logo, video, and packaging names are penalized. Resolution, aspect ratio, file size, sharpness, entropy, and exposure contribute to the final score.

The selected source is auto-rotated and converted to a 1200×1200 JPEG on a white canvas. Only that derivative is uploaded to the authenticated Worker endpoint and copied into Cloudflare `PRODUCT_IMAGES`; the source NAS file is never changed and no NAS URL is exposed to LINE.
