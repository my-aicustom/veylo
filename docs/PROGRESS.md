# Veylo v1.3.0 progress snapshot

Date: 2026-09-24

## Current assessment

- Original functional code scope: **~99%**
- Source-level production hardening/tooling: **~99%**
- Automated/offline verification available in this packaging environment: **~97%**
- Overall path from product concept to field-accepted production deployment: **~95–96%**

The remaining percentage is primarily evidence that cannot be manufactured from source code: real DNS/TLS/WSS/TURN, real multi-device browser behaviour, restrictive-network relay, real accents/noise/terminology quality, measured translated-audio latency on the selected providers, and actual concurrent WebRTC capacity on the chosen VPS/uplink.

## v1.3.0 additions after v1.2.0

- stricter production acceptance: expected-version check, cache-control validation, deeper CSP/permissions/HSTS checks, cross-origin rejection, malformed-invite rejection, and runtime version consistency
- safe HTTP capacity probe with configurable concurrency, p50/p95/p99 latency, throughput, error-rate thresholds, and JSON output
- expanded browser diagnostics for WebSocket, AudioWorklet, storage, explicit audio-output routing, audio-output device count, and network effective type
- privacy-safe field diagnostics JSON export with no transcript/audio/secrets
- persistent network resilience telemetry for offline/online, reconnect/reconnected, poor/lost quality, and audio-playback blocking
- repeatable real-device/network field acceptance protocol and evidence package
- infrastructure configuration validator for LiveKit public-IP/TURN/TLS/RTC ports and Nginx TLS/proxy/security-header requirements
- CI syntax gate for capacity tooling and dynamic release-artifact naming fixed to current package version

## Verification target for this checkpoint

Repository tests, static audit, TypeScript transpile/type validation available offline, readiness template, source hygiene, version synchronization, and ZIP integrity are rerun before packaging. Full framework build/runtime smoke still depends on having the locked pnpm dependencies available.
