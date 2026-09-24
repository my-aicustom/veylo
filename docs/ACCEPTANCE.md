# Veylo v1.3.0 environment acceptance checklist

The repository gate is automated. This checklist is for the real VPS, browser, device, and network environment.

## A. Automated repository gate

The CI release gate must be green for all of:

- [x] frozen dependency install
- [x] static project audit
- [x] automated Node tests
- [x] production-template readiness
- [x] Docker Compose validation
- [x] TypeScript typecheck
- [x] Astro + Next.js production build
- [x] built-runtime smoke test
- [x] signed invite runtime verification
- [x] runtime security-header verification

A `main` release artifact is produced only after this gate.

## B. Production configuration

- [ ] `pnpm readiness -- --env .env.production` passes using the actual environment
- [ ] `pnpm infra:check -- --livekit <actual-livekit.yaml> --nginx <actual-nginx.conf>` passes
- [ ] `/app/api/ready` returns HTTP 200 after deployment
- [ ] public app URL uses trusted HTTPS
- [ ] LiveKit URL uses trusted public `wss://`
- [ ] LiveKit advertises the correct public IP
- [ ] TURN/TLS is reachable from a restrictive network
- [ ] development credentials are absent
- [ ] OpenRouter provider-side spend controls are configured to your preferred limit
- [ ] DNS/cert renewal is operational

### Automated remote deployment gate

After deploying the real environment, run:

```bash
pnpm acceptance:prod -- --url https://veylo.example.com --deep --expected-version 1.3.0
```

This automatically verifies the deployable subset of sections B/C: HTTPS/TLS reachability, application page, security headers, `/app/api/ready`, strict-production/runtime flags, signed invite creation, unsigned/tampered invite rejection, valid LiveKit token issuance, WSS configuration, diagnostics reachability, and optional OpenRouter/LiveKit deep reachability.

A green remote run can be used as evidence for the corresponding machine-verifiable checks, but it does **not** replace device/media/network acceptance such as microphone permissions, Bluetooth routing, TURN behavior on restrictive Wi-Fi, real STT/translation/TTS quality, or conversational latency.

## C. Live Call

- [ ] create room returns a signed invite URL
- [ ] URL without/tampered invite is denied in strict production
- [ ] second device joins with the valid shared link
- [ ] both participants see/hear each other
- [ ] remote speech is transcribed
- [ ] translation appears in each selected listener language
- [ ] translated TTS plays
- [ ] original audio recovers after TTS/provider failure
- [ ] target language changes during the call
- [ ] transcript persists locally through a long meeting (test >80 turns) and exports
- [ ] protected glossary terms remain stable in translation
- [ ] a transient translation failure preserves source transcript and original audio
- [ ] stale/congested TTS is skipped rather than played late over current speech
- [ ] meeting brief extracts stated parties/company/product/quantity/price/currency/commitments without inventing facts
- [ ] Markdown and JSON meeting-brief exports work

## D. Face-to-Face

- [ ] microphone start/stop works
- [ ] external microphone can be selected on supported browsers
- [ ] translated audio can be routed to a Bluetooth/headset output where browser output selection is supported
- [ ] both translation directions work
- [ ] manual speaker attribution works when both people use the same language or code-switch
- [ ] protected glossary terms remain stable
- [ ] TTS does not create an uncontrolled feedback loop
- [ ] transcript restore/export works

## E. AI Simulation

- [ ] country/role/scenario affects AI counterpart behaviour
- [ ] spoken user input transcribes
- [ ] AI reply renders and speaks
- [ ] selected microphone and AI voice output are used on supporting browsers
- [ ] simulation history restores and exports
- [ ] translated listener subtitle appears when needed

## F. Device/browser matrix

Minimum:

- [ ] Windows Chrome or Edge
- [ ] Android Chrome
- [ ] iPhone Safari
- [ ] two-device call across different networks

Recommended:

- [ ] macOS Safari
- [ ] Bluetooth headset
- [ ] laptop built-in mic/speaker
- [ ] mobile speakerphone

## G. Network resilience

- [ ] stable broadband/Wi-Fi
- [ ] mobile hotspot or 4G/5G
- [ ] Wi-Fi disabled/re-enabled mid-call
- [ ] reconnect state is visible and audio returns
- [ ] restrictive office/event Wi-Fi succeeds through TURN

## H. AI/latency acceptance

Use `/app/diagnostics` after real translated calls:

- [ ] median E2E translated-audio start is acceptable for your conversation style
- [ ] no unexpected dominant pipeline stage
- [ ] Indonesian/English STT is acceptable
- [ ] required target languages are acceptable
- [ ] names, numbers, currencies, and trade terminology are preserved
- [ ] STT language names/codes normalize correctly when providers return values such as `English`, `Indonesian`, `en-US`, or `id`
- [ ] OpenRouter failures degrade interpretation without killing the call

Environment acceptance is complete only after the unchecked physical/deployment items above are verified.


## I. Capacity and field evidence

- [ ] `pnpm capacity:probe -- --url https://veylo.example.com --requests 300 --concurrency 12` passes from outside the VPS
- [ ] Diagnostics JSON exported on Windows Chrome/Edge
- [ ] Diagnostics JSON exported on Android Chrome
- [ ] Diagnostics JSON exported on iPhone Safari
- [ ] reconnect/offline event evidence captured during a network interruption
- [ ] real two-device test completed across different networks
- [ ] restrictive-network TURN test completed

Use `docs/FIELD_ACCEPTANCE.md` for the repeatable field-test protocol and evidence package.
