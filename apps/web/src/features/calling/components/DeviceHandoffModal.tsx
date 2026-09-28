import React, { useState } from 'react';

interface DeviceOption {
  deviceId: string;
  deviceName: string;
  deviceType: 'DESKTOP' | 'MOBILE' | 'WEB' | 'TABLET';
  isCurrentDevice?: boolean;
}

interface DeviceHandoffModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableDevices: DeviceOption[];
  onHandoff: (targetDeviceId: string) => Promise<void>;
  isTransferring?: boolean;
}

export const DeviceHandoffModal: React.FC<DeviceHandoffModalProps> = ({
  isOpen,
  onClose,
  availableDevices,
  onHandoff,
  isTransferring = false,
}) => {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  if (!isOpen) return null;

  const targetDevices = availableDevices.filter((d) => !d.isCurrentDevice);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="device-handoff-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: '420px',
          backgroundColor: '#1e293b',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid #334155',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          color: '#f8fafc',
        }}
      >
        <h2 id="device-handoff-title" style={{ margin: '0 0 8px 0', fontSize: '1.25rem' }}>
          Seamless Device Handoff
        </h2>
        <p style={{ margin: '0 0 16px 0', color: '#94a3b8', fontSize: '0.875rem' }}>
          Transfer this active call to another of your connected devices without interruption.
        </p>

        {targetDevices.length === 0 ? (
          <div
            style={{
              padding: '16px',
              backgroundColor: '#0f172a',
              borderRadius: '8px',
              color: '#94a3b8',
              textAlign: 'center',
              fontSize: '0.9rem',
              marginBottom: '16px',
            }}
          >
            No other active devices detected. Sign in on your mobile or desktop app to handoff.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {targetDevices.map((device) => (
              <label
                key={device.deviceId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: selectedDeviceId === device.deviceId ? '1px solid #3b82f6' : '1px solid #334155',
                  backgroundColor: selectedDeviceId === device.deviceId ? '#1e3a8a22' : '#0f172a',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <input
                  type="radio"
                  name="targetDevice"
                  value={device.deviceId}
                  checked={selectedDeviceId === device.deviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                />
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.95rem' }}>{device.deviceName}</div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{device.deviceType}</div>
                </div>
              </label>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: 'transparent',
              border: '1px solid #475569',
              borderRadius: '6px',
              color: '#cbd5e1',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedDeviceId || isTransferring}
            onClick={() => onHandoff(selectedDeviceId)}
            style={{
              padding: '8px 18px',
              backgroundColor: '#3b82f6',
              border: 'none',
              borderRadius: '6px',
              color: '#ffffff',
              fontWeight: 500,
              cursor: !selectedDeviceId || isTransferring ? 'not-allowed' : 'pointer',
              opacity: !selectedDeviceId || isTransferring ? 0.6 : 1,
            }}
          >
            {isTransferring ? 'Transferring...' : 'Transfer Call'}
          </button>
        </div>
      </div>
    </div>
  );
};
