import React, { useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Pause, Play, AlertTriangle, Delete, PhoneCall } from 'lucide-react';
import { useInitiatePstnCall, useSendDtmf, usePhoneNumbers } from '../hooks/use-telephony';
import { toastService } from '../../../services/toast';

export const TelephonyDialer: React.FC = () => {
  const [destination, setDestination] = useState('');
  const [selectedCallerId, setSelectedCallerId] = useState('');
  const [activeCallSessionId, setActiveCallSessionId] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<string>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: phoneNumbers } = usePhoneNumbers('ACTIVE');
  const initiateCallMutation = useInitiatePstnCall();
  const sendDtmfMutation = useSendDtmf();

  const activeNumbers = phoneNumbers?.filter((n) => n.status === 'ACTIVE' || n.status === 'ASSIGNED') ?? [];

  const handleDigitPress = (digit: string) => {
    setErrorMsg(null);
    if (activeCallSessionId) {
      sendDtmfMutation.mutate({ callSessionId: activeCallSessionId, digits: digit });
    } else {
      setDestination((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    setDestination((prev) => prev.slice(0, -1));
  };

  const handleInitiateCall = async () => {
    const rawDest = destination.trim();
    if (!rawDest) return;
    setErrorMsg(null);
    setCallStatus('initiating');
    toastService.info(`Dialing ${rawDest}...`);

    try {
      const res = await initiateCallMutation.mutateAsync({
        to: rawDest,
        callerId: selectedCallerId || undefined,
      });
      setActiveCallSessionId(res.callId);
      setCallStatus('ringing');
      toastService.success(`PSTN call initiated to ${res.destinationNumber || rawDest}!`);
    } catch (err: any) {
      setCallStatus('idle');
      const friendlyErr = err?.message || 'Call initiation failed. Please verify destination number.';
      setErrorMsg(friendlyErr);
      toastService.error(friendlyErr);
    }
  };

  const handleHangup = () => {
    setActiveCallSessionId(null);
    setCallStatus('idle');
    setIsMuted(false);
    setIsOnHold(false);
    toastService.info('Call ended.');
  };

  const keypad = [
    { digit: '1', sub: '—' },
    { digit: '2', sub: 'ABC' },
    { digit: '3', sub: 'DEF' },
    { digit: '4', sub: 'GHI' },
    { digit: '5', sub: 'JKL' },
    { digit: '6', sub: 'MNO' },
    { digit: '7', sub: 'PQRS' },
    { digit: '8', sub: 'TUV' },
    { digit: '9', sub: 'WXYZ' },
    { digit: '*', sub: 'TONE' },
    { digit: '0', sub: '+' },
    { digit: '#', sub: 'HASH' },
  ];

  return (
    <div
      style={{
        maxWidth: '420px',
        margin: '20px auto',
        backgroundColor: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* Dialer Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Phone size={18} color="#818cf8" /> PSTN Phone Dialer
        </h2>
        {activeCallSessionId ? (
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            Call Active ({callStatus})
          </span>
        ) : (
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: '#1e293b',
              color: '#94a3b8',
              border: '1px solid #334155',
            }}
          >
            Ready
          </span>
        )}
      </div>

      {/* Emergency Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          padding: '10px 12px',
          borderRadius: '8px',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          color: '#fbbf24',
          fontSize: '11px',
          lineHeight: '1.4',
          marginBottom: '16px',
        }}
      >
        <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
        <span>
          Emergency calls (911/112/999) require certified PSAP carrier routing. Use local telecom devices for emergency dispatch.
        </span>
      </div>

      {/* Outbound Caller ID Selector */}
      <div className="sassy-form-group" style={{ marginBottom: '18px' }}>
        <label className="sassy-label">
          <span className="sassy-label-left">
            <PhoneCall size={13} color="#818cf8" /> Outbound Caller ID
          </span>
          <span className="sassy-badge-optional">E.164 Verified</span>
        </label>
        <div className="sassy-input-wrap">
          <span className="sassy-input-icon">
            <PhoneCall size={15} color="#818cf8" />
          </span>
          <select
            value={selectedCallerId}
            onChange={(e) => setSelectedCallerId(e.target.value)}
            disabled={Boolean(activeCallSessionId)}
            className="sassy-select"
          >
            <option value="">Default Organization DID (+1 800-NEXAVOICE)</option>
            {activeNumbers.map((num) => (
              <option key={num.id} value={num.e164Number}>
                {num.displayNumber} ({num.countryCode} {num.type})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Destination Phone Number Display */}
      <div style={{ position: 'relative', marginBottom: '22px' }}>
        <input
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="+1 (555) 000-0000"
          disabled={Boolean(activeCallSessionId)}
          className="sassy-input"
          style={{
            padding: '14px 44px 14px 16px',
            fontFamily: 'var(--nv-font-mono, monospace)',
            fontSize: '22px',
            fontWeight: 700,
            textAlign: 'center',
            letterSpacing: '2px',
            color: '#a5b4fc',
            background: 'rgba(9, 13, 22, 0.85)',
            borderColor: destination ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255, 255, 255, 0.1)',
            boxShadow: destination
              ? '0 0 16px rgba(99, 102, 241, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
              : 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          }}
          aria-label="Destination Telephone Number"
        />
        {destination && !activeCallSessionId && (
          <button
            type="button"
            onClick={handleBackspace}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Backspace"
            aria-label="Backspace"
          >
            <Delete size={18} />
          </button>
        )}
      </div>

      {errorMsg && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            fontSize: '12px',
            textAlign: 'center',
            marginBottom: '14px',
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* DTMF Keypad Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          marginBottom: '20px',
        }}
      >
        {keypad.map((k) => (
          <button
            key={k.digit}
            type="button"
            onClick={() => handleDigitPress(k.digit)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 0',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            aria-label={`Key ${k.digit}`}
          >
            <span style={{ fontSize: '20px', fontWeight: 600, color: '#f8fafc', lineHeight: 1 }}>{k.digit}</span>
            <span style={{ fontSize: '9px', fontWeight: 500, color: '#64748b', marginTop: '3px', letterSpacing: '1px' }}>
              {k.sub}
            </span>
          </button>
        ))}
      </div>

      {/* Action Controls */}
      <div>
        {!activeCallSessionId ? (
          <button
            type="button"
            onClick={handleInitiateCall}
            disabled={!destination.trim() || initiateCallMutation.isPending}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: !destination.trim() || initiateCallMutation.isPending ? '#334155' : '#059669',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: !destination.trim() || initiateCallMutation.isPending ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
            }}
            aria-label="Initiate Outbound Call"
          >
            <Phone size={18} />
            <span>{initiateCallMutation.isPending ? 'Connecting...' : 'Call PSTN'}</span>
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: isMuted ? 'rgba(245, 158, 11, 0.4)' : '#334155',
                backgroundColor: isMuted ? 'rgba(245, 158, 11, 0.2)' : '#1e293b',
                color: isMuted ? '#fbbf24' : '#f8fafc',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
              <span>{isMuted ? 'Muted' : 'Mute'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsOnHold(!isOnHold)}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: isOnHold ? 'rgba(245, 158, 11, 0.4)' : '#334155',
                backgroundColor: isOnHold ? 'rgba(245, 158, 11, 0.2)' : '#1e293b',
                color: isOnHold ? '#fbbf24' : '#f8fafc',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              {isOnHold ? <Play size={14} /> : <Pause size={14} />}
              <span>{isOnHold ? 'On Hold' : 'Hold'}</span>
            </button>
            <button
              type="button"
              onClick={handleHangup}
              style={{
                flex: 1.2,
                padding: '10px',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
              }}
              aria-label="Hang up call"
            >
              <PhoneOff size={14} />
              <span>End Call</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
