import React, { useState } from 'react';
import { Bot, Plus, Layers, ShieldCheck, Play, Pause, Archive } from 'lucide-react';
import { useAIAgents, useUpdateAIAgentStatus } from '../hooks/use-ai';
import { AIAgent } from '../types';
import { AgentEditorModal } from './AgentEditorModal';

export const AgentListView: React.FC = () => {
  const { data: agents = [], isLoading, error } = useAIAgents();
  const updateStatusMutation = useUpdateAIAgentStatus();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAgentForVersion, setSelectedAgentForVersion] = useState<AIAgent | undefined>(
    undefined,
  );

  const handleOpenNewAgent = () => {
    setSelectedAgentForVersion(undefined);
    setIsModalOpen(true);
  };

  const handleOpenNewVersion = (agent: AIAgent) => {
    setSelectedAgentForVersion(agent);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (agent: AIAgent) => {
    const nextStatus = agent.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    await updateStatusMutation.mutateAsync({ agentId: agent.id, status: nextStatus });
  };

  const handleArchive = async (agent: AIAgent) => {
    if (window.confirm(`Archive agent "${agent.name}"? Archived agents cannot join new calls.`)) {
      await updateStatusMutation.mutateAsync({ agentId: agent.id, status: 'ARCHIVED' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner & Action */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#f8fafc' }}>
            AI Voice Agents Catalog
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
            Manage first-class AI participants, immutable prompts, authorized tools, and voice personalities.
          </p>
        </div>
        <button
          onClick={handleOpenNewAgent}
          style={{
            padding: '10px 18px',
            backgroundColor: '#6366f1',
            border: 'none',
            borderRadius: '8px',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
          }}
        >
          <Plus size={16} />
          Create Voice Agent
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
          Loading AI agents...
        </div>
      ) : error ? (
        <div
          style={{
            padding: '16px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '8px',
            color: '#f87171',
          }}
        >
          Failed to load AI agents.
        </div>
      ) : agents.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '64px 20px',
            backgroundColor: '#0f172a',
            border: '1px dashed #334155',
            borderRadius: '16px',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#818cf8',
              margin: '0 auto 16px',
            }}
          >
            <Bot size={28} />
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 600, color: '#f8fafc' }}>
            No AI Agents Configured
          </h3>
          <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#94a3b8', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
            Create your first AI voice agent to participate in live calls, screen inbound callers, and run automated support.
          </p>
          <button
            onClick={handleOpenNewAgent}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6366f1',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Configure First Agent
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {agents.map((agent) => {
            const isActive = agent.status === 'ACTIVE';
            const isArchived = agent.status === 'ARCHIVED';

            return (
              <div
                key={agent.id}
                style={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #1e293b',
                  borderRadius: '14px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
                }}
              >
                {/* Agent Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        backgroundColor: isActive
                          ? 'rgba(16, 185, 129, 0.15)'
                          : 'rgba(148, 163, 184, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isActive ? '#10b981' : '#94a3b8',
                      }}
                    >
                      <Bot size={22} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>
                        {agent.name}
                      </h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            backgroundColor: isActive
                              ? 'rgba(16, 185, 129, 0.15)'
                              : isArchived
                              ? 'rgba(239, 68, 68, 0.15)'
                              : 'rgba(245, 158, 11, 0.15)',
                            color: isActive
                              ? '#34d399'
                              : isArchived
                              ? '#f87171'
                              : '#fbbf24',
                          }}
                        >
                          {agent.status}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            color: '#818cf8',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <Layers size={12} />
                          {agent.activeVersionId ? 'Active v1' : 'Draft'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: 1.5, minHeight: '38px' }}>
                  {agent.description || 'General conversational AI assistant for customer calls.'}
                </p>

                {/* Features & Security Tag */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(99, 102, 241, 0.1)',
                      color: '#a5b4fc',
                    }}
                  >
                    Barge-in VAD
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(99, 102, 241, 0.1)',
                      color: '#a5b4fc',
                    }}
                  >
                    Tool Execution
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      color: '#6ee7b7',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <ShieldCheck size={12} />
                    Prompt Guard
                  </span>
                </div>

                {/* Actions */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '12px',
                    borderTop: '1px solid #1e293b',
                  }}
                >
                  <button
                    onClick={() => handleOpenNewVersion(agent)}
                    disabled={isArchived}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: isArchived ? '#64748b' : '#cbd5e1',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: isArchived ? 'not-allowed' : 'pointer',
                    }}
                  >
                    New Version
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {!isArchived && (
                      <button
                        onClick={() => handleToggleStatus(agent)}
                        title={isActive ? 'Disable agent' : 'Activate agent'}
                        style={{
                          padding: '6px 10px',
                          backgroundColor: 'transparent',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          color: isActive ? '#fbbf24' : '#34d399',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '12px',
                        }}
                      >
                        {isActive ? <Pause size={14} /> : <Play size={14} />}
                        {isActive ? 'Pause' : 'Resume'}
                      </button>
                    )}

                    {!isArchived && (
                      <button
                        onClick={() => handleArchive(agent)}
                        title="Archive agent"
                        style={{
                          padding: '6px',
                          backgroundColor: 'transparent',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          color: '#f87171',
                          cursor: 'pointer',
                        }}
                      >
                        <Archive size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor / Versioning Modal */}
      <AgentEditorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        existingAgent={selectedAgentForVersion}
      />
    </div>
  );
};
