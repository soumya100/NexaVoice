import { useState, useEffect, useCallback } from 'react';
import { DeviceInfo } from '../types';

export function useDeviceManager() {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>('');
  const [selectedVideoInput, setSelectedVideoInput] = useState<string>('');
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>('');
  const [hasPermission, setHasPermission] = useState(false);

  const refreshDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const deviceList = await navigator.mediaDevices.enumerateDevices();

      const mapped: DeviceInfo[] = deviceList.map((d, index) => ({
        deviceId: d.deviceId,
        label: d.label || `${d.kind === 'audioinput' ? 'Microphone' : d.kind === 'videoinput' ? 'Camera' : 'Speaker'} ${index + 1}`,
        kind: d.kind as DeviceInfo['kind'],
      }));

      setDevices(mapped);

      const hasLabels = mapped.some((d) => d.label && !d.label.startsWith('Microphone ') && !d.label.startsWith('Camera '));
      setHasPermission(hasLabels);

      const audioIn = mapped.find((d) => d.kind === 'audioinput');
      if (audioIn && !selectedAudioInput) setSelectedAudioInput(audioIn.deviceId);

      const videoIn = mapped.find((d) => d.kind === 'videoinput');
      if (videoIn && !selectedVideoInput) setSelectedVideoInput(videoIn.deviceId);

      const audioOut = mapped.find((d) => d.kind === 'audiooutput');
      if (audioOut && !selectedAudioOutput) setSelectedAudioOutput(audioOut.deviceId);
    } catch (err) {
      console.warn('Error enumerating devices', err);
    }
  }, [selectedAudioInput, selectedVideoInput, selectedAudioOutput]);

  useEffect(() => {
    refreshDevices();
    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
      };
    }
  }, [refreshDevices]);

  const audioInputs = devices.filter((d) => d.kind === 'audioinput');
  const videoInputs = devices.filter((d) => d.kind === 'videoinput');
  const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');

  return {
    devices,
    audioInputs,
    videoInputs,
    audioOutputs,
    selectedAudioInput,
    selectedVideoInput,
    selectedAudioOutput,
    hasPermission,
    setSelectedAudioInput,
    setSelectedVideoInput,
    setSelectedAudioOutput,
    refreshDevices,
  };
}
