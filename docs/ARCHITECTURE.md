# Architecture

```text
                         VEYLO
                           │
         ┌─────────────────┴──────────────────┐
         │                                    │
   Astro public site                   Next.js application
   static / SEO-first                         │
                                             ├── profiles
                                             ├── room UI
                                             ├── face-to-face
                                             ├── simulation
                                             └── server AI routes
                                                    │
                                      ┌─────────────┴─────────────┐
                                      │                           │
                              self-hosted LiveKit             OpenRouter
                              audio/video SFU           STT / translate / TTS
```

LiveKit handles realtime communication. OpenRouter is not the transport layer; it is only used for AI inference. The app must remain usable as a call surface even if AI interpretation is temporarily unavailable.


## Meeting intelligence

Conversation intelligence is deliberately separated from simultaneous translation. Live Call and Face-to-Face retain up to 80 transcript turns locally. On explicit user action, `/app/api/intelligence` sends the transcript text to OpenRouter and requests a strict factual JSON report containing parties/company context, commercial items, quantities/prices/currencies, commitments, action items, follow-ups, open questions and ambiguity flags. The normalized report is stored locally and can be exported as Markdown or JSON.

Live Call also transcribes the local microphone track for transcript completeness. Remote tracks remain responsible for listener-side translation/TTS; the local track is transcribed only and is never spoken back to the local user.

## Audio-device routing

Face-to-Face can choose an external microphone input. Translated TTS can target a selected audio output through `HTMLMediaElement.setSinkId` when supported (notably Chromium-class desktop browsers); otherwise the operating-system default output is used. Live Call exposes the same translated-TTS output selector.
