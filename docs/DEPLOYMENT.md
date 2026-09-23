# Deployment notes

The root `docker-compose.yml` is a **local/dev composition**. It intentionally exposes LiveKit without public TLS and uses development credentials. Do not expose that file unchanged to the internet.

## Production topology

Use two public hostnames:

- `veylo.example.com` for the Astro site + Next.js app.
- `rtc.example.com` for LiveKit signaling/WebRTC.

The browser must receive a public `wss://` LiveKit URL. An internal Docker hostname such as `ws://livekit:7880` is not reachable from a participant's browser.

For a production VM, follow LiveKit's VM/deployment guidance so the server has trusted TLS, correct public-IP advertisement, UDP/TCP ICE, and TURN/TLS. Corporate/event Wi-Fi can block direct UDP, so TURN/TLS is part of the production requirement rather than an optional polish item.

Expected firewall coverage for the standard LiveKit VM topology includes HTTPS/TURN TLS, ICE/TCP and the configured UDP range. Match the exact ports to the production LiveKit configuration you deploy.

## Secrets

Generate non-development values for:

- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `OPENROUTER_API_KEY`

Keep them server-side. Never put them in `NEXT_PUBLIC_*` variables.

## AI endpoints

Veylo intentionally has no user login. The application instead uses:

- same-origin checks for browser API calls;
- per-IP in-memory rate limits for the single-instance internal deployment;
- request-size validation on AI routes;
- server-side OpenRouter credentials.

If the service is later exposed broadly on the public internet or scaled to multiple app instances, move rate-limit state to Redis and add an outer access layer or signed invite/session mechanism.
