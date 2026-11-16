# ====================
# --- Build Assets ---
# ====================
FROM node:24-alpine AS assets

RUN apk add yarn g++ make cmake python3 --no-cache

WORKDIR /wiki

COPY ./package.json ./yarn.lock ./
COPY ./patches ./patches
COPY ./.babelrc ./.babelrc
COPY ./.eslintignore ./.eslintignore
COPY ./.eslintrc.yml ./.eslintrc.yml

RUN yarn install --frozen-lockfile --network-timeout 300000

COPY ./client ./client
COPY ./dev ./dev
COPY ./server ./server

ENV NODE_OPTIONS="--openssl-legacy-provider --max-old-space-size=4096"
RUN yarn build
RUN rm -rf /wiki/node_modules
RUN yarn --production --frozen-lockfile --network-timeout 300000
RUN yarn patch-package
RUN yarn cache clean

# ===============
# --- Release ---
# ===============
FROM node:24-alpine
LABEL maintainer="Detran-MG"

RUN apk add bash curl git openssh gnupg sqlite --no-cache && \
    mkdir -p /wiki && \
    mkdir -p /logs && \
    mkdir -p /wiki/data && \
    chown -R node:node /wiki /logs

WORKDIR /wiki

COPY --chown=node:node --from=assets /wiki/assets ./assets
COPY --chown=node:node --from=assets /wiki/node_modules ./node_modules
COPY --chown=node:node ./server ./server
COPY --chown=node:node --from=assets /wiki/server/views ./server/views
COPY --chown=node:node ./docker/config.yml ./config.yml
COPY --chown=node:node ./package.json ./package.json
COPY --chown=node:node ./LICENSE ./LICENSE

USER node

VOLUME ["/wiki/data"]

EXPOSE 3000
EXPOSE 3443

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 CMD curl -f http://localhost:3000/healthz || exit 1

CMD ["node", "--no-deprecation", "server"]
