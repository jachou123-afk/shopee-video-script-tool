#!/usr/bin/env bash
set -euo pipefail

: "${VNC_PASSWORD:?VNC_PASSWORD is required}"

mkdir -p /data/profile /tmp/fluxbox
rm -f /data/profile/SingletonCookie /data/profile/SingletonLock /data/profile/SingletonSocket

Xvfb :99 -screen 0 1365x768x24 -nolisten tcp &
fluxbox -display :99 >/tmp/fluxbox.log 2>&1 &

x11vnc -storepasswd "$VNC_PASSWORD" /tmp/vnc-passwd >/dev/null
x11vnc \
  -display :99 \
  -rfbauth /tmp/vnc-passwd \
  -forever \
  -shared \
  -listen 0.0.0.0 \
  -rfbport 5900 \
  >/tmp/x11vnc.log 2>&1 &

websockify \
  --web=/usr/share/novnc \
  0.0.0.0:6080 \
  localhost:5900 \
  >/tmp/novnc.log 2>&1 &

exec node src/index.mjs
