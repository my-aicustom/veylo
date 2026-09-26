'use client';

import * as React from 'react';
import { apiUrl } from '@/lib/paths';

export interface VoiceOrbProps {
  status: 'idle' | 'listening' | 'thinking' | 'speaking';
  amplitude?: number;
  mode?: 'mock' | 'live';
  onClick?: () => void;
  onLiveStatus?: (status: VoiceOrbProps['status']) => void;
  onLiveNotice?: (notice: string) => void;
}

const statusLabel: Record<VoiceOrbProps['status'], string> = {
  idle: 'Tap to start',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
};

function websocketUrl(path: string) {
  const url = new URL(apiUrl(path), window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

function floatTo16BitPcm(input: Float32Array) {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const value = Math.max(-1, Math.min(1, input[i]));
    output[i] = value < 0 ? value * 0x8000 : value * 0x7fff;
  }
  return output;
}

function downsample(input: Float32Array, inputRate: number, outputRate: number) {
  if (outputRate === inputRate) return input;
  const ratio = inputRate / outputRate;
  const length = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    output[i] = input[Math.min(input.length - 1, Math.floor(i * ratio))] ?? 0;
  }
  return output;
}

function base64FromInt16(pcm: Int16Array) {
  const bytes = new Uint8Array(pcm.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function int16FromBase64(data: string) {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

function audioRate(mimeType = '') {
  const match = /rate=(\d+)/.exec(mimeType);
  return match ? Number(match[1]) : 24_000;
}

export function VoiceOrb({
  status,
  amplitude = 0,
  mode = 'mock',
  onClick,
  onLiveStatus,
  onLiveNotice,
}: VoiceOrbProps) {
  const [liveStatus, setLiveStatus] = React.useState<VoiceOrbProps['status']>('idle');
  const socketRef = React.useRef<WebSocket | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const processorRef = React.useRef<ScriptProcessorNode | null>(null);
  const sourceRef = React.useRef<MediaStreamAudioSourceNode | null>(null);
  const silentGainRef = React.useRef<GainNode | null>(null);

  const displayStatus = mode === 'live' ? liveStatus : status;
  const intensity = Math.max(0, Math.min(1, mode === 'live' && liveStatus !== 'idle' ? Math.max(amplitude, 0.68) : amplitude));

  const setLiveState = React.useCallback((next: VoiceOrbProps['status'], notice?: string) => {
    setLiveStatus(next);
    onLiveStatus?.(next);
    if (notice) onLiveNotice?.(notice);
  }, [onLiveNotice, onLiveStatus]);

  const stopLive = React.useCallback((notice = 'Gemini Live session paused.') => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    silentGainRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'client-stop' }));
      socketRef.current.close(1000, 'voice stopped');
    }
    processorRef.current = null;
    sourceRef.current = null;
    silentGainRef.current = null;
    streamRef.current = null;
    socketRef.current = null;
    setLiveState('idle', notice);
  }, [setLiveState]);

  const playGeminiAudio = React.useCallback((data: string, mimeType?: string) => {
    const context = audioContextRef.current;
    if (!context) return;
    const pcm = int16FromBase64(data);
    const buffer = context.createBuffer(1, pcm.length, audioRate(mimeType));
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i += 1) channel[i] = pcm[i] / 0x8000;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = () => {
      if (socketRef.current?.readyState === WebSocket.OPEN) setLiveState('listening');
    };
    setLiveState('speaking', 'Gemini Live menjawab dengan suara real-time.');
    source.start();
  }, [setLiveState]);

  const handleGeminiMessage = React.useCallback((event: MessageEvent<string>) => {
    try {
      const message = JSON.parse(event.data);
      if (message.error) {
        stopLive(`Gemini Live fallback: ${message.error}`);
        onClick?.();
        return;
      }
      if (message.setupComplete) {
        setLiveState('listening', 'Gemini Live siap. Bicara natural seperti konsultasi langsung.');
      }
      const parts = message.serverContent?.modelTurn?.parts;
      if (Array.isArray(parts)) {
        for (const part of parts) {
          const inline = part?.inlineData;
          if (inline?.data && typeof inline.data === 'string') {
            playGeminiAudio(inline.data, inline.mimeType);
          }
        }
      }
      if (message.serverContent?.turnComplete && socketRef.current?.readyState === WebSocket.OPEN) {
        setLiveState('listening');
      }
    } catch {
      // Ignore malformed proxy frames.
    }
  }, [onClick, playGeminiAudio, setLiveState, stopLive]);

  const startLive = React.useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      const context = new AudioContextCtor();
      await context.resume();

      const socket = new WebSocket(websocketUrl('/api/live-voice'));
      socketRef.current = socket;
      streamRef.current = stream;
      audioContextRef.current = context;

      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const silentGain = context.createGain();
      silentGain.gain.value = 0;

      sourceRef.current = source;
      processorRef.current = processor;
      silentGainRef.current = silentGain;

      processor.onaudioprocess = (event) => {
        if (socket.readyState !== WebSocket.OPEN) return;
        const input = event.inputBuffer.getChannelData(0);
        const pcm = floatTo16BitPcm(downsample(input, context.sampleRate, 16_000));
        socket.send(JSON.stringify({
          realtimeInput: {
            mediaChunks: [{
              mimeType: 'audio/pcm;rate=16000',
              data: base64FromInt16(pcm),
            }],
          },
        }));
      };

      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(context.destination);

      socket.onopen = () => setLiveState('listening', 'Menghubungkan ke Gemini Live Voice...');
      socket.onmessage = handleGeminiMessage;
      socket.onerror = () => {
        stopLive('Gemini Live belum tersedia. Fallback ke mode rekaman lokal.');
        onClick?.();
      };
      socket.onclose = () => {
        if (socketRef.current === socket) stopLive('Gemini Live terputus. Fallback siap dipakai.');
      };
    } catch (error) {
      stopLive(error instanceof Error ? error.message : 'Gemini Live microphone setup failed.');
      onClick?.();
    }
  }, [handleGeminiMessage, onClick, setLiveState, stopLive]);

  React.useEffect(() => () => stopLive('Gemini Live session closed.'), [stopLive]);

  function handleClick() {
    if (mode !== 'live') {
      onClick?.();
      return;
    }
    if (socketRef.current || streamRef.current) stopLive();
    else void startLive();
  }

  return (
    <button
      className="voice-orb"
      data-status={displayStatus}
      data-mode={mode}
      type="button"
      onClick={handleClick}
      aria-label={`Voice assistant ${statusLabel[displayStatus]}`}
      style={{ '--orb-amp': intensity } as React.CSSProperties}
    >
      <span className="voice-orb-ring" aria-hidden="true" />
      <span className="voice-orb-core" aria-hidden="true">
        <span />
      </span>
      <span className="voice-orb-label">{statusLabel[displayStatus]}</span>
    </button>
  );
}
