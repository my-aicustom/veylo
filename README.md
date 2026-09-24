# VEYLO — v1.0.0

> Internal multilingual communication product by MY-AI. "Veylo" remains a working codename until brand clearance is complete.

Veylo is a web-based multilingual communication system built with an Astro public site, Next.js application, self-hosted LiveKit realtime communication, and server-side OpenRouter inference.

## Product modes

- **Live Call** — private video rooms with listener-side AI interpretation.
- **Face-to-Face** — one-device interpreter for two people in the same room.
- **AI Simulation** — practice international conversations with an AI counterpart.
- **Diagnostics** — browser/media, LiveKit, OpenRouter configuration, network, and latency troubleshooting.

## v1.0.0 code-complete scope

- self-hosted LiveKit call/token flow
- signed and expiring room invites without a login/account system
- OpenRouter STT, translation, AI mediation/simulation, and TTS
- progressive streaming TTS where the browser supports it
- transcript persistence and export
- local end-to-end latency telemetry
- connection/reconnect/audio health
- global AI request cap and tracked-cost backstop
- structured provider latency/error logs without prompt/body logging
- deterministic `/api/ready` and diagnostic `/api/health`
- strict production preflight
- pinned LiveKit runtime
- production WSS/TURN/TLS and hardened TLS-edge templates
- CSP, HSTS, anti-framing, nosniff, referrer and permissions policies
- automated repository tests + built-runtime smoke tests
- verified release artifact with SHA-256 and build information

See `RELEASE_STATUS.md` for the exact boundary between code-complete and environment acceptance.

## Local development

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm dev
```

See `docs/LOCAL_TEST.md` for the full local cycle.

## Verification

```bash
pnpm audit:static
pnpm test
pnpm readiness:template
pnpm typecheck
pnpm build
pnpm smoke:runtime
pnpm acceptance:prod -- --help
```

For a real production environment:

```bash
cp deploy/production/env.production.example .env.production
# replace all placeholders
pnpm readiness -- --env .env.production
```

The production preflight requires HTTPS, WSS, non-placeholder secrets, signed invites, strict production mode, and positive AI request/cost caps.

After deployment, verify the live environment from any machine with Node.js 20+:

```bash
pnpm acceptance:prod -- --url https://veylo.example.com --deep
```

The remote runner verifies public HTTPS reachability, app readiness, security headers, strict-production flags, signed/tampered/valid invite behavior, LiveKit token issuance, and (with `--deep`) OpenRouter + LiveKit reachability. It does not send conversation content or invoke paid AI inference.

## Runtime endpoints

- `/app/api/ready` — deterministic process/config readiness; safe for a load-balancer health gate.
- `/app/api/health` — local configuration and budget snapshot.
- `/app/api/health?deep=1` — active OpenRouter model-catalog and LiveKit reachability checks.
- `/app/diagnostics` — browser/device diagnostics and local latency history.

## Security boundary

`OPENROUTER_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_API_KEY`, and `VEYLO_INVITE_SECRET` are server-side only. See `SECURITY.md`.

## Deployment

Follow `docs/DEPLOYMENT.md`, then complete `docs/ACCEPTANCE.md` on the actual VPS/devices/networks.

## Foundation

The call application uses the official LiveKit ecosystem and self-hosted LiveKit Server. See `UPSTREAM.md`, `THIRD_PARTY_NOTICES.md`, and `LICENSE`.
