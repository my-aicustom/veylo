FROM node:22-alpine AS builder
WORKDIR /workspace
RUN corepack enable
COPY package.json ./package.json
RUN pnpm install
COPY . .
RUN pnpm build

FROM nginx:1.27-alpine
COPY --from=builder /workspace/dist /usr/share/nginx/html
EXPOSE 80
