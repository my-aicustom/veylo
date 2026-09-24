# VEYLO — v0.4.6

> Working codename. Internal multilingual communication product by MY-AI.

Veylo combines a fast Astro marketing homepage with a self-hosted LiveKit realtime application and server-side OpenRouter inference.

## Product modes

- **Live Call** — create/join a Veylo video room with listener-side interpretation.
- **Face-to-Face** — one device acts as interpreter between two people in the same room.
- **AI Simulation** — practice with an AI counterpart using country, role and scenario context.
- **Diagnostics** — test browser media, WebRTC, server config, LiveKit reachability, and OpenRouter model availability.

## v0.4.6 lower-latency TTS transport

- TTS audio is streamed through the Next.js gateway instead of being fully buffered on the server first
- supported browsers use MediaSource progressive playback for `audio/mpeg`
- playback can start after the first valid audio chunks instead of waiting for the complete MP3 response
- browsers without MediaSource support keep the previous full-blob playback path
- the same playback engine is used by Live Call, Face-to-Face, and AI Simulation
- upstream generation IDs are forwarded when OpenRouter provides them
- the gateway marks TTS responses with `X-Veylo-TTS-Transport: stream`

OpenRouter documents streaming responses for its speech endpoint. Progressive browser playback is feature-detected because MediaSource support is not universal.

## v0.4.5 diagnostics

- new `/app/diagnostics` page reachable from the app home
- browser checks for online state, secure context, WebRTC, media APIs, mic/camera permissions, and detected devices
- server config check exposes only booleans/metadata; secrets are never returned
- deep OpenRouter check uses `GET /api/v1/models` instead of paid inference
- selected STT/translation/TTS model IDs are verified against the OpenRouter model catalog
- LiveKit reachability is tested from the app server with a short timeout
- diagnostics UI is responsive and designed for local troubleshooting

## Local development

```bash
cp .env.example .env
pnpm install
pnpm dev
```

- Astro site: http://localhost:4321
- Veylo app: http://localhost:3000/app
- Diagnostics: http://localhost:3000/app/diagnostics
- LiveKit: ws://localhost:7880 when started separately or through Docker Compose

To run LiveKit locally:

```bash
docker compose up livekit -d
```

The Astro site uses `PUBLIC_APP_URL`. For local development you can set:

```bash
PUBLIC_APP_URL=http://localhost:3000/app
```

## Full local container stack

```bash
cp .env.example .env
# fill OPENROUTER_API_KEY
docker compose up --build
```

Then open http://localhost:8080.

The root Docker Compose file is for local/internal development. **Do not publish it unchanged to the internet.** Read `docs/DEPLOYMENT.md` before VPS deployment; production LiveKit needs a public `wss://` endpoint, trusted TLS, public-IP advertisement and TURN coverage for restrictive networks.

## Security boundary

`OPENROUTER_API_KEY`, `LIVEKIT_API_SECRET`, and future server credentials must never be shipped into browser code. OpenRouter calls live only in Next.js server routes.

Veylo intentionally has no user login. Current API guards are suitable for a single-instance internal deployment; if it becomes broadly public or horizontally scaled, move rate limiting to shared state and add an outer access/session layer.

## Foundation

The call application is derived from patterns and dependencies in the official LiveKit Meet project and uses self-hosted LiveKit Server. See `UPSTREAM.md`, `THIRD_PARTY_NOTICES.md`, and `LICENSE`.

## Before public branding

Read `BRAND_STATUS.md`. "Veylo" is currently a working codename and is **not cleared as a public trademark/product name**.
