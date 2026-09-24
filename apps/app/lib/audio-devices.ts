'use client';

export interface AudioDeviceChoice {
  deviceId: string;
  label: string;
}

export async function listAudioDevices() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return { inputs: [] as AudioDeviceChoice[], outputs: [] as AudioDeviceChoice[], outputSelectionSupported: false };
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  const inputs = devices
    .filter((device) => device.kind === 'audioinput')
    .map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Microphone ${index + 1}` }));
  const outputs = devices
    .filter((device) => device.kind === 'audiooutput')
    .map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Speaker ${index + 1}` }));
  const probe = typeof document !== 'undefined' ? document.createElement('audio') as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> } : null;
  return { inputs, outputs, outputSelectionSupported: Boolean(probe && typeof probe.setSinkId === 'function') };
}
