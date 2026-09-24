# Security boundary

Veylo is currently designed as a small internal application rather than a public anonymous communications service.

## Secrets

These values are server-side only:

- `OPENROUTER_API_KEY`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

Never expose them through browser bundles, public repository files, screenshots, or `NEXT_PUBLIC_*` variables.

## Current controls

- same-origin checks on application API routes
- per-IP rate limiting for the single-instance app deployment
- payload and text-size limits
- validated room-name format before LiveKit token creation
- short-lived LiveKit participant tokens
- no-store responses for sensitive runtime endpoints
- baseline browser security headers at the development reverse proxy
- production preflight validation
- local-only transcripts/latency traces unless the user explicitly exports them

## Deployment assumptions

The current in-memory rate limiter assumes one application instance. If the app is horizontally scaled or broadly exposed to the internet, use shared rate-limit state and an outer access/session layer.

LiveKit development credentials and local `ws://` configuration are not production-safe. Follow `docs/DEPLOYMENT.md`.
