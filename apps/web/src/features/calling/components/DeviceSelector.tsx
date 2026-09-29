import React from 'react';
import { Mic, Video, Volume2, X, Settings } from 'lucide-react';
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
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '20px',
      }}
    >
      <div
        className="sassy-dialog"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '28px',
          color: '#f8fafc',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.2)',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8',
              }}
            >
              <Settings size={18} />
            </div>
            <h2 id="device-settings-title" style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
              Audio & Video Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Microphone */}
          <div className="sassy-form-group">
            <label htmlFor="mic-select" className="sassy-label">
              <span className="sassy-label-left">
                <Mic size={13} color="#818cf8" /> Microphone
              </span>
              <span className="sassy-badge-optional">Input</span>
            </label>
            <div className="sassy-input-wrap">
              <span className="sassy-input-icon">
                <Mic size={15} color="#818cf8" />
              </span>
              <select
                id="mic-select"
                value={selectedAudioInput}
                onChange={(e) => {
                  setSelectedAudioInput(e.target.value);
                  onDeviceChange?.('audio', e.target.value);
                }}
                className="sassy-select"
              >
                {audioInputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microphone (${d.deviceId.slice(0, 8)})`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Camera */}
          <div className="sassy-form-group">
            <label htmlFor="camera-select" className="sassy-label">
              <span className="sassy-label-left">
                <Video size={13} color="#818cf8" /> Camera
              </span>
              <span className="sassy-badge-optional">Video</span>
            </label>
            <div className="sassy-input-wrap">
              <span className="sassy-input-icon">
                <Video size={15} color="#818cf8" />
              </span>
              <select
                id="camera-select"
                value={selectedVideoInput}
                onChange={(e) => {
                  setSelectedVideoInput(e.target.value);
                  onDeviceChange?.('video', e.target.value);
                }}
                className="sassy-select"
              >
                {videoInputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera (${d.deviceId.slice(0, 8)})`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Speakers */}
          <div className="sassy-form-group">
            <label htmlFor="speaker-select" className="sassy-label">
              <span className="sassy-label-left">
                <Volume2 size={13} color="#818cf8" /> Speakers
              </span>
              <span className="sassy-badge-optional">Output</span>
            </label>
            <div className="sassy-input-wrap">
              <span className="sassy-input-icon">
                <Volume2 size={15} color="#818cf8" />
              </span>
              <select
                id="speaker-select"
                value={selectedAudioOutput}
                onChange={(e) => setSelectedAudioOutput(e.target.value)}
                className="sassy-select"
              >
                {audioOutputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Speaker (${d.deviceId.slice(0, 8)})`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 22px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              border: 'none',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

