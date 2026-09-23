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
