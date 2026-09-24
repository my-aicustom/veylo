# Security boundary

Veylo is currently designed as a small internal application rather than a public anonymous communications service.

## Secrets

These values are server-side only:

- `OPENROUTER_API_KEY`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `VEYLO_INVITE_SECRET`

Never expose them through browser bundles, public repository files, screenshots, or `NEXT_PUBLIC_*` variables.

## Signed room invites

When `VEYLO_INVITE_SECRET` is configured, Veylo generates time-limited HMAC-signed room links. The room name and expiry are covered by the signature, and the server uses constant-time signature comparison before issuing a LiveKit participant token.

The invite layer deliberately does not introduce user accounts:

- room creator requests an invite from the same-origin Veylo app
- the shared URL carries the time-limited invite token
- joining the room requires that token when production invite protection is enabled
- local development can leave `VEYLO_INVITE_SECRET` blank

Signed invites reduce casual room guessing/reuse. They are not a substitute for organization authentication if Veylo later becomes a public multi-tenant service.

## Current controls

- same-origin checks on application API routes
- per-IP rate limiting for the single-instance app deployment
- payload and text-size limits
- validated room-name format before LiveKit token creation
- signed/time-limited room invites in production
- short-lived LiveKit participant tokens
- no-store responses for sensitive runtime endpoints
- baseline browser security headers at the development reverse proxy
- production preflight validation
- local-only transcripts/latency traces unless the user explicitly exports them

## Deployment assumptions

The current in-memory rate limiter assumes one application instance. If the app is horizontally scaled or broadly exposed to the internet, use shared rate-limit state and an outer access/session layer.

LiveKit development credentials and local `ws://` configuration are not production-safe. Follow `docs/DEPLOYMENT.md`.
