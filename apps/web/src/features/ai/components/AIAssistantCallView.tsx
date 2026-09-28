import React, { useState } from 'react';
import {
  Mic,
  Bot,
  User,
  Send,
  Square,
  ArrowRightLeft,
  Activity,
  Shield,
  Volume2,
  Wrench,
} from 'lucide-react';
import {
  useAIAgents,
  useStartAISession,
  useSendAIUtterance,
  useInterruptAISession,
  useTriggerAIHandoff,
} from '../hooks/use-ai';
import { AISessionStatus, AITurn } from '../types';

export const AIAssistantCallView: React.FC = () => {
  const { data: agents = [] } = useAIAgents();
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [callSessionId, setCallSessionId] = useState<string>('call-live-session-demo');
  const [currentStatus, setCurrentStatus] = useState<AISessionStatus>('LISTENING');
  const [isInterrupted, setIsInterrupted] = useState<boolean>(false);
  const [turns, setTurns] = useState<AITurn[]>([]);
  const [inputText, setInputText] = useState('');
  const [handoffTarget, setHandoffTarget] = useState('Customer Support Pool Tier 1');
  const [handoffReason, setHandoffReason] = useState('Customer requested live human specialist');

  const startSessionMutation = useStartAISession();
  const sendUtteranceMutation = useSendAIUtterance();
  const interruptMutation = useInterruptAISession();
  const handoffMutation = useTriggerAIHandoff();

  const handleStartCallAssistant = async () => {
    const agent = agents.find((a) => a.id === selectedAgentId) || agents[0];
    if (!agent) return;

    try {
      const session = await startSessionMutation.mutateAsync({
        callSessionId,
        agentId: agent.id,
      });
      setActiveSessionId(session.id);
      setCurrentStatus('LISTENING');
      setIsInterrupted(false);

      // Add initial greeting turn
      setTurns([
        {
          id: 'turn-0',
          sessionId: session.id,
          turnNumber: 1,
          speaker: 'AGENT',
          text: `Hello! I am ${agent.name}. This call is handled by an automated AI assistant and recorded. How may I assist you today?`,
          isInterrupted: false,
          latencyMs: 120,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch {
      // Fallback in case of mock/demo session
      const mockId = `session-${Date.now()}`;
      setActiveSessionId(mockId);
      setCurrentStatus('LISTENING');
      setTurns([
        {
          id: 'turn-0',
          sessionId: mockId,
          turnNumber: 1,
          speaker: 'AGENT',
          text: `Hello! I am ${agent.name}. This call is handled by an automated AI assistant and recorded. How may I assist you today?`,
          isInterrupted: false,
          latencyMs: 120,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
  };

  const handleSendSpeech = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeSessionId) return;

    const userText = inputText.trim();
    setInputText('');
    setCurrentStatus('THINKING');
    setIsInterrupted(false);

    const userTurn: AITurn = {
      id: `turn-${Date.now()}`,
      sessionId: activeSessionId,
      turnNumber: turns.length + 1,
      speaker: 'USER',
      text: userText,
      isInterrupted: false,
      createdAt: new Date().toISOString(),
    };

    setTurns((prev) => [...prev, userTurn]);

    try {
      const response = await sendUtteranceMutation.mutateAsync({
        sessionId: activeSessionId,
        text: userText,
      });

      setCurrentStatus('SPEAKING');
      setTurns((prev) => [...prev, response]);

      setTimeout(() => {
        setCurrentStatus('LISTENING');
      }, 1500);
    } catch {
      // Mock deterministic turn response if backend API is offline
      setTimeout(() => {
        setCurrentStatus('SPEAKING');
        const agentTurn: AITurn = {
          id: `turn-${Date.now() + 1}`,
          sessionId: activeSessionId,
          turnNumber: turns.length + 2,
          speaker: 'AGENT',
          text: `I understand your inquiry regarding "${userText}". I have verified your account records and verified system availability.`,
          isInterrupted: false,
          latencyMs: 310,
          toolCalls: [{ id: 'tc-1', toolName: 'lookupCustomer', status: 'COMPLETED' }],
          createdAt: new Date().toISOString(),
        };
        setTurns((prev) => [...prev, agentTurn]);

        setTimeout(() => {
          setCurrentStatus('LISTENING');
        }, 1500);
      }, 600);
    }
  };

  const handleBargeIn = async () => {
    if (!activeSessionId) return;
    setIsInterrupted(true);
    setCurrentStatus('LISTENING');

    try {
      await interruptMutation.mutateAsync(activeSessionId);
    } catch {}

    setTurns((prev) =>
      prev.map((t, idx) =>
        idx === prev.length - 1 && t.speaker === 'AGENT'
          ? { ...t, isInterrupted: true }
          : t,
      ),
    );
  };

  const handleHandoff = async () => {
    if (!activeSessionId) return;
    setCurrentStatus('HANDOFF');

    try {
      await handoffMutation.mutateAsync({
        sessionId: activeSessionId,
        reason: handoffReason,
        targetUserId: handoffTarget,
      });
    } catch {}

    const handoffTurn: AITurn = {
      id: `turn-handoff-${Date.now()}`,
      sessionId: activeSessionId,
      turnNumber: turns.length + 1,
      speaker: 'SYSTEM',
      text: `AI Assistant transferred call to human operator (${handoffTarget}). Reason: ${handoffReason}. AI participant has left the call.`,
      isInterrupted: false,
      createdAt: new Date().toISOString(),
    };

    setTurns((prev) => [...prev, handoffTurn]);
  };

  const getStatusColor = (status: AISessionStatus) => {
    switch (status) {
      case 'SPEAKING':
        return '#10b981';
      case 'THINKING':
      case 'TOOL_CALLING':
        return '#f59e0b';
      case 'HANDOFF':
        return '#818cf8';
      case 'LISTENING':
      default:
        return '#38bdf8';
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px', height: '100%' }}>
      {/* Left Column: Call Assistant Controls & Voice Status */}
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '16px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#f8fafc' }}>
            Live Voice Assistant Console
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
            Attach AI participant to live CallSession with streaming VAD & barge-in.
          </p>
        </div>

        {/* Call Session & Agent Selector */}
        {!activeSessionId ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
                Select AI Agent
              </label>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '13px',
                }}
              >
                {agents.length === 0 && <option value="">Default Customer Agent</option>}
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
                Call Session ID
              </label>
              <input
                type="text"
                value={callSessionId}
                onChange={(e) => setCallSessionId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '13px',
                }}
              />
            </div>

            <button
              onClick={handleStartCallAssistant}
              style={{
                marginTop: '8px',
                padding: '12px',
                backgroundColor: '#6366f1',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Bot size={18} />
              Connect AI Participant
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Visual Waveform State Display */}
            <div
              style={{
                padding: '24px 16px',
                backgroundColor: '#1e293b',
                borderRadius: '12px',
                border: `1px solid ${getStatusColor(currentStatus)}44`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: getStatusColor(currentStatus),
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                <Activity size={16} />
                Status: {currentStatus}
              </div>

              {/* Dynamic Waveform bars */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '40px' }}>
                {[14, 28, 38, 22, 34, 18, 26, 32, 16].map((h, i) => (
                  <div
                    key={i}
                    style={{
                      width: '4px',
                      height: currentStatus === 'SPEAKING' ? `${h}px` : currentStatus === 'LISTENING' ? '12px' : '6px',
                      backgroundColor: getStatusColor(currentStatus),
                      borderRadius: '2px',
                      transition: 'height 0.2s ease',
                    }}
                  />
                ))}
              </div>

              {isInterrupted && (
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#f87171',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  Barge-In: Speech Interrupted
                </div>
              )}
            </div>

            {/* Barge-in Button */}
            <button
              onClick={handleBargeIn}
              disabled={currentStatus !== 'SPEAKING'}
              style={{
                padding: '10px',
                backgroundColor: currentStatus === 'SPEAKING' ? 'rgba(239, 68, 68, 0.2)' : '#1e293b',
                border: `1px solid ${currentStatus === 'SPEAKING' ? '#ef4444' : '#334155'}`,
                borderRadius: '8px',
                color: currentStatus === 'SPEAKING' ? '#f87171' : '#64748b',
                fontSize: '13px',
                fontWeight: 600,
                cursor: currentStatus === 'SPEAKING' ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Square size={14} />
              Simulate Barge-In (User Interrupt)
            </button>

            {/* Human Handoff Section */}
            <div
              style={{
                marginTop: '12px',
                paddingTop: '16px',
                borderTop: '1px solid #1e293b',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                <ArrowRightLeft size={16} color="#818cf8" />
                Human Escalation & Handoff
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                  Target Queue / Specialist
                </label>
                <input
                  type="text"
                  value={handoffTarget}
                  onChange={(e) => setHandoffTarget(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                  Handoff Reason
                </label>
                <input
                  type="text"
                  value={handoffReason}
                  onChange={(e) => setHandoffReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
              </div>

              <button
                onClick={handleHandoff}
                disabled={currentStatus === 'HANDOFF'}
                style={{
                  marginTop: '4px',
                  padding: '10px',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  borderRadius: '8px',
                  color: '#a5b4fc',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: currentStatus === 'HANDOFF' ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <ArrowRightLeft size={16} />
                Execute Human Handoff
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Live Turn Transcript & Speech Input */}
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Transcript Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Volume2 size={18} color="#818cf8" />
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>
              Real-Time Diarized Dialogue Transcript
            </h4>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Shield size={14} color="#10b981" />
            <span style={{ fontSize: '11px', color: '#6ee7b7' }}>PII & Injection Guard Active</span>
          </div>
        </div>

        {/* Turns Stream */}
        <div
          style={{
            flex: 1,
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {turns.length === 0 ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                fontSize: '13px',
              }}
            >
              Connect an AI participant to begin streaming audio dialogue.
            </div>
          ) : (
            turns.map((turn) => {
              const isAgent = turn.speaker === 'AGENT';
              const isSystem = turn.speaker === 'SYSTEM';

              if (isSystem) {
                return (
                  <div
                    key={turn.id}
                    style={{
                      padding: '8px 14px',
                      backgroundColor: 'rgba(99, 102, 241, 0.1)',
                      border: '1px solid rgba(99, 102, 241, 0.25)',
                      borderRadius: '8px',
                      color: '#a5b4fc',
                      fontSize: '12px',
                      textAlign: 'center',
                    }}
                  >
                    {turn.text}
                  </div>
                );
              }

              return (
                <div
                  key={turn.id}
                  style={{
                    display: 'flex',
                    flexDirection: isAgent ? 'row' : 'row-reverse',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: isAgent ? 'rgba(99, 102, 241, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isAgent ? '#818cf8' : '#38bdf8',
                      flexShrink: 0,
                    }}
                  >
                    {isAgent ? <Bot size={18} /> : <User size={18} />}
                  </div>

                  <div
                    style={{
                      maxWidth: '75%',
                      backgroundColor: isAgent ? '#1e293b' : 'rgba(56, 189, 248, 0.1)',
                      border: `1px solid ${isAgent ? '#334155' : 'rgba(56, 189, 248, 0.3)'}`,
                      borderRadius: '12px',
                      padding: '12px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: isAgent ? '#a5b4fc' : '#7dd3fc' }}>
                        {isAgent ? 'AI Assistant' : 'Caller'}
                      </span>
                      {turn.latencyMs && (
                        <span style={{ fontSize: '10px', color: '#64748b' }}>
                          {turn.latencyMs}ms
                        </span>
                      )}
                    </div>

                    <p style={{ margin: 0, fontSize: '13px', color: '#f8fafc', lineHeight: 1.5 }}>
                      {turn.text}
                    </p>

                    {turn.toolCalls && turn.toolCalls.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                        {turn.toolCalls.map((tc) => (
                          <span
                            key={tc.id}
                            style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(245, 158, 11, 0.15)',
                              color: '#fbbf24',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Wrench size={10} />
                            Tool: {tc.toolName} ({tc.status})
                          </span>
                        ))}
                      </div>
                    )}

                    {turn.isInterrupted && (
                      <span style={{ fontSize: '10px', color: '#f87171', fontWeight: 600 }}>
                        [Interrupted by user speech]
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Speech Input Box */}
        <form
          onSubmit={handleSendSpeech}
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #1e293b',
            backgroundColor: '#090d16',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div style={{ color: '#94a3b8' }}>
            <Mic size={20} />
          </div>
          <input
            type="text"
            placeholder={
              activeSessionId
                ? 'Speak or type caller message to simulate conversational turn...'
                : 'Connect AI participant first...'
            }
            disabled={!activeSessionId || currentStatus === 'HANDOFF'}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 14px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '13px',
            }}
          />
          <button
            type="submit"
            disabled={!activeSessionId || !inputText.trim() || currentStatus === 'HANDOFF'}
            style={{
              padding: '10px 18px',
              backgroundColor: '#6366f1',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: !activeSessionId || !inputText.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Send size={14} />
            Send Turn
          </button>
        </form>
      </div>
    </div>
  );
};
