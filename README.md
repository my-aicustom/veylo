# VEYLO — v0.5.1

> Working codename. Internal multilingual communication product by MY-AI.

Veylo combines an Astro marketing homepage, a Next.js realtime application, self-hosted LiveKit communication, and server-side OpenRouter inference.

## Product modes

- **Live Call** — private video rooms with listener-side AI interpretation.
- **Face-to-Face** — one-device interpretation for two people in the same room.
- **AI Simulation** — practice international conversations with an AI counterpart.
- **Diagnostics** — browser/media, LiveKit, OpenRouter, deployment and latency troubleshooting.

## v0.5.1 signed room invites

- optional in local development, required by production preflight
- room creation obtains a time-limited HMAC-signed invite token
- invite token is carried in the shared room URL
- connection/token endpoint validates the invite before issuing a LiveKit participant token
- expired, malformed, or room-mismatched invites are rejected
- signature comparison uses constant-time comparison
- production invite secret must be at least 32 characters and cannot be a placeholder
- no account/login flow was added

## Existing production + QA foundation

- LiveKit Server pinned to `v1.13.7`
- automated Node tests
- CI gates on tests, production readiness, Docker Compose validation, typecheck and production build
- production WSS/TURN/TLS deployment templates
- baseline reverse-proxy security headers
- streaming TTS and local latency telemetry
- source ZIP artifact generated after successful `main` builds

## Local development

```bash
cp .env.example .env
pnpm install
pnpm dev
```

For local development, `VEYLO_INVITE_SECRET` may stay empty. If you want to test signed links locally, set it to any random value of at least 32 characters.

For production:

```bash
cp deploy/production/env.production.example .env.production
# replace every placeholder, including VEYLO_INVITE_SECRET
pnpm readiness -- --env .env.production
```

Then follow `docs/DEPLOYMENT.md` and complete `docs/ACCEPTANCE.md`.

## Security boundary

`OPENROUTER_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_API_KEY`, and `VEYLO_INVITE_SECRET` remain server-side. Veylo intentionally has no user account/login system. See `SECURITY.md`.

## Foundation

The call application uses patterns/dependencies from the official LiveKit ecosystem and self-hosted LiveKit Server. See `UPSTREAM.md`, `THIRD_PARTY_NOTICES.md`, and `LICENSE`.

## Branding

Read `BRAND_STATUS.md`. "Veylo" remains a working codename and is not yet cleared as a public trademark/product name.
