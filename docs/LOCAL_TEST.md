# Local test playbook — Veylo v1.0.0

Use this after extracting the verified source ZIP.

## 1. Requirements

- Node.js 22 recommended
- pnpm 10.18.2
- Docker / Docker Compose if testing local LiveKit
- an OpenRouter API key for real AI calls

## 2. Install

```bash
cp .env.example .env
pnpm install --frozen-lockfile
```

Set `OPENROUTER_API_KEY` in `.env`.

For signed-invite testing locally, also set a random `VEYLO_INVITE_SECRET` with at least 32 characters. It may remain blank for basic local development.

## 3. Automated local verification

```bash
pnpm audit:static
pnpm test
pnpm readiness:template
pnpm typecheck
pnpm build
pnpm smoke:runtime
```

The runtime smoke uses dummy provider/LiveKit credentials and does not spend OpenRouter credits.

## 4. Start local LiveKit

```bash
docker compose up livekit -d
```

Default development values:

```text
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=devsecret
```

These values are local-development only.

## 5. Start Veylo

```bash
pnpm dev
```

Open:

- public site: http://localhost:4321
- app: http://localhost:3000/app
- diagnostics: http://localhost:3000/app/diagnostics
- readiness JSON: http://localhost:3000/app/api/ready
- health JSON: http://localhost:3000/app/api/health

## 6. Minimum manual local test

Use two browsers or two devices:

1. complete name/country profile
2. create a Live Call
3. copy/share the signed invite link
4. join from the second device
5. verify camera + microphone both directions
6. speak Indonesian on one side and a different supported language on the other
7. confirm original transcript, translated subtitle, and translated TTS
8. change target language during the call
9. verify transcript export
10. open Diagnostics and review E2E/STT/translation/TTS latency

Then test Face-to-Face and AI Simulation.

## 7. Production config check

Never reuse the local `.env`.

```bash
cp deploy/production/env.production.example .env.production
```

Replace every placeholder and run:

```bash
pnpm readiness -- --env .env.production
```

Do not deploy if it fails.

## 8. When something fails

Capture:

- browser + OS/device
- exact action that failed
- console/network error
- `/app/diagnostics` result
- `/app/api/ready` result
- server log around the same timestamp
- Veylo latency trace if the issue is speech delay

Do not send API keys, LiveKit secrets, invite secret, or TLS private keys.
