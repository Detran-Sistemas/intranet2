# ==========================================
# Stage 1: Build Assets & Dependencies
# ==========================================
FROM node:24-bookworm-slim AS builder

WORKDIR /wiki

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json yarn.lock ./
COPY patches/ ./patches/
COPY .babelrc .eslintrc.yml .eslintignore ./

RUN yarn install --frozen-lockfile --network-timeout 300000

COPY client/ ./client/
COPY dev/ ./dev/
COPY server/ ./server/

ENV NODE_OPTIONS="--openssl-legacy-provider"
RUN yarn build

RUN rm -rf node_modules && \
    yarn install --production --frozen-lockfile --network-timeout 300000 && \
    yarn patch-package && \
    yarn cache clean

# ==========================================
# Stage 2: Production Runtime
# ==========================================
FROM node:24-bookworm-slim AS runner

LABEL maintainer="Detran-MG"

WORKDIR /wiki

ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    curl \
    git \
    openssh-client \
    gnupg \
    sqlite3 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /wiki \
    && mkdir -p /logs \
    && mkdir -p /wiki/data \
    && chown -R node:node /wiki /logs

COPY --chown=node:node --from=builder /wiki/assets ./assets
COPY --chown=node:node --from=builder /wiki/node_modules ./node_modules
COPY --chown=node:node ./server ./server
COPY --chown=node:node --from=builder /wiki/server/views ./server/views
COPY --chown=node:node ./docker/config.yml ./config.yml
COPY --chown=node:node ./package.json ./package.json
COPY --chown=node:node ./LICENSE ./LICENSE

USER node

VOLUME ["/wiki/data"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 CMD curl -f http://localhost:3000/healthz || exit 1

CMD ["node", "--no-deprecation", "server"]
