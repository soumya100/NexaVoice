import React, { useState } from 'react';
import { useAdvancedCalling } from '../hooks/useAdvancedCalling';
import { Calendar, Plus, X, Clock, RefreshCw, Trash2, ArrowUpRight, Sparkles } from 'lucide-react';
import { toastService } from '../../../services/toast';

interface ScheduledCallsViewProps {
  onJoinCall?: (roomIdOrCallId: string) => void;
}

export const ScheduledCallsView: React.FC<ScheduledCallsViewProps> = ({ onJoinCall }) => {
  const {
    scheduledCalls,
    isLoadingScheduledCalls,
    scheduleCall,
    isScheduling,
    cancelScheduledCall,
    refetchScheduledCalls,
  } = useAdvancedCalling();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [description, setDescription] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await refetchScheduledCalls();
      toastService.info('Scheduled calls & conferences refreshed.');
    } catch {
      toastService.error('Failed to sync scheduled calls.');
    } finally {
      setTimeout(() => setIsSyncing(false), 400);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startTime) {
      toastService.warning('Please specify both a title and scheduled start time.');
      return;
    }

    const cleanTitle = title.trim();
    toastService.info(`Scheduling conference "${cleanTitle}"...`);

    try {
      await scheduleCall({
        title: cleanTitle,
        scheduledStartTime: new Date(startTime).toISOString(),
        description: description.trim() || undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      });

      toastService.success(`Call "${cleanTitle}" scheduled successfully!`);
      setTitle('');
      setStartTime('');
      setDescription('');
      setIsModalOpen(false);
      await refetchScheduledCalls();
    } catch (err: any) {
      console.error('Failed to schedule call', err);
      toastService.error(err?.message || 'Failed to schedule call. Please verify inputs.');
    }
  };

  const handleCancel = async (callId: string, callTitle: string) => {
    setCancellingId(callId);
    try {
      await cancelScheduledCall(callId);
      toastService.success(`Scheduled call "${callTitle}" has been cancelled.`);
      await refetchScheduledCalls();
    } catch (err: any) {
      console.error('Failed to cancel call', err);
      toastService.error(err?.message || 'Failed to cancel scheduled call.');
    } finally {
      setCancellingId(null);
    }
  };

  const handleJoin = (targetId: string, callTitle: string) => {
    toastService.success(`Connecting to scheduled call "${callTitle}"...`);
    onJoinCall?.(targetId);
  };

  return (
    <div
      style={{
        padding: '32px 36px',
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        backgroundColor: '#090d16',
        color: '#f8fafc',
        fontFamily: 'var(--nv-font-sans)',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '28px',
          paddingBottom: '20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '24px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              margin: '0 0 6px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'linear-gradient(135deg, #ffffff 40%, #93c5fd 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            <Calendar size={26} color="#3b82f6" /> Scheduled Calls & Conferences
          </h2>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
            Plan ahead with calendar-synced audio/video calls, invitations, and automated reminders.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing || isLoadingScheduledCalls}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              color: '#cbd5e1',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 18px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)',
              transition: 'all 150ms ease',
            }}
          >
            <Plus size={16} /> Schedule Call
          </button>
        </div>
      </div>

      {/* Main Content */}
      {isLoadingScheduledCalls ? (
        <div
          style={{
            padding: '36px',
            borderRadius: '14px',
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            color: '#94a3b8',
            fontSize: '14px',
          }}
        >
          <RefreshCw size={18} className="animate-spin" color="#3b82f6" />
          <span>Loading scheduled conferences...</span>
        </div>
      ) : scheduledCalls.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            borderRadius: '16px',
            textAlign: 'center',
            color: '#94a3b8',
            border: '1px dashed rgba(255,255,255,0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Calendar size={24} color="#60a5fa" />
          </div>
          <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>
            No calls scheduled yet.
          </h4>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b', maxWidth: '400px' }}>
            Arrange your next team sync, one-on-one, or multi-party video conference in advance.
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            style={{
              marginTop: '6px',
              padding: '8px 18px',
              borderRadius: '8px',
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              color: '#93c5fd',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Schedule Your First Call
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {scheduledCalls.map((call) => (
            <div
              key={call.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 24px',
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                borderRadius: '14px',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                transition: 'all 150ms ease',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#f8fafc', marginBottom: '6px' }}>
                  {call.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#94a3b8' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Clock size={14} color="#60a5fa" />
                    {new Date(call.scheduledStartTime).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span>•</span>
                  <span>
                    Status: <strong style={{ color: '#38bdf8' }}>{call.status}</strong>
                  </span>
                  {call.description && (
                    <>
                      <span>•</span>
                      <span style={{ color: '#cbd5e1' }}>{call.description}</span>
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleJoin(call.callSessionId || call.id, call.title)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)',
                  }}
                >
                  <span>Join</span>
                  <ArrowUpRight size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleCancel(call.id, call.title)}
                  disabled={cancellingId === call.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px 14px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 size={13} />
                  <span>{cancellingId === call.id ? 'Cancelling...' : 'Cancel'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Schedule Call Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="schedule-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(4, 7, 14, 0.75)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => !isScheduling && setIsModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: '#0f172a',
              borderRadius: '16px',
              padding: '28px',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
              color: '#f8fafc',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                  }}
                >
                  <Calendar size={18} color="#60a5fa" />
                </div>
                <div>
                  <h3 id="schedule-modal-title" style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>
                    Schedule a Call
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                    Set up a scheduled audio or video conference with invitations.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !isScheduling && setIsModalOpen(false)}
                disabled={isScheduling}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: isScheduling ? 'not-allowed' : 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label htmlFor="scheduled-title" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Title
                </label>
                <input
                  id="scheduled-title"
                  type="text"
                  required
                  disabled={isScheduling}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Design Architecture Review"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#f8fafc',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label htmlFor="scheduled-start-time" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Date & Time
                </label>
                <input
                  id="scheduled-start-time"
                  type="datetime-local"
                  required
                  disabled={isScheduling}
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#f8fafc',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  disabled={isScheduling}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Meeting agenda, briefing, or details..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#f8fafc',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isScheduling}
                  style={{
                    padding: '9px 18px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    color: '#cbd5e1',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: isScheduling ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isScheduling}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 22px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: isScheduling ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)',
                    opacity: isScheduling ? 0.7 : 1,
                  }}
                >
                  {isScheduling ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Scheduling...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={15} />
                      <span>Schedule Call</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
