import React from 'react';
import { Inbox, Check, Trash2, Clock } from 'lucide-react';
import { useVoicemails, useMarkVoicemailRead, useDeleteVoicemail } from '../hooks/use-telephony';

export const VoicemailListView: React.FC = () => {
  const { data: voicemails, isLoading, error } = useVoicemails();
  const markReadMutation = useMarkVoicemailRead();
  const deleteMutation = useDeleteVoicemail();

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Inbox size={20} color="#818cf8" /> Voicemail Inbox
        </h2>
        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
          Listen to caller recordings, review automated transcripts, and manage voicemail archives.
        </p>
      </div>

      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        {isLoading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>Loading voicemails...</div>
        ) : error ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#f87171' }}>Failed to load voicemails: {String(error)}</div>
        ) : !voicemails || voicemails.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <Inbox size={40} color="#334155" style={{ margin: '0 auto 12px' }} />
            <p style={{ margin: 0, fontWeight: 600, color: '#f8fafc', fontSize: '15px' }}>Your voicemail inbox is clear</p>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>
              When callers leave a message on your direct DID, it will appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {voicemails.map((vm, index) => (
              <div
                key={vm.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  borderBottom: index < voicemails.length - 1 ? '1px solid #1e293b' : 'none',
                  backgroundColor: vm.status === 'UNREAD' ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#f8fafc', fontSize: '15px' }}>
                      {vm.callerNumber}
                    </span>
                    {vm.status === 'UNREAD' && (
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: '9999px',
                          fontSize: '10px',
                          fontWeight: 700,
                          backgroundColor: 'rgba(99, 102, 241, 0.2)',
                          color: '#818cf8',
                          border: '1px solid rgba(99, 102, 241, 0.4)',
                        }}
                      >
                        NEW
                      </span>
                    )}
                    <span style={{ fontSize: '12px', color: '#64748b' }}>• {formatDate(vm.createdAt)}</span>
                  </div>

                  {vm.transcript ? (
                    <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', fontStyle: 'italic' }}>
                      &ldquo;{vm.transcript}&rdquo;
                    </p>
                  ) : (
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                      Audio message recorded ({formatDuration(vm.durationSeconds)})
                    </p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} /> {formatDuration(vm.durationSeconds)}
                    </span>
                    <span>Session: {vm.callSessionId}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {vm.status === 'UNREAD' && (
                    <button
                      type="button"
                      onClick={() => markReadMutation.mutate(vm.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 12px',
                        backgroundColor: '#1e293b',
                        color: '#cbd5e1',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      <Check size={14} />
                      <span>Mark Read</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Delete this voicemail message?')) {
                        deleteMutation.mutate(vm.id);
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: '6px',
                      borderRadius: '6px',
                    }}
                    title="Delete Voicemail"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
