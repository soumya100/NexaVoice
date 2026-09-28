import React, { useState } from 'react';
import {
  FileText,
  CheckSquare,
  Sparkles,
  Search,
  Calendar,
  User,
  TrendingUp,
  Award,
} from 'lucide-react';
import { useCallSummary, useCallActionItems, useGenerateCallSummary } from '../hooks/use-ai';

export const CallInsightsView: React.FC = () => {
  const [selectedCallId, setSelectedCallId] = useState('call-demo-insights-101');
  const [transcriptSearch, setTranscriptSearch] = useState('');

  const { data: summary, isLoading: isSummaryLoading } = useCallSummary(selectedCallId);
  const { data: actionItems = [], isLoading: isActionsLoading } = useCallActionItems(selectedCallId);
  const generateSummaryMutation = useGenerateCallSummary();

  const handleGenerateSummary = async () => {
    await generateSummaryMutation.mutateAsync(selectedCallId);
  };

  const mockSegments = [
    {
      speaker: 'Alice (Customer)',
      time: '00:04',
      text: 'Hi there, we are looking to configure SIP trunks for our European numbers next week.',
    },
    {
      speaker: 'AI Assistant',
      time: '00:12',
      text: 'Certainly Alice. NexaVoice supports global PSTN and SIP trunk provisioning with automatic toll fraud protection.',
    },
    {
      speaker: 'Alice (Customer)',
      time: '00:25',
      text: 'Great! Could you have the operations team review our DID routing and send over the spec document?',
    },
    {
      speaker: 'AI Assistant',
      time: '00:36',
      text: 'I have logged an action item for operations to review your DID routing configuration, and scheduled a follow-up email.',
    },
  ];

  const filteredSegments = mockSegments.filter((s) =>
    s.text.toLowerCase().includes(transcriptSearch.toLowerCase()),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Bar */}
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
            Post-Call Intelligence & Insights
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
            Asynchronously generated executive summaries, key takeaways, and action items.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="text"
            value={selectedCallId}
            onChange={(e) => setSelectedCallId(e.target.value)}
            placeholder="Call Session ID"
            style={{
              padding: '8px 12px',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '13px',
              width: '220px',
            }}
          />
          <button
            onClick={handleGenerateSummary}
            disabled={generateSummaryMutation.isPending}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6366f1',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: generateSummaryMutation.isPending ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Sparkles size={16} />
            {generateSummaryMutation.isPending ? 'Analyzing...' : 'Generate Insights'}
          </button>
        </div>
      </div>

      {/* Main Insights Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        {/* Left: Summary & Action Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Executive Summary Card */}
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                  <FileText size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#f8fafc' }}>
                  Executive Call Summary
                </h3>
              </div>

              {summary && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      color: '#34d399',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Award size={12} />
                    {(summary.confidence * 100).toFixed(0)}% Confidence
                  </span>
                  {summary.sentiment && (
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(56, 189, 248, 0.15)',
                        color: '#38bdf8',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <TrendingUp size={12} />
                      {summary.sentiment}
                    </span>
                  )}
                </div>
              )}
            </div>

            {isSummaryLoading ? (
              <div style={{ color: '#94a3b8', fontSize: '13px' }}>Loading summary...</div>
            ) : summary ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ margin: 0, fontSize: '14px', color: '#cbd5e1', lineHeight: 1.6 }}>
                  {summary.overview}
                </p>

                <div>
                  <h4 style={{ margin: '8px 0 8px', fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>
                    Key Discussion Points:
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: '#e2e8f0', fontSize: '13px', lineHeight: 1.6 }}>
                    {summary.keyPoints.map((pt, i) => (
                      <li key={i}>{pt}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: '13px', padding: '12px 0' }}>
                Click "Generate Insights" to process the conversation dialogue.
              </div>
            )}
          </div>

          {/* Structured Action Items */}
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981',
                }}
              >
                <CheckSquare size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#f8fafc' }}>
                  Extracted Action Items
                </h3>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Confirmable tasks with owners and due dates
                </span>
              </div>
            </div>

            {isActionsLoading ? (
              <div style={{ color: '#94a3b8', fontSize: '13px' }}>Loading action items...</div>
            ) : actionItems.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '13px', padding: '12px 0' }}>
                No action items extracted yet. Click "Generate Insights" to extract tasks.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {actionItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '14px 16px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                    }}
                  >
                    <input
                      type="checkbox"
                      defaultChecked={item.isCompleted}
                      style={{ marginTop: '3px', cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                          {item.title}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            color: '#6ee7b7',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          {(item.confidence * 100).toFixed(0)}% confidence
                        </span>
                      </div>
                      {item.description && (
                        <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                          {item.description}
                        </p>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px' }}>
                        {item.assignee && (
                          <span
                            style={{
                              fontSize: '11px',
                              color: '#a5b4fc',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <User size={12} />
                            {item.assignee}
                          </span>
                        )}
                        {item.dueDate && (
                          <span
                            style={{
                              fontSize: '11px',
                              color: '#cbd5e1',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Calendar size={12} />
                            Due: {item.dueDate}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Diarized Dialogue Transcript Review */}
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
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #1e293b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>
              Diarized Transcript Source
            </h4>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '4px 8px',
                gap: '6px',
              }}
            >
              <Search size={14} color="#94a3b8" />
              <input
                type="text"
                value={transcriptSearch}
                onChange={(e) => setTranscriptSearch(e.target.value)}
                placeholder="Search transcript..."
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#f8fafc',
                  fontSize: '12px',
                  outline: 'none',
                  width: '140px',
                }}
              />
            </div>
          </div>

          <div
            style={{
              padding: '20px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {filteredSegments.map((seg, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  padding: '12px',
                  backgroundColor: '#1e293b',
                  borderRadius: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#818cf8' }}>
                    {seg.speaker}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{seg.time}</span>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: '#e2e8f0', lineHeight: 1.5 }}>
                  {seg.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
