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

  constructor(private stream: MediaStream, private options: PhraseRecorderOptions) {}

  async start() {
    if (this.active) return;
    this.active = true;
    this.context = new AudioContext();
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    if (this.context.state !== 'running') {
      this.active = false;
      throw new Error('Browser audio engine is suspended. Click Start again and allow audio permissions.');
    }
    this.source = this.context.createMediaStreamSource(this.stream);

    if (this.context.audioWorklet) {
      try {
        await this.context.audioWorklet.addModule('/pcm-worklet.js');
        const worklet = new AudioWorkletNode(this.context, 'veylo-pcm-capture');
        worklet.port.onmessage = (event) => this.handle(new Float32Array(event.data), this.context!.sampleRate);
        this.node = worklet;
        this.source.connect(worklet);
        const silent = this.context.createGain();
        silent.gain.value = 0;
        worklet.connect(silent);
        silent.connect(this.context.destination);
        return;
      } catch (error) {
        console.warn('[recorder] AudioWorklet unavailable, using ScriptProcessor fallback', error);
      }
    }

    // Deprecated by browsers but kept as a compatibility fallback when AudioWorklet
    // cannot be loaded. The normal path above is AudioWorklet-first.
    const processor = this.context.createScriptProcessor(4096, 1, 1);
    this.node = processor;
    const silent = this.context.createGain();
    silent.gain.value = 0;
    this.source.connect(processor);
    processor.connect(silent);
    silent.connect(this.context.destination);
    processor.onaudioprocess = (event) => this.handle(event.inputBuffer.getChannelData(0), this.context!.sampleRate);
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
    if (!this.active || this.paused || input.length === 0) return;
    const now = performance.now();
    let squareSum = 0;
    let inputPeak = 0;
    for (const value of input) {
      squareSum += value * value;
      inputPeak = Math.max(inputPeak, Math.abs(value));
    }
    const rms = Math.sqrt(squareSum / input.length);
    const threshold = this.options.threshold ?? 0.018;
    const voiced = rms > threshold;

    let startedNow = false;
    if (!this.speechStart) this.pushPreRoll(input, sampleRate);
    if (voiced) {
      if (!this.speechStart) {
        this.speechStart = now;
        this.chunks = this.preRoll;
        this.preRoll = [];
        this.preRollSamples = 0;
        this.peak = 0;
        startedNow = true;
      }
      this.lastVoice = now;
      this.peak = Math.max(this.peak, inputPeak);
    }
    if (this.speechStart && !startedNow) this.chunks.push(new Float32Array(input));

    const elapsed = this.speechStart ? now - this.speechStart : 0;
    const silentFor = this.lastVoice ? now - this.lastVoice : 0;
    const shouldFlush = this.speechStart && (
      (silentFor > (this.options.silenceMs ?? 650) && elapsed > (this.options.minSpeechMs ?? 280)) ||
      elapsed > (this.options.maxPhraseMs ?? 5_200)
    );
    if (!shouldFlush) return;

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
    const maxSamples = sampleRate * ((this.options.preRollMs ?? 160) / 1_000);
    while (this.preRoll.length > 1 && this.preRollSamples > maxSamples) {
      const removed = this.preRoll.shift();
      if (removed) this.preRollSamples -= removed.length;
    }
  }

  private reset() {
    this.chunks = [];
    this.preRoll = [];
    this.preRollSamples = 0;
    this.speechStart = 0;
    this.lastVoice = 0;
    this.peak = 0;
  }

  stop() {
    this.active = false;
    try { this.node?.disconnect(); } catch {}
    try { this.source?.disconnect(); } catch {}
    void this.context?.close();
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
