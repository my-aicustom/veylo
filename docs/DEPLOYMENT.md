# Veylo deployment

The root `docker-compose.yml` is a **local/internal development composition**. It intentionally uses local HTTP/WebSocket endpoints and must not be exposed unchanged to the public internet.

## Recommended production topology

Use separate public endpoints:

- `https://veylo.example.com` — Astro homepage + Next.js Veylo app
- `wss://rtc.example.com` — LiveKit signalling/WebRTC
- `turn.example.com` — TURN/TLS endpoint when using a dedicated TURN hostname

For a single production VM, prefer LiveKit's official VM configuration generator instead of hand-building the entire RTC stack:

```bash
docker pull livekit/generate
docker run --rm -it -v$PWD:/output livekit/generate
```

The generated deployment includes the pieces LiveKit expects for a production VM, including TLS-facing configuration. Veylo's `deploy/production/livekit.yaml.example` is a reviewable baseline/template, not a replacement for environment-specific generation.

## Network requirements

For the standard LiveKit VM topology, plan firewall/DNS for:

- TCP 443 — HTTPS and TURN/TLS
- TCP 80 — certificate issuance/renewal when applicable
- TCP 7881 — WebRTC over TCP
- UDP 3478 — TURN/UDP when enabled
- UDP 50000-60000 — WebRTC media range

Production LiveKit should advertise its public IP and use a trusted TLS certificate. TURN/TLS materially improves connectivity on restrictive corporate/event networks.

## Version pinning

The development composition pins LiveKit Server to:

```text
livekit/livekit-server:v1.13.7
```

Do not silently switch production to `:latest`. Upgrade deliberately, review release notes, then re-run Veylo's acceptance checks.

## Production environment

Start from:

```bash
cp deploy/production/env.production.example .env.production
```

Replace every placeholder, then run:

```bash
pnpm readiness -- --env .env.production
```

The preflight rejects:

- `http://` application URLs
- `ws://` LiveKit URLs
- localhost production endpoints
- development/placeholder LiveKit credentials
- missing OpenRouter credentials
- missing required production templates/gates

Server-side secrets:

- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `OPENROUTER_API_KEY`

Never expose them through `NEXT_PUBLIC_*` variables.

## Application deployment

The application stack consists of:

- Astro public site
- Next.js Veylo application
- self-hosted LiveKit
- OpenRouter for STT, translation, simulation/mediation and TTS

The development Nginx config includes baseline response headers and correct forwarded host/protocol/client-IP headers. Terminate public HTTPS at your production edge/proxy and preserve those forwarding headers to the Next.js app.

## Production validation sequence

1. Run repository CI locally where practical:
   ```bash
   pnpm install --frozen-lockfile
   pnpm audit:static
   pnpm test
   pnpm readiness:template
   pnpm typecheck
   pnpm build
   ```
2. Validate the real production env:
   ```bash
   pnpm readiness -- --env .env.production
   ```
3. Deploy LiveKit with public `wss://`, public-IP advertisement and TURN/TLS.
4. Deploy the Astro + Next.js application behind HTTPS.
5. Open `/app/diagnostics` and run full diagnostics.
6. Complete `docs/ACCEPTANCE.md` on real devices and at least two different networks.

## Scaling boundary

Veylo intentionally has no user account/login system. Current API guards are designed for a single-instance internal deployment:

- same-origin request checks
- per-IP in-memory limits
- request-size limits
- server-side credentials

If Veylo becomes broadly public or runs multiple application instances, move rate-limit state to shared storage such as Redis and add an outer access/session mechanism.
