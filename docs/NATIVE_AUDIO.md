# Native audio transcription and conversational VAD

The default STT model is `google/gemini-2.5-flash`. Set `STT_MODEL` in the
server environment; existing deployments must update their previous Whisper
override. The API key remains `OPENROUTER_API_KEY`, on the server only.

Audio is sent as a base64 `input_audio` message to OpenRouter chat completions.
Gemini returns a structured transcript and detected language. The existing
translation and speech playback stages consume that transcript. This is phrase
based audio understanding, not the Gemini Live API or Gemini audio generation.

## Reliability

- A shared 30 second deadline covers provider attempts; client disconnects cancel
  the provider request. Only transient network/429/5xx errors are retried, with
  at most three attempts. The browser does not retry the audio job again.
- Refused, truncated, malformed and incorrectly typed model results are rejected.
  Silence is represented by an empty transcript. Usage is retained for budgeting.
- Vocabulary and language are spelling hints, not instructions. Audio content
  must be transcribed rather than followed as a command.
- Provider error bodies are not returned to clients because they can echo input.
- Explicit `openai/whisper-*` model overrides retain the legacy transcription
  endpoint for rollback. Other overrides must support audio input and JSON schema.

## Voice activity detection

All conversation modes allow a 1,100 ms pause before ending a phrase, with a
20 second hard limit. VAD uses audio sample time, a slowly adapting noise floor,
and a lower release threshold for quiet trailing syllables. A 60 ms continuous
onset and minimum voiced duration reject clicks. Pre-roll retains initial sounds.
Playback pause clears captured samples to avoid feedback.

Recorder startup is guarded against stop/start races. Stopping disconnects nodes,
closes the worklet port and audio context, and releases its microphone tracks.
LiveKit callers pass cloned tracks so the original call remains connected.

Energy based VAD cannot reliably distinguish loud continuous music from speech.
Real microphone testing in representative rooms is still needed to tune thresholds
and validate accents, overlapping speakers and acoustic echo. Vocabulary hints
also do not guarantee exact proper-name spelling.

## Verification

Run `pnpm test` and `pnpm typecheck`. `tests/voice-input.test.mjs` covers the native
payload/response contract, provider retries and cancellation, nonduplicated client
jobs, pauses, onset filtering, long phrases and stop during worklet initialization.

Provider contract: https://openrouter.ai/docs/guides/overview/multimodal/audio

Model: https://openrouter.ai/google/gemini-2.5-flash
