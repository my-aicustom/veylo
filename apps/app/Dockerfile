FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json ./
RUN pnpm install

FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_PUBLIC_BASE_PATH=/app
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
RUN addgroup -S veylo && adduser -S veylo -G veylo
COPY --from=builder --chown=veylo:veylo /app/package.json ./package.json
COPY --from=builder --chown=veylo:veylo /app/node_modules ./node_modules
COPY --from=builder --chown=veylo:veylo /app/.next ./.next
COPY --from=builder --chown=veylo:veylo /app/public ./public
COPY --from=builder --chown=veylo:veylo /app/next.config.mjs ./next.config.mjs
EXPOSE 3000
USER veylo
CMD ["pnpm", "start"]
