# Frontend: build the CRA bundle, then serve it from Caddy.
#
# REACT_APP_* values are baked in at BUILD time, not read at runtime. The default
# points at /api, which Caddy proxies to the backend on the same origin — so the
# browser never makes a cross-origin request and CORS stops mattering entirely.

FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG REACT_APP_AGENT_URL=/api
ENV REACT_APP_AGENT_URL=$REACT_APP_AGENT_URL
RUN npm run build

# ── Serve ────────────────────────────────────────────
FROM caddy:2-alpine

COPY --from=build /app/build /srv
