# Veylo v1.3.0 field acceptance protocol

This protocol turns the remaining real-world uncertainty into repeatable evidence. It is intentionally separate from source-code verification because browser, device, network, TURN, provider latency, and acoustics cannot be certified from the repository alone.

## 1. Before field testing

Run the production gates from a machine outside the VPS:

```bash
pnpm acceptance:prod -- --url https://veylo.example.com --deep --expected-version 1.3.0
pnpm capacity:probe -- --url https://veylo.example.com --requests 300 --concurrency 12
```

The capacity probe only exercises public HTML routes. It does not invoke paid AI inference or certify LiveKit media capacity.

## 2. Minimum device matrix

Record one exported Diagnostics report for each minimum device/browser pair:

- Windows 11 + current Chrome or Edge
- Android + current Chrome
- iPhone + current Safari

Recommended additions:

- macOS + Safari
- Bluetooth headset/earbuds
- laptop built-in mic/speaker
- mobile speakerphone
- USB/external microphone

On each device, open `/app/diagnostics`, run full diagnostics, then use **Export field report**. The JSON contains browser/runtime/latency/network evidence but no transcript text, microphone audio, API key, LiveKit secret, or invite secret.

## 3. Network scenarios

At minimum complete these call pairs:

1. broadband/Wi-Fi ↔ broadband/Wi-Fi
2. Wi-Fi ↔ 4G/5G hotspot/mobile network
3. restrictive office/event Wi-Fi ↔ external network
4. disable and restore Wi-Fi during an active call

For each scenario verify:

- both participants can join from the signed link
- camera and original audio remain usable
- translated subtitles continue after transient provider failure
- LiveKit reconnect state is visible
- media recovers after network restoration
- restrictive-network scenario succeeds through the production TURN topology
- network events appear in Diagnostics after reconnect/offline tests

## 4. Speech/translation scenarios

Use representative trade-conversation phrases rather than generic sentences. Include:

- Indonesian ↔ English
- at least two additional required event languages
- buyer/company/person names
- product names and protected glossary terms
- quantities and units
- prices and currencies
- dates and delivery windows
- Incoterms such as FOB/CIF when relevant
- code-switching and same-language Face-to-Face mode
- moderate background noise
- at least one non-native/accented English speaker

Confirm that transcript text remains available even when translated TTS is skipped because it became stale or the queue was congested.

## 5. Initial operational targets

These are practical internal targets, not universal language-quality claims. Adjust them after observing the actual event network and selected providers.

- no browser crash or unrecoverable call state in a 30-minute translated session
- successful reconnect after a short network interruption
- no stale translated audio speaking over a much newer conversation turn
- median translated-audio start preferably <= 3 seconds
- p95 translated-audio start preferably <= 6 seconds
- names/numbers/currencies reviewed as acceptable for the intended event workflow
- Meeting Brief contains only facts present in the retained transcript and is human-reviewed before external use

If latency misses the target, use Diagnostics stage medians to determine whether STT, translation, TTS, network, or queueing dominates before changing models.

## 6. HTTP/VPS capacity evidence

Run multiple safe probes from a machine outside the VPS, including during normal load:

```bash
pnpm capacity:probe -- --url https://veylo.example.com --requests 300 --concurrency 12
pnpm capacity:probe -- --url https://veylo.example.com --requests 1000 --concurrency 25 --max-p95-ms 2000
```

This measures web/app edge throughput only. LiveKit media capacity must be judged using real concurrent calls or LiveKit-specific infrastructure tooling because WebRTC bandwidth, codecs, TURN relay use, and uplink capacity dominate media scaling.

## 7. Evidence package

Keep together:

- production acceptance output
- capacity probe output
- exported Diagnostics JSON per device/browser
- notes for each network scenario
- latency screenshots or JSON
- any provider/model changes used during acceptance
- VPS/LiveKit monitoring snapshot during concurrent calls

Production field acceptance is complete only when the repository gates are green and the minimum real-device/network scenarios have evidence.
