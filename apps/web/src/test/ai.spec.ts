import {
  aiKeys,
  agentKeys,
  transcriptKeys,
  summaryKeys,
  actionItemKeys,
} from '../query/query-keys';

describe('Milestone 7: Frontend AI Query Keys & Architecture', () => {
  it('constructs deterministic, isolated query keys for AI agents and versions', () => {
    expect(agentKeys.all).toEqual(['aiAgents']);
    expect(agentKeys.list()).toEqual(['aiAgents', 'list']);
    expect(agentKeys.detail('agent-1')).toEqual(['aiAgents', 'detail', 'agent-1']);
    expect(agentKeys.versions('agent-1')).toEqual(['aiAgents', 'versions', 'agent-1']);
  });

  it('constructs deterministic query keys for AI sessions and tools', () => {
    expect(aiKeys.all).toEqual(['ai']);
    expect(aiKeys.sessions()).toEqual(['ai', 'sessions']);
    expect(aiKeys.sessionDetail('session-123')).toEqual(['ai', 'session', 'session-123']);
    expect(aiKeys.tools()).toEqual(['ai', 'tools']);
  });

  it('constructs deterministic query keys for transcripts, summaries, and action items', () => {
    expect(transcriptKeys.all).toEqual(['transcripts']);
    expect(transcriptKeys.forCall('call-99')).toEqual(['transcripts', 'call', 'call-99']);

    expect(summaryKeys.all).toEqual(['callSummaries']);
    expect(summaryKeys.forCall('call-99')).toEqual(['callSummaries', 'call', 'call-99']);

    expect(actionItemKeys.all).toEqual(['actionItems']);
    expect(actionItemKeys.forCall('call-99')).toEqual(['actionItems', 'call', 'call-99']);
  });
});
