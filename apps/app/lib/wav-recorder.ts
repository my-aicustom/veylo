import { assetUrl } from './paths';

export interface Phrase {
  bytes: Uint8Array;
  durationMs: number;
  peak: number;
}

export interface PhraseRecorderOptions {
  silenceMs?: number;
  maxPhraseMs?: number;
  minSpeechMs?: number;
  threshold?: number;
  preRollMs?: number;
  startSpeechMs?: number;
  onPhrase: (phrase: Phrase) => void;
}

export class PhraseRecorder {
  private context?: AudioContext;
  private source?: MediaStreamAudioSourceNode;
  private node?: AudioWorkletNode | ScriptProcessorNode;
  private chunks: Float32Array[] = [];
  private preRoll: Float32Array[] = [];
  private preRollSamples = 0;
  private speechStart = 0;
  private lastVoice = 0;
  private peak = 0;
  private active = false;
  private paused = false;
  private audioTimeMs = 0;
  private voicedMs = 0;
  private onsetMs = 0;
  private noiseFloor = 0.003;
  private generation = 0;
  private silent?: GainNode;

  constructor(private stream: MediaStream, private options: PhraseRecorderOptions) {}

  async start() {
    if (this.active) return;
    const generation = ++this.generation;
    this.active = true;
    this.paused = false;
    this.reset();
    this.audioTimeMs = 0;
    this.noiseFloor = 0.003;
    try {
      const context = new AudioContext();
      this.context = context;
      const current = () => this.active && this.generation === generation;
      if (context.state === 'suspended') {
        await context.resume();
      }
      if (!current()) return;
      if (context.state !== 'running') {
        throw new Error('Browser audio engine is suspended. Click Start again and allow audio permissions.');
      }
      this.source = context.createMediaStreamSource(this.stream);

      if (context.audioWorklet) {
        try {
          await context.audioWorklet.addModule(assetUrl('/pcm-worklet.js'));
          if (!current()) return;
          const worklet = new AudioWorkletNode(context, 'veylo-pcm-capture');
          worklet.port.onmessage = (event) => {
            if (current()) this.handle(new Float32Array(event.data), context.sampleRate);
          };
          this.node = worklet;
          this.source.connect(worklet);
          const silent = this.silent = context.createGain();
          silent.gain.value = 0;
          worklet.connect(silent);
          silent.connect(context.destination);
          return;
        } catch (error) {
          if (!current()) return;
          this.disconnect();
          console.warn('[recorder] AudioWorklet unavailable, using ScriptProcessor fallback', error);
        }
      }

      // Deprecated by browsers but kept as a compatibility fallback when AudioWorklet
      // cannot be loaded. The normal path above is AudioWorklet-first.
      const processor = context.createScriptProcessor(4096, 1, 1);
      this.node = processor;
      const silent = this.silent = context.createGain();
      silent.gain.value = 0;
      this.source.connect(processor);
      processor.connect(silent);
      silent.connect(context.destination);
      processor.onaudioprocess = (event) => {
        if (current()) this.handle(event.inputBuffer.getChannelData(0), context.sampleRate);
      };
    } catch (error) {
      if (this.generation === generation) this.stop();
      throw error;
    }
  }

  pause() {
    this.paused = true;
    this.reset();
  }

  resume() {
    this.paused = false;
    this.reset();
  }

