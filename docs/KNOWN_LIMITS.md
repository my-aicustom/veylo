# Known limits at v1.3.0

Veylo v1.3.0 is code-complete for the agreed internal product scope, but the following limits still require real environment validation or a larger architecture change:

- A real two-device, cross-network call has not been certified inside this packaging environment.
- AI latency and speech quality depend on the selected OpenRouter providers and the user network.
- Real TEI-style accents, background noise, names, numbers, currencies and trade terminology still need field tuning.
- Face-to-Face does not perform acoustic speaker diarization. It now provides manual speaker attribution override when language-based attribution is ambiguous or both people use the same language.
- Transcripts retain up to 500 turns locally. If browser storage is unusually constrained, Veylo progressively retains the newest safe subset rather than breaking the live call.
- Meeting intelligence analyzes up to 500 turns and bounds individual phrase length before sending the report request to control context size and cost.
- Explicit translated-audio output selection depends on `HTMLMediaElement.setSinkId`; unsupported browsers use the operating-system default output.
- Live translated speech is intentionally skipped when its playback queue is too old or congested so stale TTS does not duck current conversation audio. Subtitle/transcript content remains available.
- Meeting intelligence only extracts facts present in the retained transcript and should be reviewed before external use.
- Process-local rate and budget counters are suitable for the intended small internal single-instance deployment. Horizontal scaling requires shared state such as Redis.
- Self-hosted production LiveKit still requires trusted TLS, TURN, firewall/NAT configuration and operational monitoring on the actual infrastructure.
- The VEYLO name remains a working codename until brand clearance is complete.

- The included HTTP capacity probe measures the web/application edge, not WebRTC media capacity; real concurrent LiveKit sessions are still required to validate media/VPS/uplink scaling.
- Exported field diagnostics provide device/network evidence but cannot replace human review of actual speech/translation quality.
