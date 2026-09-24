# Security boundary — Veylo v1.0.0

Veylo is designed as a small internal communication application, not a public anonymous multi-tenant service.

## Server-side secrets

- `OPENROUTER_API_KEY`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `VEYLO_INVITE_SECRET`

Never expose these through browser bundles, screenshots, repository files, `NEXT_PUBLIC_*`, or client logging.

## Room authorization

When `VEYLO_INVITE_SECRET` is configured, room creation issues a time-limited HMAC-SHA256 signed invite. The room name and expiry are signed. A missing, expired, malformed, tampered, or room-mismatched invite is rejected before a LiveKit participant token is issued.

Production preflight requires an invite secret of at least 32 characters.

## API controls

- same-origin request checks
- per-IP endpoint rate limits
- payload/text size limits
- room-name validation
- short-lived LiveKit participant tokens
- no-store responses for sensitive runtime endpoints
- global AI request cap
- daily tracked-cost cap for provider responses exposing `usage.cost`

The in-process guards are a backstop for the intended single-instance internal deployment. Horizontal scaling requires shared state.

## Provider observability

OpenRouter calls emit structured server logs containing operational fields such as request ID, API path, attempt, status, latency, and generation ID when present. Veylo does not intentionally log prompt/message/audio bodies in these provider log events.

## Browser/edge headers

The app and supplied proxy templates enforce:

- Content-Security-Policy
- Strict-Transport-Security
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy
- Permissions-Policy
- Cross-Origin-Opener-Policy
- disabled framework/server version exposure where controlled

Next.js `X-Powered-By` is disabled.

## AI spend defense in depth

Production requires local Veylo AI caps. For additional provider-side enforcement, configure OpenRouter key/workspace budget controls and model/provider restrictions separately. Provider-side guardrails are authoritative even if an application process restarts.

## Production boundary

- use trusted HTTPS for the web app
- use browser-reachable trusted `wss://` for LiveKit
- enable public-IP advertisement and TURN/TLS for production RTC
- never use local LiveKit dev credentials in production
- keep app, RTC, and secrets separated between development/staging/production where practical

If Veylo becomes broadly public or multi-tenant, add an organization access layer and shared rate-limit/budget storage.
