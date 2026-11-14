# syntax=docker/dockerfile:1
FROM node:25-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig*.json vite.config.ts .prettierrc.json ./
COPY scripts scripts
COPY LICENSE THIRD_PARTY_NOTICES.md ./
COPY third-party third-party
COPY server server
COPY web web
COPY tests tests
RUN npm run build

FROM node:25-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/build ./build
COPY --from=build /app/dist/legal ./legal
USER node
CMD ["node", "build/main.js"]

FROM runtime AS translation
USER root
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv libgomp1 && rm -rf /var/lib/apt/lists/*
COPY server/translation/requirements.txt /tmp/translation-requirements.txt
RUN python3 -m venv /opt/translation && /opt/translation/bin/pip install --no-cache-dir -r /tmp/translation-requirements.txt
ENV TRANSLATION_PYTHON=/opt/translation/bin/python TRANSLATION_MODELS=/models
USER node
CMD ["node", "build/translation-worker.js"]

FROM nginxinc/nginx-unprivileged:stable-alpine AS web
COPY --from=build /app/dist /usr/share/nginx/html
COPY deploy/nginx/default.conf.template /opt/news-radar/default.conf.template
COPY --chmod=755 deploy/nginx/20-render.sh /docker-entrypoint.d/40-news-radar-render.sh
EXPOSE 8080
