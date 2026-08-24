# context = crowd-sim/
FROM node:20-slim AS build
WORKDIR /app
COPY package.json yarn.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY services/orchestrator/package.json ./services/orchestrator/
RUN yarn install --frozen-lockfile
COPY packages/shared ./packages/shared
COPY services/orchestrator ./services/orchestrator
RUN yarn workspace @crowd-sim/shared build \
 && yarn workspace crowd-sim-orchestrator-service build

FROM node:20-slim AS run
WORKDIR /app
ENV NODE_ENV=production
COPY package.json yarn.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY services/orchestrator/package.json ./services/orchestrator/
COPY --from=build /app/services/orchestrator/dist ./services/orchestrator/dist
RUN yarn install --frozen-lockfile --production=true && yarn cache clean
WORKDIR /app/services/orchestrator
CMD ["node", "dist/index.js"]