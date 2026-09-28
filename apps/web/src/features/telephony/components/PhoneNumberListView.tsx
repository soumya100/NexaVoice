import React, { useState } from 'react';
import { Hash, Plus, X } from 'lucide-react';
import {
  usePhoneNumbers,
  useAvailableNumbers,
  useProvisionNumber,
  useAssignNumber,
  useUnassignNumber,
  useReleaseNumber,
} from '../hooks/use-telephony';
import { PhoneNumberGql, PhoneNumberType, PhoneNumberAssignmentType } from '../types';

export const PhoneNumberListView: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<PhoneNumberGql | null>(null);

  // Provisioning form state
  const [provCountry, setProvCountry] = useState('US');
  const [provType, setProvType] = useState<PhoneNumberType>('LOCAL');
  const [provPattern, setProvPattern] = useState('');

  // Assignment form state
  const [assignType, setAssignType] = useState<PhoneNumberAssignmentType>('USER');
  const [assignTargetId, setAssignTargetId] = useState('');

  const { data: phoneNumbers, isLoading, error } = usePhoneNumbers(statusFilter === 'all' ? undefined : statusFilter);
  const { data: availableNumbers } = useAvailableNumbers(provCountry, provType);

  const provisionMutation = useProvisionNumber();
  const assignMutation = useAssignNumber();
  const unassignMutation = useUnassignNumber();
  const releaseMutation = useReleaseNumber();

  const handleProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await provisionMutation.mutateAsync({
      country: provCountry,
      type: provType,
      pattern: provPattern || undefined,
    });
    setIsProvisionOpen(false);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNumber || !assignTargetId.trim()) return;
    await assignMutation.mutateAsync({
      numberId: selectedNumber.id,
      assignedToType: assignType,
      assignedId: assignTargetId.trim(),
    });
    setIsAssignOpen(false);
    setSelectedNumber(null);
  };

  const handleRelease = async (num: PhoneNumberGql) => {
    if (window.confirm(`Are you sure you want to release ${num.displayNumber}? Active calls will be blocked.`)) {
      await releaseMutation.mutateAsync(num.id);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Hash size={20} color="#818cf8" /> DID Phone Number Inventory
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
            Manage carrier phone numbers, assign DIDs to users or conference rooms, and configure inbound routes.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '13px',
            }}
          >
            <option value="all">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="RELEASED">Released</option>
          </select>

          <button
            type="button"
            onClick={() => setIsProvisionOpen(true)}
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
            <span>Provision Number</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        {isLoading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>Loading phone number inventory...</div>
        ) : error ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#f87171' }}>Failed to load numbers: {String(error)}</div>
        ) : !phoneNumbers || phoneNumbers.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <Hash size={40} color="#334155" style={{ margin: '0 auto 12px' }} />
            <p style={{ margin: 0, fontWeight: 600, color: '#f8fafc', fontSize: '15px' }}>No phone numbers provisioned yet</p>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>
              Provision your first DID from carrier adapters to start accepting calls.
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#090d16', borderBottom: '1px solid #1e293b', color: '#64748b', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' }}>
                <th style={{ padding: '12px 16px' }}>Number</th>
                <th style={{ padding: '12px 16px' }}>Country & Type</th>
                <th style={{ padding: '12px 16px' }}>Provider</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Assigned To</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {phoneNumbers.map((num) => (
                <tr key={num.id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600, color: '#f8fafc' }}>
                    {num.displayNumber}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: '9999px', fontSize: '11px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#cbd5e1' }}>
                      {num.countryCode} • {num.type}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8', textTransform: 'capitalize' }}>{num.provider}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor:
                          num.status === 'ASSIGNED'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : num.status === 'ACTIVE'
                            ? 'rgba(99, 102, 241, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
                        color:
                          num.status === 'ASSIGNED'
                            ? '#34d399'
                            : num.status === 'ACTIVE'
                            ? '#818cf8'
                            : '#f87171',
                        border: '1px solid currentColor',
                      }}
                    >
                      {num.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8' }}>
                    {num.assignedId ? (
                      <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#a5b4fc' }}>
                        {num.assignedToType}: {num.assignedId}
                      </span>
                    ) : (
                      <span style={{ color: '#475569', fontStyle: 'italic' }}>Unassigned Pool</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      {num.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedNumber(num);
                            setIsAssignOpen(true);
                          }}
                          style={{
                            padding: '4px 10px',
                            backgroundColor: 'rgba(99, 102, 241, 0.2)',
                            color: '#a5b4fc',
                            border: '1px solid rgba(99, 102, 241, 0.4)',
                            borderRadius: '6px',
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                        >
                          Assign
                        </button>
                      )}
                      {num.status === 'ASSIGNED' && (
                        <button
                          type="button"
                          onClick={() => unassignMutation.mutate(num.id)}
                          style={{
                            padding: '4px 10px',
                            backgroundColor: '#1e293b',
                            color: '#cbd5e1',
                            border: '1px solid #334155',
                            borderRadius: '6px',
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                        >
                          Unassign
                        </button>
                      )}
                      {num.status !== 'RELEASED' && (
                        <button
                          type="button"
                          onClick={() => handleRelease(num)}
                          style={{
                            padding: '4px 10px',
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '6px',
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                        >
                          Release
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Provision Modal */}
      {isProvisionOpen && (
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
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                Provision New Phone Number
              </h3>
              <button
                type="button"
                onClick={() => setIsProvisionOpen(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleProvisionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>
                  Country
                </label>
                <select
                  value={provCountry}
                  onChange={(e) => setProvCountry(e.target.value)}
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
                  <option value="US">United States (+1)</option>
                  <option value="GB">United Kingdom (+44)</option>
                  <option value="CA">Canada (+1)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>
                  Number Type
                </label>
                <select
                  value={provType}
                  onChange={(e) => setProvType(e.target.value as PhoneNumberType)}
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
                  <option value="LOCAL">Local / Geographic</option>
                  <option value="TOLL_FREE">Toll Free</option>
                  <option value="MOBILE">Mobile</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>
                  Pattern Filter (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 415"
                  value={provPattern}
                  onChange={(e) => setProvPattern(e.target.value)}
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

              {availableNumbers && availableNumbers.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>
                    Available Carrier Sample DIDs
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '8px', backgroundColor: '#090d16', borderRadius: '6px', border: '1px solid #1e293b', fontSize: '12px', fontFamily: 'monospace', color: '#34d399' }}>
                    {availableNumbers.slice(0, 3).map((d) => (
                      <span key={d} style={{ padding: '2px 6px', backgroundColor: '#1e293b', borderRadius: '4px' }}>
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsProvisionOpen(false)}
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
                  disabled={provisionMutation.isPending}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#4f46e5',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: provisionMutation.isPending ? 'not-allowed' : 'pointer',
                  }}
                >
                  {provisionMutation.isPending ? 'Ordering...' : 'Confirm Provisioning'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {isAssignOpen && selectedNumber && (
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
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                Assign {selectedNumber.displayNumber}
              </h3>
              <button
                type="button"
                onClick={() => setIsAssignOpen(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>
                  Target Type
                </label>
                <select
                  value={assignType}
                  onChange={(e) => setAssignType(e.target.value as PhoneNumberAssignmentType)}
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
                  <option value="ORGANIZATION">Organization Root</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>
                  Target ID (User ID or Room ID)
                </label>
                <input
                  type="text"
                  placeholder="e.g. user_abc123 or room_xyz789"
                  value={assignTargetId}
                  onChange={(e) => setAssignTargetId(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    boxSizing: 'border-box',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsAssignOpen(false)}
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
                  disabled={assignMutation.isPending}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#4f46e5',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: assignMutation.isPending ? 'not-allowed' : 'pointer',
                  }}
                >
                  {assignMutation.isPending ? 'Saving...' : 'Save Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