  private handle(input: Float32Array, sampleRate: number) {
    if (!this.active || this.paused || input.length === 0 || !Number.isFinite(sampleRate) || sampleRate <= 0) return;
    // Discard corrupt worklet frames instead of poisoning every subsequent sample.
    if (input.some((value) => !Number.isFinite(value))) return;
    const frameMs = input.length / sampleRate * 1_000;
    this.audioTimeMs += frameMs;
    const now = this.audioTimeMs;
    let squareSum = 0;
    let inputPeak = 0;
    for (const value of input) {
      squareSum += value * value;
      inputPeak = Math.max(inputPeak, Math.abs(value));
    }
    const rms = Math.sqrt(squareSum / input.length);
    const threshold = Math.max(this.options.threshold ?? 0.018, this.noiseFloor * 3);
    // A lower release threshold retains quiet syllables at the end of a word.
    const voiced = rms > (this.speechStart ? Math.max(threshold * 0.6, this.noiseFloor * 1.8) : threshold);
    if (!this.speechStart && rms < threshold) {
      const weight = 1 - Math.exp(-frameMs / 800);
      this.noiseFloor += (rms - this.noiseFloor) * weight;
    }

    let startedNow = false;
    if (!this.speechStart) {
      this.pushPreRoll(input, sampleRate);
      this.onsetMs = voiced ? this.onsetMs + frameMs : 0;
      if (this.onsetMs < (this.options.startSpeechMs ?? 60)) return;
    }
    if (voiced) {
      if (!this.speechStart) {
        this.speechStart = Math.max(Number.EPSILON, now - this.onsetMs);
        this.chunks = this.preRoll;
        this.preRoll = [];
        this.preRollSamples = 0;
        this.peak = 0;
        this.voicedMs = Math.max(0, this.onsetMs - frameMs);
        startedNow = true;
      }
      this.lastVoice = now;
      this.voicedMs += frameMs;
      this.peak = Math.max(this.peak, inputPeak);
    }
    if (this.speechStart && !startedNow) this.chunks.push(new Float32Array(input));

    const elapsed = this.speechStart ? now - this.speechStart : 0;
    const silentFor = this.lastVoice ? now - this.lastVoice : 0;
    const shouldFlush = this.speechStart && (
      silentFor >= (this.options.silenceMs ?? 1_100) ||
      elapsed >= (this.options.maxPhraseMs ?? 20_000)
    );
    if (!shouldFlush) return;

    this.flush();
  }

  flush() {
    if (!this.active || this.paused || !this.speechStart || this.chunks.length === 0) return;
    const sampleRate = this.context?.sampleRate;
    if (!sampleRate) return;
    // Silence must not make a short click qualify as speech.
    if (this.voicedMs < (this.options.minSpeechMs ?? 280)) {
      this.reset();
      return;
    }
    const peak = this.peak;
    const merged = concat(this.chunks);
    const resampled = resample(merged, sampleRate, 16_000);
    const bytes = encodeWav(resampled, 16_000);
    const durationMs = resampled.length / 16_000 * 1_000;
    this.reset();
    this.options.onPhrase({ bytes, durationMs, peak });
  }

  private pushPreRoll(input: Float32Array, sampleRate: number) {
    const copy = new Float32Array(input);
    this.preRoll.push(copy);
    this.preRollSamples += copy.length;
    const maxSamples = sampleRate * ((this.options.preRollMs ?? 240) / 1_000);
    while (this.preRoll.length > 1 && this.preRollSamples > maxSamples) {
      const removed = this.preRoll.shift();
      if (removed) this.preRollSamples -= removed.length;
    }
  }

  reset() {
    this.chunks = [];
    this.preRoll = [];
    this.preRollSamples = 0;
    this.speechStart = 0;
    this.lastVoice = 0;
    this.peak = 0;
    this.voicedMs = 0;
    this.onsetMs = 0;
  }

  private disconnect() {
    if (this.node && 'port' in this.node) {
      this.node.port.onmessage = null;
      this.node.port.close();
    } else if (this.node) {
      this.node.onaudioprocess = null;
    }
    try { this.node?.disconnect(); } catch {}
    try { this.source?.disconnect(); } catch {}
    try { this.silent?.disconnect(); } catch {}
    this.node = undefined;
    this.silent = undefined;
  }

  stop() {
    this.active = false;
    this.generation += 1;
    this.disconnect();
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {});
    this.stream.getTracks().forEach((track) => track.stop());
    this.node = undefined;
    this.source = undefined;
    this.context = undefined;
    this.reset();
  }
}

function concat(parts: Float32Array[]) {
  let length = 0;
  parts.forEach((part) => { length += part.length; });
  const output = new Float32Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function resample(input: Float32Array, fromRate: number, toRate: number) {
  if (fromRate === toRate) return input;
  const length = Math.max(1, Math.round(input.length * toRate / fromRate));
  const output = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    const position = index * (input.length - 1) / Math.max(1, length - 1);
    const first = Math.floor(position);
    const second = Math.min(input.length - 1, first + 1);
    const mix = position - first;
    output[index] = input[first] * (1 - mix) + input[second] * mix;
  }
  return output;
}

function encodeWav(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (const sample of samples) {
    const value = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, value < 0 ? value * 32_768 : value * 32_767, true);
    offset += 2;
  }
  return new Uint8Array(buffer);
}
