FROM node:22-alpine AS base
WORKDIR /workspace
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY plugins/hello-world/package.json plugins/hello-world/package.json
COPY plugins/inventory/package.json plugins/inventory/package.json
RUN pnpm install --frozen-lockfile=false

FROM deps AS dev
COPY . .
EXPOSE 3000 5173
CMD ["pnpm", "dev"]
