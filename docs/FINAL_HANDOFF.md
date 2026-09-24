# Veylo v1.3.0 deployment-hardening checkpoint

This package continues the original-scope source handoff with additional production acceptance, capacity, infrastructure and field-evidence tooling. It does not contain `.git`, `node_modules`, build output, or secrets.

## First local verification

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm audit:static
pnpm test
pnpm readiness:template
pnpm infra:check:template
pnpm typecheck
pnpm build
pnpm smoke:runtime
```

The packaging environment completed all dependency-independent gates, but could not reinstall npm dependencies because outbound DNS to the npm registry is unavailable. No npm dependency was added in v1.3.0.

## Production sequence

1. Copy `deploy/production/env.production.example` to `.env.production` and replace every placeholder.
2. Run `pnpm readiness -- --env .env.production`.
3. Validate the actual infra files with `pnpm infra:check -- --livekit <path> --nginx <path>`.
4. Deploy LiveKit with public WSS, public-IP advertisement and TURN/TLS.
5. Deploy the Astro/Next application behind trusted HTTPS.
6. From another machine run `pnpm acceptance:prod -- --url https://YOUR-DOMAIN --deep --expected-version 1.3.0`.
7. Run `pnpm capacity:probe -- --url https://YOUR-DOMAIN --requests 300 --concurrency 12`.
8. Open `/app/diagnostics`, run full diagnostics, and export the field report on each target device.
9. Complete `docs/FIELD_ACCEPTANCE.md` and `docs/ACCEPTANCE.md`.

## What is now automated

- source regression/static/readiness checks
- production environment validation
- LiveKit/Nginx config structure validation
- deployed app/version/security/invite/provider acceptance
- safe HTTP edge capacity sample
- browser capability report
- interpreter latency evidence
- reconnect/offline/quality event evidence

## What remains physical

- trusted DNS/TLS on the actual domain
- public WSS and TURN/TLS reachability
- real Windows/Android/iPhone behavior
- real Bluetooth routing
- accent/noise/terminology quality
- actual translated-audio latency on the selected providers/network
- concurrent WebRTC/media capacity of the chosen VPS/uplink

Those items cannot be honestly marked complete until the deployed system is exercised in the real environment.
