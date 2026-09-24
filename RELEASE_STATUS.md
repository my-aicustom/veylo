# Veylo v1.0.0 — release status

## Codebase status

**Repository / code-defined scope: COMPLETE.**

Veylo v1.0.0 contains the complete application architecture and release engineering required for the agreed internal product scope:

- Astro public homepage
- Next.js internal application
- Live Call on self-hosted LiveKit
- Face-to-Face interpreter
- AI Simulation
- OpenRouter STT, translation, mediation/simulation, and TTS
- streaming translated speech
- transcript persistence/export
- local latency telemetry and diagnostics
- signed, expiring room invites without user accounts
- same-origin/API payload/rate guards
- global AI request and tracked-cost backstops
- deterministic health and readiness endpoints
- structured provider logs that do not log conversation bodies
- production configuration preflight
- pinned LiveKit runtime version
- WSS/TURN/TLS deployment templates
- CSP/HSTS/anti-framing/nosniff/permissions/referrer security-header baseline
- automated static tests, repository tests, typecheck, production build, Docker Compose validation, and built-runtime smoke tests
- verified release ZIP, SHA-256 checksum, and build manifest on successful main builds

## What “complete” does not certify

Source code cannot prove characteristics of infrastructure it is not running on. These remain environment acceptance items, not unfinished repository work:

- DNS and trusted TLS on the actual VPS
- public LiveKit WSS reachability
- TURN/TLS reachability through the actual event/corporate network
- firewall/NAT correctness
- Windows/Android/iPhone microphone, camera, autoplay, Bluetooth, and Safari behaviour
- real conversational STT/translation/TTS quality
- measured latency on the selected OpenRouter models/providers and user networks
- capacity of the chosen VPS and internet uplink

Those checks are intentionally documented in `docs/ACCEPTANCE.md`.

## Release gate

A Veylo v1.0.0 source artifact is generated from `main` only after:

1. frozen dependency install
2. static audit
3. automated Node tests
4. repository/production-template readiness
5. Docker Compose validation
6. TypeScript typecheck
7. Astro + Next.js production build
8. built-runtime smoke test

The runtime smoke boots the built applications and verifies health/readiness, diagnostics, security headers, signed invite creation, rejection of missing/tampered invites, valid LiveKit token issuance, and the public Astro site.

## Operational boundary

Veylo v1.0.0 is designed for a small internal single-application-instance deployment. If it becomes public, multi-tenant, or horizontally scaled, move rate limits/budget counters to shared state and add an organizational access layer.
