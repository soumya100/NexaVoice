import React, { useState } from 'react';
import { callApi } from '../services/call-api';
import { RecordingSession, CallTranscript } from '../types';
import { Play, FileText, Trash2, Disc, Search } from 'lucide-react';

interface RecordingsViewProps {
  initialCallId?: string;
}

export const RecordingsView: React.FC<RecordingsViewProps> = ({ initialCallId }) => {
  const [recordings, setRecordings] = useState<RecordingSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [callIdInput, setCallIdInput] = useState(initialCallId || '');
  const [activePlaybackUrl, setActivePlaybackUrl] = useState<string | null>(null);
  const [selectedTranscript, setSelectedTranscript] = useState<CallTranscript | null>(null);

  const fetchRecordings = async () => {
    if (!callIdInput.trim()) return;
    setLoading(true);
    try {
      const recs = await callApi.getCallRecordings(callIdInput.trim());
      setRecordings(recs);
    } catch (err) {
      console.error('Failed to fetch recordings', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = async (recordingId: string) => {
    try {
      const { playbackUrl } = await callApi.getRecordingPlaybackUrl(recordingId);
      setActivePlaybackUrl(playbackUrl);
    } catch (err) {
      console.error('Failed to get playback URL', err);
    }
  };

  const handleTranscribeOrView = async (rec: RecordingSession) => {
    try {
      const transcripts = await callApi.getCallTranscripts(rec.id);
      if (transcripts.length > 0) {
        setSelectedTranscript(transcripts[0]);
      } else {
        const newTrans = await callApi.transcribeCall(rec.callSessionId, rec.id);
        setSelectedTranscript(newTrans);
      }
    } catch (err) {
      console.error('Failed to load/generate transcript', err);
    }
  };

  const handleDelete = async (recordingId: string) => {
    try {
      await callApi.deleteRecording(recordingId);
      setRecordings((prev) => prev.filter((r) => r.id !== recordingId));
    } catch (err) {
      console.error('Failed to delete recording', err);
    }
  };

  return (
    <div style={{ padding: '32px 36px', width: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Disc size={26} color="#ef4444" /> Call Recordings & AI Transcripts
        </h2>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
          Review encrypted call archives, stream playback securely with time-limited tokens, and inspect speaker-diarized transcripts.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', maxWidth: '560px' }}>
        <div style={{ flex: 1 }} className="sassy-input-wrap">
          <span className="sassy-input-icon">
            <Search size={16} color="#818cf8" />
          </span>
          <input
            type="text"
            value={callIdInput}
            onChange={(e) => setCallIdInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') fetchRecordings();
            }}
            placeholder="Enter Call Session ID to query encrypted recordings..."
            className="sassy-input"
          />
        </div>
        <button
          type="button"
          onClick={fetchRecordings}
          disabled={loading}
          style={{
            padding: '11px 22px',
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '13px',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 16px rgba(99, 102, 241, 0.35)',
            transition: 'all 150ms ease',
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? 'Searching...' : 'Find Recordings'}
        </button>
      </div>

      {activePlaybackUrl && (
        <div
          style={{
            padding: '16px',
            backgroundColor: '#0f172a',
            border: '1px solid #3b82f6',
            borderRadius: '10px',
            marginBottom: '24px',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px', color: '#38bdf8' }}>
            Now Playing (Secure Signed Stream)
          </div>
          <audio controls src={activePlaybackUrl} autoPlay style={{ width: '100%' }} />
        </div>
      )}

      {selectedTranscript && (
        <div
          style={{
            padding: '18px',
            backgroundColor: '#1e293b',
            border: '1px solid #6366f1',
            borderRadius: '10px',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontWeight: 600, color: '#c7d2fe' }}>
              AI Transcript & Speaker Diarization ({selectedTranscript.language})
            </div>
            <button
              type="button"
              onClick={() => setSelectedTranscript(null)}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
          <p style={{ fontStyle: 'italic', color: '#cbd5e1', marginBottom: '16px' }}>
            &quot;{selectedTranscript.fullText}&quot;
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {selectedTranscript.segments?.map((seg) => (
              <div
                key={seg.id}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#0f172a',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                }}
              >
                <strong style={{ color: '#38bdf8' }}>{seg.speakerLabel}:</strong> {seg.text}{' '}
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  ({(seg.startMs / 1000).toFixed(1)}s - {(seg.endMs / 1000).toFixed(1)}s)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recordings.length === 0 ? (
        <div
          style={{
            padding: '40px',
            backgroundColor: '#1e293b',
            borderRadius: '12px',
            textAlign: 'center',
            color: '#94a3b8',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          No recordings found for the specified Call ID.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {recordings.map((rec) => (
            <div
              key={rec.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                backgroundColor: '#1e293b',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f8fafc', marginBottom: '4px' }}>
                  Recording: {rec.id} ({rec.recordingType})
                </div>
                <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                  Status: <strong style={{ color: '#10b981' }}>{rec.status}</strong> &bull; Duration:{' '}
                  {rec.durationSeconds}s &bull; Started:{' '}
                  {rec.startedAt ? new Date(rec.startedAt).toLocaleString() : 'N/A'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handlePlay(rec.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    backgroundColor: '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <Play size={14} /> Play
                </button>
                <button
                  type="button"
                  onClick={() => handleTranscribeOrView(rec)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    backgroundColor: '#6366f1',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <FileText size={14} /> Transcript
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(rec.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    backgroundColor: 'transparent',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: '6px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
