FROM mcr.microsoft.com/playwright:v1.62.0-noble

USER root

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    fluxbox \
    novnc \
    websockify \
    x11vnc \
    xvfb \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod 0755 ./docker-entrypoint.sh

ENV DISPLAY=:99 \
    NODE_ENV=production \
    TZ=Asia/Taipei

EXPOSE 6080

ENTRYPOINT ["/app/docker-entrypoint.sh"]
