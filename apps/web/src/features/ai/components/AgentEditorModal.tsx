import React, { useState } from 'react';
import { X, Bot, Shield, Wrench, Sparkles } from 'lucide-react';
import { useCreateAIAgent, useCreateAIAgentVersion } from '../hooks/use-ai';
import { AIAgent } from '../types';

interface AgentEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingAgent?: AIAgent;
}

const AVAILABLE_TOOLS = [
  { id: 'lookupCustomer', label: 'Lookup Customer Profile', desc: 'Query contact info & account tier' },
  { id: 'scheduleFollowUp', label: 'Schedule Follow-Up', desc: 'Book consultation slots on calendar' },
  { id: 'checkAvailability', label: 'Check Availability', desc: 'Check representative opening hours' },
  { id: 'transferToHuman', label: 'Transfer To Human Specialist', desc: 'Escalate call to agent queue' },
];

export const AgentEditorModal: React.FC<AgentEditorModalProps> = ({
  isOpen,
  onClose,
  existingAgent,
}) => {
  const [name, setName] = useState(existingAgent?.name || '');
  const [description, setDescription] = useState(existingAgent?.description || '');
  const [systemPrompt, setSystemPrompt] = useState(
    'You are a professional, helpful NexaVoice AI Voice Assistant. Speak concisely and clarify customer questions.',
  );
  const [model, setModel] = useState('gpt-4o');
  const [voiceId, setVoiceId] = useState('alloy');
  const [selectedTools, setSelectedTools] = useState<string[]>([
    'lookupCustomer',
    'transferToHuman',
  ]);
  const [errorMsg, setErrorMsg] = useState('');

  const createAgentMutation = useCreateAIAgent();
  const createVersionMutation = useCreateAIAgentVersion();

  if (!isOpen) return null;

  const toggleTool = (toolId: string) => {
    setSelectedTools((prev) =>
      prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Agent name is required');
      return;
    }
    if (!systemPrompt.trim()) {
      setErrorMsg('System prompt instructions are required');
      return;
    }

    try {
      if (existingAgent) {
        // Create new immutable version for existing agent
        await createVersionMutation.mutateAsync({
          agentId: existingAgent.id,
          systemPrompt,
          model,
          voiceId,
          tools: selectedTools,
        });
      } else {
        // Create fresh agent + Version 1
        await createAgentMutation.mutateAsync({
          name,
          description,
          systemPrompt,
          model,
          voiceId,
          tools: selectedTools,
        });
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save agent');
    }
  };

  const isPending = createAgentMutation.isPending || createVersionMutation.isPending;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '650px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8',
              }}
            >
              <Bot size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#f8fafc' }}>
                {existingAgent ? `New Version for ${existingAgent.name}` : 'Create AI Voice Agent'}
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                {existingAgent
                  ? 'Existing calls will retain their starting version'
                  : 'Configure identity, immutable versioning, tools, and voice settings'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}
        >
          {errorMsg && (
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#f87171',
                fontSize: '13px',
              }}
            >
              {errorMsg}
            </div>
          )}

          {!existingAgent && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
                  Agent Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Customer Inbound Support Specialist"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Inbound customer inquiry and account lookup assistant"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '14px',
                  }}
                />
              </div>
            </>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
              System Prompt Instructions (Immutable per Version)
            </label>
            <textarea
              rows={4}
              placeholder="Define agent personality, dialogue constraints, and response rules..."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '13px',
                fontFamily: 'monospace',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
                Foundation Model
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '14px',
                }}
              >
                <option value="gpt-4o">OpenAI GPT-4o (Realtime capable)</option>
                <option value="gpt-4o-mini">OpenAI GPT-4o Mini (Fast)</option>
                <option value="claude-3-5-sonnet-20241022">Anthropic Claude 3.5 Sonnet</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
                Voice Persona (TTS)
              </label>
              <select
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '14px',
                }}
              >
                <option value="alloy">Alloy (Balanced, Neutral)</option>
                <option value="echo">Echo (Warm, Conversational)</option>
                <option value="shimmer">Shimmer (Clear, Professional)</option>
                <option value="onyx">Onyx (Deep, Authoritative)</option>
              </select>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Wrench size={16} color="#818cf8" />
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1' }}>
                Authorized Tools (Strict Schema Allowlist)
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {AVAILABLE_TOOLS.map((t) => {
                const checked = selectedTools.includes(t.id);
                return (
                  <div
                    key={t.id}
                    onClick={() => toggleTool(t.id)}
                    style={{
                      padding: '10px 14px',
                      backgroundColor: checked ? 'rgba(99, 102, 241, 0.12)' : '#1e293b',
                      border: `1px solid ${checked ? '#6366f1' : '#334155'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: checked ? '#a5b4fc' : '#e2e8f0' }}>
                        {t.label}
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {}}
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>{t.desc}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <Shield size={18} color="#10b981" />
            <div style={{ fontSize: '12px', color: '#6ee7b7' }}>
              <strong>AI Safety Boundary Active:</strong> Caller dialogue is isolated with prompt-injection defenses. Secrets and authentication tokens are automatically sanitized before LLM context ingestion.
            </div>
          </div>

          {/* Footer Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              paddingTop: '16px',
              borderTop: '1px solid #1e293b',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 18px',
                backgroundColor: 'transparent',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#cbd5e1',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6366f1',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: isPending ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Sparkles size={16} />
              {isPending ? 'Saving...' : existingAgent ? 'Create Version' : 'Create Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
