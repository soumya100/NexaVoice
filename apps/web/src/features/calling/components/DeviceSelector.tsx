import React from 'react';
import { useDeviceManager } from '../hooks/use-device-manager';

interface DeviceSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onDeviceChange?: (kind: 'audio' | 'video', deviceId: string) => void;
}

export const DeviceSelector: React.FC<DeviceSelectorProps> = ({
  isOpen,
  onClose,
  onDeviceChange,
}) => {
  const {
    audioInputs,
    videoInputs,
    audioOutputs,
    selectedAudioInput,
    selectedVideoInput,
    selectedAudioOutput,
    setSelectedAudioInput,
    setSelectedVideoInput,
    setSelectedAudioOutput,
  } = useDeviceManager();

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="device-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in"
    >
      <div className="w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl text-white">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800 mb-5">
          <h2 id="device-settings-title" className="text-base font-semibold">
            Audio & Video Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="text-neutral-400 hover:text-white p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Microphone */}
          <div>
            <label htmlFor="mic-select" className="block text-xs font-medium text-neutral-400 mb-1.5">
              Microphone
            </label>
            <select
              id="mic-select"
              value={selectedAudioInput}
              onChange={(e) => {
                setSelectedAudioInput(e.target.value);
                onDeviceChange?.('audio', e.target.value);
              }}
              className="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {audioInputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* Camera */}
          <div>
            <label htmlFor="camera-select" className="block text-xs font-medium text-neutral-400 mb-1.5">
              Camera
            </label>
            <select
              id="camera-select"
              value={selectedVideoInput}
              onChange={(e) => {
                setSelectedVideoInput(e.target.value);
                onDeviceChange?.('video', e.target.value);
              }}
              className="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {videoInputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* Speakers */}
          <div>
            <label htmlFor="speaker-select" className="block text-xs font-medium text-neutral-400 mb-1.5">
              Speakers
            </label>
            <select
              id="speaker-select"
              value={selectedAudioOutput}
              onChange={(e) => setSelectedAudioOutput(e.target.value)}
              className="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {audioOutputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
