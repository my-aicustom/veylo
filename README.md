# VEYLO — v0.4.4

> Working codename. Internal multilingual communication product by MY-AI.

Veylo combines a fast Astro marketing homepage with a self-hosted LiveKit realtime application and server-side OpenRouter inference.

## Product modes

- **Live Call** — create/join a Veylo video room with listener-side interpretation.
- **Face-to-Face** — one device acts as interpreter between two people in the same room.
- **AI Simulation** — practice with an AI counterpart using country, role and scenario context.

## v0.4.4 call health

- Live Call now exposes local LiveKit connection quality in the call bar
- explicit `Reconnecting…` and `Offline` states instead of silently degrading
- browser autoplay failures surface an `Enable sound` action backed by `room.startAudio()`
- invite sharing checks native Web Share support and falls back to clipboard
- responsive health UI collapses to a compact status dot on small screens

## v0.4.3 session continuity

- target translation language can be changed while a Live Call is running
- per-room language override survives refresh/reconnect on the same browser
- Live Call transcripts are stored locally per room and restored after refresh
- Face-to-Face transcript is also restored locally until explicitly cleared
- transcript persistence is best-effort and never blocks an active conversation
- session history remains on the user's device; it is not uploaded as a separate Veylo history service

## Local development

```bash
cp .env.example .env
pnpm install
pnpm dev
```

- Astro site: http://localhost:4321
- Veylo app: http://localhost:3000/app
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
