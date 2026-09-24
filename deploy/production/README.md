# Production deployment assets

This directory contains reviewable production templates for Veylo.

## Files

- `env.production.example` — production application environment template.
- `livekit.yaml.example` — secure LiveKit baseline showing public-IP advertisement and TURN/TLS requirements.

## Recommended workflow

1. Use LiveKit's official VM generator for the actual RTC deployment.
2. Compare the generated LiveKit config with `livekit.yaml.example` so public-IP and TURN/TLS requirements are not accidentally omitted.
3. Copy `env.production.example` to a private `.env.production`.
4. Replace every placeholder.
5. Run:

```bash
pnpm readiness -- --env .env.production
```

6. Run `/app/diagnostics` after deployment.
7. Complete `docs/ACCEPTANCE.md`.

Do not commit a populated production env file or TLS private key.
