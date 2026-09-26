FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
# .yarnrc.yml is required: the lockfile is Yarn Berry format, but node:20-alpine
# ships Yarn 1.22, which cannot resolve its `npm:` protocol keys. Corepack reads
# `packageManager` from package.json and fetches the matching Yarn.
COPY package.json yarn.lock .yarnrc.yml ./
RUN corepack enable && yarn install --immutable

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable

# NEXT_PUBLIC_* values are inlined at build time
ARG NEXT_PUBLIC_CVPAP_API_URL=https://api.ajiriwa.gidraf.dev
ARG NEXT_PUBLIC_CVPAP_DASHBOARD_URL=https://ajiriwa.gidraf.dev
ARG NEXT_PUBLIC_BASE_PATH=/cards

ENV NEXT_PUBLIC_CVPAP_API_URL=$NEXT_PUBLIC_CVPAP_API_URL
ENV NEXT_PUBLIC_CVPAP_DASHBOARD_URL=$NEXT_PUBLIC_CVPAP_DASHBOARD_URL
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
ENV NEXT_TELEMETRY_DISABLED=1

RUN yarn build

# Production
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 7500
ENV PORT=7500
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
