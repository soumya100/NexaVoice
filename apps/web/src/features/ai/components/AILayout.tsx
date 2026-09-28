import React, { useState } from 'react';
import { Bot, PhoneCall, Sparkles, Cpu } from 'lucide-react';
import { AgentListView } from './AgentListView';
import { AIAssistantCallView } from './AIAssistantCallView';
import { CallInsightsView } from './CallInsightsView';

export const AILayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'agents' | 'assistant' | 'insights'>('agents');

  const tabs = [
    { id: 'agents', label: 'AI Agents & Voice Personas', icon: Bot },
    { id: 'assistant', label: 'Live Call Assistant & Barge-In', icon: PhoneCall },
    { id: 'insights', label: 'Call Intelligence & Summaries', icon: Sparkles },
  ] as const;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
        backgroundColor: '#090d16',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          borderBottom: '1px solid #1e293b',
          backgroundColor: '#0f172a',
          padding: '16px 24px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
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
              <Cpu size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
                  AI Voice, Agents & Call Intelligence
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
                  Milestone 7
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Provider-agnostic AI calling layer with first-class AI participants, VAD barge-in, human handoff & post-call intelligence.
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div
            style={{
              display: 'flex',
              backgroundColor: '#1e293b',
              padding: '4px',
              borderRadius: '10px',
              border: '1px solid #334155',
            }}
          >
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
                    gap: '8px',
                    padding: '8px 14px',
                    borderRadius: '7px',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    backgroundColor: isActive ? '#6366f1' : 'transparent',
                    color: isActive ? '#ffffff' : '#94a3b8',
                  }}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, padding: '24px', maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
        {activeTab === 'agents' && <AgentListView />}
        {activeTab === 'assistant' && <AIAssistantCallView />}
        {activeTab === 'insights' && <CallInsightsView />}
      </div>
    </div>
  );
};
