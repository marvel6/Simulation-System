# Build context must be the crowd-sim repo root (see EcsStack fromAsset).
# Multi-stage: compile workspaces, then run with production deps only.

FROM node:20-slim AS build
WORKDIR /app

COPY package.json yarn.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY services/simulation/package.json ./services/simulation/

RUN yarn install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY services/simulation ./services/simulation

RUN yarn workspace @crowd-sim/shared build \
 && yarn workspace crowd-sim-simulation-service build

FROM node:20-slim AS run
WORKDIR /app
ENV NODE_ENV=production

COPY package.json yarn.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY services/simulation/package.json ./services/simulation/
COPY --from=build /app/services/simulation/dist ./services/simulation/dist

RUN yarn install --frozen-lockfile --production=true \
 && yarn cache clean

WORKDIR /app/services/simulation
CMD ["node", "dist/index.js"]
