# Veylo internal-beta acceptance checklist

This checklist defines when a build can be treated as an internal production candidate. Automated CI can prove repository integrity; device/network behaviour must still be verified physically.

## A. Automated repository gates

All must pass:

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm audit:static`
- [ ] `pnpm test`
- [ ] `pnpm readiness:template`
- [ ] `docker compose config`
- [ ] `pnpm typecheck`
- [ ] `pnpm build`

## B. Production configuration

- [ ] `pnpm readiness -- --env .env.production` passes
- [ ] public app URL uses trusted HTTPS
- [ ] LiveKit URL uses public `wss://`
- [ ] LiveKit advertises the correct public IP
- [ ] TURN/TLS is reachable from a restrictive network
- [ ] development LiveKit credentials are not used
- [ ] OpenRouter key is server-side only
- [ ] LiveKit image version is explicitly pinned

## C. Core product flows

### Live Call

- [ ] user can create a room
- [ ] second device can join using shared link
- [ ] camera/microphone permission flow is understandable
- [ ] both participants can see/hear each other
- [ ] remote speech is transcribed
- [ ] translation appears in the selected listener language
- [ ] translated TTS plays
- [ ] original audio is restored after TTS/failure
- [ ] same-language speech is not unnecessarily translated/ducked
- [ ] target language can be changed during the call
- [ ] transcript survives accidental refresh on the same browser
- [ ] transcript export works

### Face-to-Face

- [ ] microphone starts/stops cleanly
- [ ] speaker side is inferred acceptably
- [ ] both translation directions work
- [ ] TTS does not feed back continuously into the recorder
- [ ] transcript export/restore works

### AI Simulation

- [ ] role/country/scenario context changes behaviour
- [ ] spoken user turn is transcribed
- [ ] AI counterpart responds
- [ ] AI voice plays
- [ ] listener-language subtitle appears when required

## D. Device/browser matrix

At minimum:

- [ ] Windows Chrome or Edge
- [ ] Android Chrome
- [ ] iPhone Safari
- [ ] two-device call across different networks

Recommended additional coverage:

- [ ] macOS Safari
- [ ] Bluetooth headset
- [ ] laptop speaker + built-in microphone
- [ ] mobile speakerphone

## E. Network resilience

- [ ] stable broadband/Wi-Fi
- [ ] mobile hotspot or 4G/5G
- [ ] Wi-Fi disabled and re-enabled during call
- [ ] LiveKit UI shows reconnect/offline state correctly
- [ ] audio returns after reconnect
- [ ] restrictive office/event Wi-Fi successfully falls back through TURN

## F. AI and latency quality

Use `/app/diagnostics` after a translated call.

Internal targets for a stable network (targets, not protocol guarantees):

- [ ] median translated-audio E2E start is acceptable for natural conversation
- [ ] no single pipeline stage dominates unexpectedly without being visible in telemetry
- [ ] STT handles Indonesian and English clearly
- [ ] names, numbers, currencies and trade terminology are preserved acceptably
- [ ] failure of STT/translation/TTS does not kill the call itself

Do not mark the build fully accepted until the physical device/network sections above have been completed.
