# Multi-stage build: compile TypeScript, then run only the compiled output
# with production dependencies — keeps the final image small.

FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-slim AS run
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist


CMD ["node", "dist/index.js"]