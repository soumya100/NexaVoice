import React, { useState, useMemo } from 'react';
import { useAdvancedCalling } from '../hooks/useAdvancedCalling';
import {
  Calendar,
  Plus,
  X,
  Clock,
  RefreshCw,
  Trash2,
  ArrowUpRight,
  Sparkles,
  Video,
  Globe,
  Bell,
  AlignLeft,
  Search,
  Filter,
  CheckCircle2,
  CalendarDays,
} from 'lucide-react';
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
  const [callType, setCallType] = useState('HD_VIDEO');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [reminderMinutes, setReminderMinutes] = useState(15);
  const [description, setDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [isSyncing, setIsSyncing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Quick preset dates generator
  const setQuickOffset = (minutesFromNow: number) => {
    const d = new Date(Date.now() + minutesFromNow * 60 * 1000);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const localIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setStartTime(localIso);
  };

  const setDateTomorrowAt = (hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(hour, 0, 0, 0);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const localIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setStartTime(localIso);
  };

  const setDateNextMondayAt = (hour: number) => {
    const d = new Date();
    const day = d.getDay();
    const distance = (1 + 7 - day) % 7 || 7;
    d.setDate(d.getDate() + distance);
    d.setHours(hour, 0, 0, 0);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const localIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setStartTime(localIso);
  };

  // Formatted human-friendly preview
  const formattedPreview = useMemo(() => {
    if (!startTime) return null;
    try {
      const d = new Date(startTime);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return null;
    }
  }, [startTime]);

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
        timezone: timezone || 'UTC',
        reminderMinutes: Number(reminderMinutes) || 15,
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

  // Filtered calls
  const filteredCalls = useMemo(() => {
    return (scheduledCalls || []).filter((call) => {
      const matchesSearch =
        call.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (call.description && call.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesFilter = filterStatus === 'ALL' || call.status === filterStatus;
      return matchesSearch && matchesFilter;
    });
  }, [scheduledCalls, searchQuery, filterStatus]);

  return (
    <div
      style={{
        padding: '32px 36px',
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        backgroundColor: 'var(--nv-bg-canvas, #090d16)',
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
            <Calendar size={26} color="#6366f1" /> Scheduled Calls & Conferences
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
              gap: '7px',
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)',
              transition: 'all 150ms ease',
            }}
          >
            <Plus size={16} /> Schedule Call
          </button>
        </div>
      </div>

      {/* Sassy Search & Filter Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: '1 1 320px', minWidth: '240px' }} className="sassy-input-wrap">
          <span className="sassy-input-icon">
            <Search size={16} />
          </span>
          <input
            type="text"
            className="sassy-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search scheduled conferences by title or agenda..."
          />
        </div>

        <div style={{ width: '180px' }} className="sassy-input-wrap">
          <span className="sassy-input-icon">
            <Filter size={15} />
          </span>
          <select
            className="sassy-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="ACTIVE">Active Now</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Main Content */}
      {isLoadingScheduledCalls ? (
        <div
          style={{
            padding: '48px',
            borderRadius: '16px',
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            color: '#94a3b8',
            fontSize: '14px',
          }}
        >
          <RefreshCw size={24} className="animate-spin" color="#6366f1" />
          <span>Synchronizing encrypted conference sessions...</span>
        </div>
      ) : filteredCalls.length === 0 ? (
        <div
          style={{
            padding: '54px 28px',
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            borderRadius: '20px',
            textAlign: 'center',
            color: '#94a3b8',
            border: '1px dashed rgba(255, 255, 255, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(99, 102, 241, 0.25)',
            }}
          >
            <Calendar size={26} color="#818cf8" />
          </div>
          <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
            {searchQuery || filterStatus !== 'ALL'
              ? 'No matching conferences found'
              : 'No upcoming calls scheduled'}
          </h4>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b', maxWidth: '420px', lineHeight: 1.5 }}>
            {searchQuery || filterStatus !== 'ALL'
              ? 'Try modifying your search keywords or filter status above.'
              : 'Plan ahead with calendar-synced audio/video calls, invitations, and automated reminders.'}
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            style={{
              marginTop: '8px',
              padding: '10px 22px',
              borderRadius: '10px',
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              color: '#a5b4fc',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            + Schedule Your First Call
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredCalls.map((call) => (
            <div
              key={call.id}
              className="calling-interactive-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 26px',
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                transition: 'all 180ms ease',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '16px', color: '#f8fafc' }}>
                    {call.title}
                  </span>
                  <span
                    style={{
                      padding: '3px 9px',
                      borderRadius: '9999px',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      backgroundColor:
                        call.status === 'SCHEDULED'
                          ? 'rgba(99, 102, 241, 0.15)'
                          : call.status === 'ACTIVE'
                          ? 'rgba(16, 185, 129, 0.15)'
                          : 'rgba(100, 116, 139, 0.15)',
                      color:
                        call.status === 'SCHEDULED'
                          ? '#818cf8'
                          : call.status === 'ACTIVE'
                          ? '#34d399'
                          : '#94a3b8',
                      border: `1px solid ${
                        call.status === 'SCHEDULED'
                          ? 'rgba(99, 102, 241, 0.3)'
                          : call.status === 'ACTIVE'
                          ? 'rgba(16, 185, 129, 0.3)'
                          : 'rgba(100, 116, 139, 0.3)'
                      }`,
                    }}
                  >
                    {call.status}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                    fontSize: '12.5px',
                    color: '#94a3b8',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#cbd5e1' }}>
                    <Clock size={14} color="#818cf8" />
                    {new Date(call.scheduledStartTime).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span>•</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Globe size={13} color="#64748b" />
                    <span>{call.timezone || 'UTC'}</span>
                  </span>
                  {call.description && (
                    <>
                      <span>•</span>
                      <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>{call.description}</span>
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
                    padding: '9px 18px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 12px rgba(16, 185, 129, 0.35)',
                  }}
                >
                  <span>Join</span>
                  <ArrowUpRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleCancel(call.id, call.title)}
                  disabled={cancellingId === call.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '9px 14px',
                    backgroundColor: 'rgba(244, 63, 94, 0.1)',
                    color: '#fb7185',
                    border: '1px solid rgba(244, 63, 94, 0.25)',
                    borderRadius: '10px',
                    fontWeight: 600,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
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

      {/* Sassy Extra Premium Schedule Call Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="schedule-modal-title"
          className="glass-modal-backdrop"
          onClick={() => !isScheduling && setIsModalOpen(false)}
        >
          <div
            className="sassy-dialog"
            style={{
              width: '100%',
              maxWidth: '540px',
              padding: '30px',
              color: '#f8fafc',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '22px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    boxShadow: '0 0 16px rgba(99, 102, 241, 0.2)',
                  }}
                >
                  <CalendarDays size={22} color="#818cf8" />
                </div>
                <div>
                  <h3 id="schedule-modal-title" style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                    Schedule Conference
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#94a3b8' }}>
                    Calendar-synced, end-to-end encrypted audio & video session.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !isScheduling && setIsModalOpen(false)}
                disabled={isScheduling}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  color: '#94a3b8',
                  cursor: isScheduling ? 'not-allowed' : 'pointer',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 150ms ease',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Title Field */}
              <div className="sassy-form-group">
                <label className="sassy-label" htmlFor="scheduled-title">
                  <span className="sassy-label-left">
                    <Sparkles size={13} color="#818cf8" /> Conference Title
                  </span>
                  <span className="sassy-badge-required">Required</span>
                </label>
                <div className="sassy-input-wrap">
                  <span className="sassy-input-icon">
                    <Sparkles size={16} />
                  </span>
                  <input
                    id="scheduled-title"
                    type="text"
                    required
                    disabled={isScheduling}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Design Architecture Review"
                    className="sassy-input"
                  />
                </div>
              </div>

              {/* Conference Type Dropdown */}
              <div className="sassy-form-group">
                <label className="sassy-label" htmlFor="scheduled-call-type">
                  <span className="sassy-label-left">
                    <Video size={13} color="#22d3ee" /> Session Mode & Quality
                  </span>
                  <span className="sassy-badge-optional">Encrypted</span>
                </label>
                <div className="sassy-input-wrap">
                  <span className="sassy-input-icon">
                    <Video size={16} color="#22d3ee" />
                  </span>
                  <select
                    id="scheduled-call-type"
                    className="sassy-select"
                    value={callType}
                    onChange={(e) => setCallType(e.target.value)}
                    disabled={isScheduling}
                  >
                    <option value="HD_VIDEO">🎥 Encrypted HD Video & Screen Sharing</option>
                    <option value="AUDIO_ONLY">🎙️ Ultra-Low Latency Audio Room</option>
                    <option value="BROADCAST">📡 Broadcast / Keynote Presentation</option>
                  </select>
                </div>
              </div>

              {/* Date & Time Field with Quick Preset Chips */}
              <div className="sassy-form-group">
                <label className="sassy-label" htmlFor="scheduled-start-time">
                  <span className="sassy-label-left">
                    <Calendar size={13} color="#818cf8" /> Date & Time
                  </span>
                  <span className="sassy-badge-required">Required</span>
                </label>

                <div className="sassy-input-wrap">
                  <span className="sassy-input-icon">
                    <Calendar size={16} />
                  </span>
                  <input
                    id="scheduled-start-time"
                    type="datetime-local"
                    required
                    disabled={isScheduling}
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="sassy-date-field"
                  />
                </div>

                {/* Formatted live preview badge */}
                {formattedPreview && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      color: '#38bdf8',
                      marginTop: '2px',
                    }}
                  >
                    <CheckCircle2 size={13} />
                    <span>Scheduled for: <strong>{formattedPreview}</strong></span>
                  </div>
                )}

                {/* Quick Presets Chips */}
                <div className="sassy-chip-row">
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Quick:</span>
                  <button
                    type="button"
                    className="sassy-chip"
                    onClick={() => setQuickOffset(15)}
                    disabled={isScheduling}
                  >
                    +15 mins
                  </button>
                  <button
                    type="button"
                    className="sassy-chip"
                    onClick={() => setQuickOffset(60)}
                    disabled={isScheduling}
                  >
                    +1 hour
                  </button>
                  <button
                    type="button"
                    className="sassy-chip"
                    onClick={() => setDateTomorrowAt(10)}
                    disabled={isScheduling}
                  >
                    Tomorrow 10 AM
                  </button>
                  <button
                    type="button"
                    className="sassy-chip"
                    onClick={() => setDateNextMondayAt(14)}
                    disabled={isScheduling}
                  >
                    Next Mon 2 PM
                  </button>
                </div>
              </div>

              {/* Two Column Row: Timezone & Notification Reminder Dropdowns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {/* Timezone Dropdown */}
                <div className="sassy-form-group">
                  <label className="sassy-label" htmlFor="scheduled-timezone">
                    <span className="sassy-label-left">
                      <Globe size={13} color="#818cf8" /> Timezone
                    </span>
                  </label>
                  <div className="sassy-input-wrap">
                    <span className="sassy-input-icon">
                      <Globe size={15} />
                    </span>
                    <select
                      id="scheduled-timezone"
                      className="sassy-select"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      disabled={isScheduling}
                    >
                      <option value={Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'}>
                        {Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local (System)'}
                      </option>
                      <option value="UTC">UTC (Universal Standard)</option>
                      <option value="America/New_York">US Eastern (New York)</option>
                      <option value="America/Chicago">US Central (Chicago)</option>
                      <option value="America/Los_Angeles">US Pacific (San Francisco)</option>
                      <option value="Europe/London">UK / GMT (London)</option>
                      <option value="Europe/Paris">Central Europe (Paris/Berlin)</option>
                      <option value="Asia/Kolkata">India (IST • UTC+5:30)</option>
                      <option value="Asia/Singapore">Singapore / Hong Kong (SGT)</option>
                      <option value="Asia/Tokyo">Japan (JST • Tokyo)</option>
                    </select>
                  </div>
                </div>

                {/* Reminder Notification Dropdown */}
                <div className="sassy-form-group">
                  <label className="sassy-label" htmlFor="scheduled-reminder">
                    <span className="sassy-label-left">
                      <Bell size={13} color="#f59e0b" /> Reminder
                    </span>
                  </label>
                  <div className="sassy-input-wrap">
                    <span className="sassy-input-icon">
                      <Bell size={15} color="#f59e0b" />
                    </span>
                    <select
                      id="scheduled-reminder"
                      className="sassy-select"
                      value={reminderMinutes}
                      onChange={(e) => setReminderMinutes(Number(e.target.value))}
                      disabled={isScheduling}
                    >
                      <option value={5}>5 mins before</option>
                      <option value={15}>15 mins before (Recommended)</option>
                      <option value={30}>30 mins before</option>
                      <option value={60}>1 hour before</option>
                      <option value={1440}>1 day before</option>
                      <option value={0}>Do not remind</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Description / Agenda Textarea */}
              <div className="sassy-form-group">
                <label className="sassy-label">
                  <span className="sassy-label-left">
                    <AlignLeft size={13} color="#94a3b8" /> Agenda & Briefing
                  </span>
                  <span className="sassy-badge-optional">Optional</span>
                </label>
                <textarea
                  value={description}
                  disabled={isScheduling}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Meeting agenda items, briefing notes, or participant preparation details..."
                  className="sassy-textarea"
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isScheduling}
                  style={{
                    padding: '11px 20px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    color: '#cbd5e1',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    cursor: isScheduling ? 'not-allowed' : 'pointer',
                    transition: 'all 150ms ease',
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
                    padding: '11px 26px',
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '13.5px',
                    cursor: isScheduling ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 18px rgba(99, 102, 241, 0.45)',
                    opacity: isScheduling ? 0.7 : 1,
                    transition: 'all 150ms ease',
                  }}
                >
                  {isScheduling ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Scheduling Session...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>Schedule Conference</span>
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
