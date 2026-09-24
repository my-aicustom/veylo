# Veylo v1.3.0 — final code-scope status

## Overall status

**Original code-defined product scope: COMPLETE for handoff.**

Veylo v1.3.0 closes the functional scope discussed for the internal multilingual business-communication product while keeping infrastructure/device acceptance separate from source-code completion.

## Original scope now implemented

- Astro public homepage and responsive Next.js internal application
- no-account onboarding using name + country + preferred listener language
- 249 country/territory entries with multilingual country hints
- actual spoken language detected from STT per phrase; country remains context, not a hard language mapping
- self-hosted LiveKit private video rooms
- signed and expiring room invites
- realtime OpenRouter-only STT → translation → TTS interpretation
- listener-specific target language changes during a call
- external microphone selection for Face-to-Face mode
- translated-audio output routing to selectable speaker/Bluetooth headset where the browser supports `setSinkId`
- Face-to-Face two-way interpreter on one device
- AI Simulation with country/role/scenario context
- neutral AI mediator for concrete misunderstanding risks
- transcript persistence, restore, clear and export
- meeting intelligence generated on demand from the transcript:
  - factual summary
  - people / company / role / country / contact extraction when stated
  - product, quantity, unit, price, currency, Incoterm and delivery extraction
  - commitments
  - action items and ownership
  - follow-ups
  - open questions
  - risks / ambiguities
  - Markdown brief and structured JSON export
- local latency telemetry and diagnostics
- reconnection/audio-health visibility
- same-origin, payload-size and rate guards
- process-level AI request and tracked-cost backstops
- structured provider latency/error logs without conversation-body logging
- deterministic health/readiness endpoints
- production configuration preflight
- WSS/TURN/TLS and hardened reverse-proxy templates
- CSP, HSTS, anti-framing, nosniff, referrer and permissions policies
- automated repository regression tests, static audit and production-template validation
- remote production acceptance runner

## v1.2.0 stabilization additions

- up to 500 retained transcript turns for longer business meetings
- meeting-intelligence input expanded to the same 500-turn window
- persistent protected-term glossary wired into translation requests
- translation failure degrades to source transcript/original audio instead of dropping the turn
- browser-side retry for transient API/network failures
- mediator clarification checks throttled/de-duplicated to control background AI cost
- translated-speech queue backpressure and stale-audio suppression to preserve realtime behavior
- manual Face-to-Face speaker attribution override for same-language/code-switching cases
- AI Simulation local persistence, export, microphone selection, output routing and auto-detected user speech


## v1.3.0 deployment-evidence additions

- stricter remote production acceptance with expected-version, no-store, CSP/permissions/HSTS, origin-rejection, malformed-invite, and version-consistency checks
- safe public-route capacity probe with p50/p95/p99 latency, throughput and error thresholds
- expanded browser diagnostics and privacy-safe field-report export
- local network/reconnect telemetry retained for real-call evidence
- static validation of actual LiveKit and Nginx production configuration
- repeatable device/network field acceptance protocol
- CI release artifact name follows the current package version dynamically

## Verification performed for this handoff

Offline verification in the packaging environment:

- Node repository/readiness tests: 38/38 PASS
- static project audit: PASS
- production template readiness: PASS
- production infrastructure template validation: 25/25 PASS
- capacity probe self-test against a local HTTP target: PASS
- TypeScript syntax/transpile pass over application `.ts/.tsx`: PASS (43 files)
- source scan for unresolved TODO/FIXME implementation markers: no unresolved product TODOs found

A full dependency install / Next.js + Astro build could not be rerun in the packaging container because it had no DNS access to the npm registry. The underlying v1.0.0 baseline had previously passed the repository CI build/runtime smoke gate; v1.3.0 adds source-only tooling/UI diagnostics without new npm dependencies. Run the normal gate after extracting on a networked machine.

## What source code still cannot certify

These are environment acceptance items, not missing product code:

- actual DNS and trusted TLS on the chosen VPS/domain
- public LiveKit WSS and correct public-IP/NAT advertisement
- TURN/TLS through restrictive event/corporate networks
- firewall correctness
- Windows/Android/iPhone browser microphone/camera/autoplay behavior
- Bluetooth device routing behavior on each browser/OS combination
- real OpenRouter model quality across required languages
- measured end-to-end conversational latency on event networks
- terminology accuracy for names, numbers, currencies and trade vocabulary in real meetings
- concurrent session capacity of the selected VPS/uplink

Complete `docs/ACCEPTANCE.md` after deployment before treating the environment as production accepted.
