FROM node:22-bookworm-slim AS deps

WORKDIR /app
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/backend/package.json packages/backend/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/vscode/package.json packages/vscode/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS build

COPY packages packages
RUN pnpm build

FROM deps AS prod-deps

RUN rm -rf node_modules packages/*/node_modules && pnpm install --prod --frozen-lockfile

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3333
ENV DECKGRAPH_DEMO_CACHE_DIR=/tmp/deckgraph-demo-cache

COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=prod-deps /app/node_modules node_modules
COPY --from=prod-deps /app/packages/shared/node_modules packages/shared/node_modules
COPY --from=prod-deps /app/packages/backend/node_modules packages/backend/node_modules
COPY --from=prod-deps /app/packages/ui/node_modules packages/ui/node_modules
COPY --from=build /app/packages/shared packages/shared
COPY --from=build /app/packages/backend packages/backend
COPY --from=build /app/packages/ui/dist packages/ui/dist

EXPOSE 3333

CMD ["sh", "-c", "node packages/backend/dist/index.js --demo --host 0.0.0.0 --port ${PORT} --no-open --no-watch"]
