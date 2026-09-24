# Veylo v1.0.0 deployment

The root `docker-compose.yml` is a local/internal development composition. Do not expose it unchanged to the public internet.

## Recommended topology

- `https://veylo.example.com` — Astro homepage + Next.js Veylo app
- `wss://rtc.example.com` — LiveKit signalling/WebRTC
- TURN domain/certificate as required by the LiveKit production topology

Use LiveKit's official production deployment generator or an equivalent reviewed deployment rather than treating the development Compose file as production RTC infrastructure.

## LiveKit production requirements

Plan for:

- trusted TLS on the LiveKit domain
- public-IP advertisement
- TCP 443 for HTTPS/TURN-TLS
- TCP 7881 for WebRTC/TCP fallback
- UDP 3478 when TURN/UDP is enabled
- UDP 50000-60000 for the configured WebRTC media range
- TURN/TLS for restrictive VPN/corporate/event networks

The repository's `deploy/production/livekit.yaml.example` is a review baseline. The pinned development image is `livekit/livekit-server:v1.13.7`; upgrades should be deliberate and followed by the full Veylo gate.

## Web TLS edge

`deploy/production/nginx-tls.conf.example` provides a hardened example with:

- HTTP → HTTPS redirect
- TLS 1.2/1.3
- CSP
- HSTS
- anti-framing
- nosniff
- referrer/permissions policies
- correct proxy forwarding headers

Replace example domains and certificate paths.

## Production environment

```bash
cp deploy/production/env.production.example .env.production
```

Replace all placeholders. Then:

```bash
pnpm readiness -- --env .env.production
```

Preflight requires:

- `VEYLO_STRICT_PRODUCTION=true`
- HTTPS `APP_URL`
- WSS `LIVEKIT_URL`
- non-placeholder LiveKit credentials
- strong signed-invite secret
- OpenRouter key
- positive hourly AI request cap
- positive daily tracked-cost cap

## AI cost controls

The application provides process-level request and tracked-cost backstops. Choose limits based on the actual expected meeting load.

For defense in depth, also configure OpenRouter-side budget/key/workspace guardrails. Application-local counters reset with the process and are not shared across replicas.

## Deploy sequence

1. Run local/repository gates:
   ```bash
   pnpm install --frozen-lockfile
   pnpm audit:static
   pnpm test
   pnpm readiness:template
   pnpm typecheck
   pnpm build
   pnpm smoke:runtime
   ```
2. Validate the real production environment:
   ```bash
   pnpm readiness -- --env .env.production
   ```
3. Deploy LiveKit with trusted WSS, public IP advertisement, and TURN/TLS.
4. Deploy Astro + Next.js behind HTTPS.
5. Check `/app/api/ready`; do not route production traffic while it returns 503.
6. Run the remote deployment gate from a separate machine:
   ```bash
   pnpm acceptance:prod -- --url https://veylo.example.com --deep
   ```
7. Open `/app/diagnostics` and run full diagnostics.
8. Complete `docs/ACCEPTANCE.md` on real devices and at least two networks.

## Health endpoints

- `/app/api/ready` performs deterministic local configuration checks and returns HTTP 503 when the process should not receive traffic.
- `/app/api/health` reports local configuration/budget status without secrets.
- `/app/api/health?deep=1` additionally checks OpenRouter model catalogue and LiveKit reachability.

Do not use the deep endpoint as a high-frequency load-balancer probe because it performs external network requests.

## Scaling boundary

Current rate and budget counters are process-local. Before horizontal scaling, move those counters to shared state such as Redis and use a production LiveKit topology appropriate to multiple instances.
