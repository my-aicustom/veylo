# VEYLO — v0.4.0

> Working codename. Internal multilingual communication product by MY-AI.

Veylo combines a fast Astro marketing homepage with a self-hosted LiveKit realtime application and server-side OpenRouter inference.

## Repository structure

```text
veylo/
├── apps/
│   ├── site/        # Astro 7 marketing homepage
│   └── app/         # Next.js + LiveKit + OpenRouter application
├── infra/           # self-hosted LiveKit config
├── deploy/          # reverse proxy example
├── docs/            # architecture, copy, design and cycle notes
└── docker-compose.yml
```

## Product modes

- **Live Call** — create/join a Veylo video room. Original audio remains canonical; the listener-side interpreter translates the remote participant.
- **Face-to-Face** — one device acts as interpreter between two people in the same room.
- **AI Simulation** — practice with an AI counterpart using country, role and scenario context.

## Local development

```bash
cp .env.example .env
pnpm install
pnpm dev
```

- Astro site: http://localhost:4321
- Veylo app: http://localhost:3000/app
- LiveKit: ws://localhost:7880 when started separately or through Docker Compose

To run LiveKit locally:

```bash
docker compose up livekit -d
```

The Astro site uses `PUBLIC_APP_URL`. For local development you can set:

```bash
PUBLIC_APP_URL=http://localhost:3000/app
```

## Full local container stack

```bash
cp .env.example .env
# fill OPENROUTER_API_KEY
docker compose up --build
```

Then open http://localhost:8080.

## Non-negotiable security boundary

`OPENROUTER_API_KEY`, `LIVEKIT_API_SECRET`, and any future server credential must never be shipped into browser code. OpenRouter calls live only in Next.js server routes.

## Foundation

The call application is derived from patterns and dependencies in the official LiveKit Meet project and uses self-hosted LiveKit Server. See `UPSTREAM.md`, `THIRD_PARTY_NOTICES.md`, and `LICENSE`.

## Before public branding

Read `BRAND_STATUS.md`. "Veylo" is currently a working codename and is **not cleared as a public trademark/product name**.
