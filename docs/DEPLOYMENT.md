# Deployment

Veylo has two deployment profiles. Do not treat the repository's local LiveKit config as an internet-facing production configuration.

## Local / internal development

For a single machine or trusted LAN test:

```bash
cp .env.example .env
# add OPENROUTER_API_KEY
docker compose up --build
```

Open `http://localhost:8080`.

The checked-in `infra/livekit.yaml` intentionally uses a narrow UDP range and development credentials. It is for development only.

## Production

Use separate domains for the web application and LiveKit media server, for example:

- `veylo.example.com`
- `livekit.veylo.example.com`
- `turn.veylo.example.com`

Generate the production LiveKit configuration with LiveKit's official VM configuration generator rather than editing the local YAML into production shape by hand. A production deployment needs valid TLS, public DNS, TURN/TLS, and firewall rules suitable for WebRTC.

Typical VM firewall requirements from the LiveKit deployment guide are:

- TCP 80 for certificate issuance
- TCP 443 for HTTPS and TURN/TLS
- TCP 7881 for WebRTC over TCP
- UDP 3478 for TURN/UDP
- UDP 50000-60000 for WebRTC media

Set production secrets outside Git:

```env
LIVEKIT_URL=wss://livekit.veylo.example.com
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
OPENROUTER_API_KEY=...
APP_URL=https://veylo.example.com/app
NEXT_PUBLIC_BASE_PATH=/app
```

Use different LiveKit credentials and deployments for local, staging, and production.

## Versioning

The repository pins LiveKit Server instead of using `:latest`. Upgrade deliberately, test the call path, then bump the image tag in `docker-compose.yml`.

## Smoke test after every deployment

1. Open the site on desktop and mobile.
2. Create a room from device A.
3. Join from device B on a different network if possible.
4. Verify camera, microphone, mute/unmute, reconnect, and leave.
5. Verify participant country/language metadata.
6. Speak a foreign language and verify STT → translation → TTS.
7. Speak the listener's own language and verify original audio returns to full volume.
8. Disable AI while TTS is playing and verify playback stops.
9. Simulate an OpenRouter failure and verify original audio remains usable.
