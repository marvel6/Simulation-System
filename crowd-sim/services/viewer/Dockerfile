# context = crowd-sim/
FROM node:20-slim AS build
WORKDIR /app
COPY package.json yarn.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY services/viewer/package.json ./services/viewer/
RUN yarn install --frozen-lockfile
COPY packages/shared ./packages/shared
COPY services/viewer ./services/viewer
RUN yarn workspace @crowd-sim/shared build \
 && yarn workspace crowd-sim-viewer-service build

FROM node:20-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY package.json yarn.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY services/viewer/package.json ./services/viewer/
COPY --from=build /app/services/viewer/dist ./services/viewer/dist
COPY services/viewer/public ./services/viewer/public
RUN yarn install --frozen-lockfile --production=true && yarn cache clean
WORKDIR /app/services/viewer
EXPOSE 8080
CMD ["node", "dist/index.js"]
