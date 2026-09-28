import React, { useState } from 'react';
import { GitFork, Plus, X } from 'lucide-react';
import { usePhoneNumbers, useInboundRoutingRules, useSetInboundRoutingRule } from '../hooks/use-telephony';
import { RoutingTargetType } from '../types';

export const RoutingRulesView: React.FC = () => {
  const { data: phoneNumbers } = usePhoneNumbers();
  const [selectedNumberId, setSelectedNumberId] = useState<string>('');
  const [isNewRuleOpen, setIsNewRuleOpen] = useState(false);

  // New rule state
  const [ruleName, setRuleName] = useState('');
  const [priority, setPriority] = useState(1);
  const [targetType, setTargetType] = useState<RoutingTargetType>('USER');
  const [targetId, setTargetId] = useState('');
  const [ringDuration, setRingDuration] = useState(25);
  const [businessHoursOnly, setBusinessHoursOnly] = useState(false);
  const [startHour, setStartHour] = useState('09:00');
  const [endHour, setEndHour] = useState('17:00');
  const [fallbackType, setFallbackType] = useState<RoutingTargetType>('VOICEMAIL');

  const { data: rules, isLoading } = useInboundRoutingRules(selectedNumberId);
  const setRuleMutation = useSetInboundRoutingRule();

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNumberId || !ruleName.trim()) return;

    await setRuleMutation.mutateAsync({
      phoneNumberId: selectedNumberId,
      name: ruleName.trim(),
      priority,
      targetType,
      targetId: targetId.trim() || 'default',
      ringDurationSeconds: ringDuration,
      businessHoursOnly,
      businessHoursStart: businessHoursOnly ? startHour : undefined,
      businessHoursEnd: businessHoursOnly ? endHour : undefined,
      timezone: 'UTC',
      fallbackTargetType: fallbackType,
    });

    setIsNewRuleOpen(false);
    setRuleName('');
    setTargetId('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitFork size={20} color="#818cf8" /> Inbound Call Routing Engine
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
            Configure deterministic, ordered routing policies, business hours, and automated fallback behavior for DIDs.
          </p>
        </div>

        {selectedNumberId && (
          <button
            type="button"
            onClick={() => setIsNewRuleOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              backgroundColor: '#4f46e5',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
            }}
          >
            <Plus size={16} />
            <span>Add Routing Rule</span>
          </button>
        )}
      </div>

      {/* Select DID */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 20px',
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '12px',
        }}
      >
        <label style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1', whiteSpace: 'nowrap' }}>
          Configure Inbound DID:
        </label>
        <select
          value={selectedNumberId}
          onChange={(e) => setSelectedNumberId(e.target.value)}
          style={{
            flex: 1,
            padding: '8px 12px',
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '8px',
            color: '#f8fafc',
            fontSize: '13px',
          }}
        >
          <option value="">-- Choose a Phone Number --</option>
          {phoneNumbers?.map((n) => (
            <option key={n.id} value={n.id}>
              {n.displayNumber} ({n.countryCode} {n.type}) - Status: {n.status}
            </option>
          ))}
        </select>
      </div>

      {/* Rules Table */}
      {selectedNumberId && (
        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          {isLoading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>Loading routing policies...</div>
          ) : !rules || rules.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontWeight: 600, color: '#f8fafc', fontSize: '15px' }}>
                No custom routing rules defined for this number
              </p>
              <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>
                Default fallback behavior will ring the directly assigned user or route to voicemail.
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#090d16', borderBottom: '1px solid #1e293b', color: '#64748b', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '12px 16px' }}>Priority</th>
                  <th style={{ padding: '12px 16px' }}>Rule Name</th>
                  <th style={{ padding: '12px 16px' }}>Target</th>
                  <th style={{ padding: '12px 16px' }}>Ring Time</th>
                  <th style={{ padding: '12px 16px' }}>Business Hours</th>
                  <th style={{ padding: '12px 16px' }}>Fallback</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#818cf8' }}>
                      #{rule.priority}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#f8fafc' }}>{rule.name}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                        {rule.targetType}: {rule.targetId}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{rule.ringDurationSeconds}s</td>
                    <td style={{ padding: '12px 16px' }}>
                      {rule.businessHoursOnly ? (
                        <span style={{ fontSize: '12px', color: '#34d399' }}>
                          {rule.businessHoursStart} - {rule.businessHoursEnd}
                        </span>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#64748b' }}>24/7 Always</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '12px' }}>
                      {rule.fallbackTargetType || 'VOICEMAIL'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* New Rule Modal */}
      {isNewRuleOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                Add Inbound Routing Policy
              </h3>
              <button
                type="button"
                onClick={() => setIsNewRuleOpen(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRule} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>
                  Rule Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Primary Support Line"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    boxSizing: 'border-box',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>
                    Target Type
                  </label>
                  <select
                    value={targetType}
                    onChange={(e) => setTargetType(e.target.value as RoutingTargetType)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '13px',
                    }}
                  >
                    <option value="USER">Direct User</option>
                    <option value="ROOM">Conference Room</option>
                    <option value="TEAM">Team Ring Group</option>
                    <option value="VOICEMAIL">Direct to Voicemail</option>
                    <option value="REJECT">Reject Call</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>
                    Target ID
                  </label>
                  <input
                    type="text"
                    placeholder="user_id or room_id"
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      boxSizing: 'border-box',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>
                    Priority
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={priority}
                    onChange={(e) => setPriority(parseInt(e.target.value) || 1)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      boxSizing: 'border-box',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '13px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>
                    Ring Duration (seconds)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={ringDuration}
                    onChange={(e) => setRingDuration(parseInt(e.target.value) || 25)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      boxSizing: 'border-box',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '13px',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="businessHoursOnly"
                  checked={businessHoursOnly}
                  onChange={(e) => setBusinessHoursOnly(e.target.checked)}
                />
                <label htmlFor="businessHoursOnly" style={{ fontSize: '13px', color: '#cbd5e1', cursor: 'pointer' }}>
                  Enable Business Hours Restriction
                </label>
              </div>

              {businessHoursOnly && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={startHour}
                      onChange={(e) => setStartHour(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        boxSizing: 'border-box',
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '13px',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>
                      End Time
                    </label>
                    <input
                      type="time"
                      value={endHour}
                      onChange={(e) => setEndHour(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        boxSizing: 'border-box',
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '13px',
                      }}
                    />
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>
                  Fallback on No-Answer
                </label>
                <select
                  value={fallbackType}
                  onChange={(e) => setFallbackType(e.target.value as RoutingTargetType)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '13px',
                  }}
                >
                  <option value="VOICEMAIL">Send to Voicemail</option>
                  <option value="REJECT">Disconnect / Busy Tone</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsNewRuleOpen(false)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#1e293b',
                    color: '#cbd5e1',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={setRuleMutation.isPending}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#4f46e5',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: setRuleMutation.isPending ? 'not-allowed' : 'pointer',
                  }}
                >
                  {setRuleMutation.isPending ? 'Saving...' : 'Save Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
