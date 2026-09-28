import React from 'react';
import { RecordingSession, RecordingConsent } from '../types';
import { RecordingStatus, ConsentState } from '@nexavoice/domain-types';

interface RecordingIndicatorBannerProps {
  recording?: RecordingSession;
  currentUserId: string;
  canRecord?: boolean;
  onPause: (recordingId: string) => Promise<void>;
  onResume: (recordingId: string) => Promise<void>;
  onStop: (recordingId: string) => Promise<void>;
  onConsent: (recordingId: string, consented: boolean) => Promise<void>;
}

export const RecordingIndicatorBanner: React.FC<RecordingIndicatorBannerProps> = ({
  recording,
  currentUserId,
  canRecord = false,
  onPause,
  onResume,
  onStop,
  onConsent,
}) => {
  if (!recording || recording.status === RecordingStatus.COMPLETED || recording.status === RecordingStatus.DELETED) {
    return null;
  }

  const isPaused = recording.status === RecordingStatus.PAUSED;
  const isRecording = recording.status === RecordingStatus.RECORDING;

  // Check consent for this participant
  const myConsent = recording.consents?.find((c: RecordingConsent) => c.participantUserId === currentUserId);
  const isConsentPending = !myConsent || myConsent.consentState === ConsentState.PENDING;

  return (
    <aside
      aria-label="Call Recording Status and Consent"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '10px 16px',
        backgroundColor: '#0f172a',
        border: isPaused ? '1px solid #eab308' : '1px solid #ef4444',
        borderRadius: '8px',
        marginBottom: '12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: isPaused ? '#eab308' : '#ef4444',
              boxShadow: isPaused ? '0 0 6px #eab308' : '0 0 8px #ef4444',
            }}
          />
          {/* Textual status indicator - NOT color alone */}
          <span
            style={{
              fontWeight: 700,
              fontSize: '0.85rem',
              letterSpacing: '0.05em',
              color: isPaused ? '#fef08a' : '#fecaca',
            }}
          >
            {isPaused ? 'RECORDING PAUSED' : 'RECORDING IN PROGRESS'}
          </span>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            ({recording.recordingType})
          </span>
        </div>

        {canRecord && (
          <div style={{ display: 'flex', gap: '6px' }}>
            {isRecording && (
              <button
                type="button"
                onClick={() => onPause(recording.id)}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.8rem',
                  backgroundColor: '#334155',
                  color: '#f8fafc',
                  border: '1px solid #475569',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Pause
              </button>
            )}
            {isPaused && (
              <button
                type="button"
                onClick={() => onResume(recording.id)}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.8rem',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Resume
              </button>
            )}
            <button
              type="button"
              onClick={() => onStop(recording.id)}
              style={{
                padding: '4px 10px',
                fontSize: '0.8rem',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Stop Recording
            </button>
          </div>
        )}
      </div>

      {isConsentPending && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            backgroundColor: '#1e293b',
            borderRadius: '6px',
            border: '1px solid #3b82f6',
          }}
        >
          <div style={{ fontSize: '0.82rem', color: '#e2e8f0' }}>
            This call is being recorded. Do you consent to audio, video, and AI transcript generation?
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => onConsent(recording.id, true)}
              style={{
                padding: '4px 10px',
                fontSize: '0.8rem',
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Consent
            </button>
            <button
              type="button"
              onClick={() => onConsent(recording.id, false)}
              style={{
                padding: '4px 10px',
                fontSize: '0.8rem',
                backgroundColor: '#475569',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Decline
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
