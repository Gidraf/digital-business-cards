FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are inlined at build time
ARG NEXT_PUBLIC_CVPAP_API_URL=https://api.ajiriwa.gidraf.dev
ARG NEXT_PUBLIC_CVPAP_DASHBOARD_URL=https://ajiriwa.gidraf.dev

ENV NEXT_PUBLIC_CVPAP_API_URL=$NEXT_PUBLIC_CVPAP_API_URL
ENV NEXT_PUBLIC_CVPAP_DASHBOARD_URL=$NEXT_PUBLIC_CVPAP_DASHBOARD_URL
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
