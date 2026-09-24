# VEYLO — v0.5.0

> Working codename. Internal multilingual communication product by MY-AI.

Veylo combines an Astro marketing homepage, a Next.js realtime application, self-hosted LiveKit communication, and server-side OpenRouter inference.

## Product modes

- **Live Call** — private video rooms with listener-side AI interpretation.
- **Face-to-Face** — one-device interpretation for two people in the same room.
- **AI Simulation** — practice international conversations with an AI counterpart.
- **Diagnostics** — browser/media, LiveKit, OpenRouter, deployment and latency troubleshooting.

## v0.5.0 production + QA foundation

- LiveKit Server is pinned to `v1.13.7`; the dev stack no longer follows `:latest`
- centralized Veylo version used by the health endpoint
- root/app/site versions synchronized
- Node-native automated test suite added without adding another test framework dependency
- CI now gates on tests, production-template readiness, Docker Compose validation, typecheck and production build
- production preflight rejects insecure URLs, localhost endpoints and development/placeholder credentials
- production LiveKit template includes public-IP advertisement and TURN/TLS requirements
- room names are validated before LiveKit token creation
- reverse proxy adds baseline content/frame/referrer/permissions security headers
- explicit internal-beta acceptance checklist added
- production deployment assets and security boundary documented

## Existing realtime capabilities

- self-hosted LiveKit room/token flow
- OpenRouter STT, translation, AI simulation/mediation and TTS
- streaming TTS with progressive playback where supported
- listener-language correction during a live call
- transcript persistence/export
- network/reconnect/audio-playback health
- local end-to-end latency telemetry and historical diagnostics
- no user login requirement

## Local development

```bash
cp .env.example .env
pnpm install
pnpm dev
```

- Astro site: http://localhost:4321
- Veylo app: http://localhost:3000/app
- Diagnostics: http://localhost:3000/app/diagnostics
- Local LiveKit: ws://localhost:7880

Full local stack:

```bash
cp .env.example .env
# fill OPENROUTER_API_KEY
docker compose up --build
```

Open http://localhost:8080.

## Automated verification

```bash
pnpm audit:static
pnpm test
pnpm readiness:template
pnpm typecheck
pnpm build
```

For a real production environment:

```bash
cp deploy/production/env.production.example .env.production
# replace placeholders
pnpm readiness -- --env .env.production
```

Then follow `docs/DEPLOYMENT.md` and complete `docs/ACCEPTANCE.md`.

## Security boundary

`OPENROUTER_API_KEY`, `LIVEKIT_API_SECRET`, and `LIVEKIT_API_KEY` must remain server-side. Veylo intentionally has no user account/login system. See `SECURITY.md` for the current internal-app threat boundary.

## Foundation

The call application uses patterns/dependencies from the official LiveKit ecosystem and self-hosted LiveKit Server. See `UPSTREAM.md`, `THIRD_PARTY_NOTICES.md`, and `LICENSE`.

## Branding

Read `BRAND_STATUS.md`. "Veylo" remains a working codename and is not yet cleared as a public trademark/product name.
