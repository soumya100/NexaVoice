import React, { useState } from 'react';
import { Phone, Hash, Inbox, GitFork, Radio } from 'lucide-react';
import { TelephonyDialer } from './TelephonyDialer';
import { PhoneNumberListView } from './PhoneNumberListView';
import { VoicemailListView } from './VoicemailListView';
import { RoutingRulesView } from './RoutingRulesView';

export const TelephonyLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dialer' | 'numbers' | 'voicemail' | 'routing'>('dialer');

  const tabs = [
    { id: 'dialer', label: 'PSTN Dialer', icon: Phone },
    { id: 'numbers', label: 'Phone Numbers', icon: Hash },
    { id: 'voicemail', label: 'Voicemail', icon: Inbox },
    { id: 'routing', label: 'Call Routing', icon: GitFork },
  ] as const;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', backgroundColor: '#090d16' }}>
      {/* Top Header */}
      <div
        style={{
          borderBottom: '1px solid #1e293b',
          backgroundColor: '#0f172a',
          padding: '16px 24px',
          flexShrink: 0,
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8',
              }}
            >
              <Radio size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
                  Telephony & PSTN Infrastructure
                </h1>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    color: '#818cf8',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                  }}
                >
                  Carrier Gateway
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Unified PSTN & SIP calling, provisioned DIDs, voicemails, and carrier event reconciliation
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#090d16', padding: '4px', borderRadius: '10px', border: '1px solid #1e293b' }}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    backgroundColor: isActive ? '#4f46e5' : 'transparent',
                    color: isActive ? '#ffffff' : '#94a3b8',
                  }}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content Body */}
      <div style={{ flex: 1, padding: '24px', maxWidth: '1100px', width: '100%', margin: '0 auto' }}>
        {activeTab === 'dialer' && <TelephonyDialer />}
        {activeTab === 'numbers' && <PhoneNumberListView />}
        {activeTab === 'voicemail' && <VoicemailListView />}
        {activeTab === 'routing' && <RoutingRulesView />}
      </div>
    </div>
  );
};
