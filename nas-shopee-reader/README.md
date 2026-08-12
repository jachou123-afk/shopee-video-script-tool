# NAS Shopee Reader

The service keeps a persistent Chromium profile on the Synology NAS, reads Shopee product metadata with the logged-in browser session, and maintains an outbound authenticated WebSocket connection to the Cloudflare Worker.

No public NAS port is required for Worker communication. Port 6080 is only for the local noVNC login screen.

## Synology deployment

1. Copy this directory to `/volume1/docker/shopee-reader`.
2. Create `.env` from `.env.example` and set independent random secrets.
3. Create a Container Manager project using `compose.yaml`.
4. Open `http://192.168.1.126:6080/vnc.html` on the LAN, enter the VNC password, and sign into Shopee once.

The browser profile persists in `./data/profile`.
