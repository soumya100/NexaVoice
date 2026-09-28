import { describe, it, expect } from 'vitest';
import {
  telephonyKeys,
  numberKeys,
  routingKeys,
  voicemailKeys,
} from '../query/query-keys';

describe('Milestone 6: Web Client Telephony Integration', () => {
  it('constructs deterministic, isolated query keys for telephony resources', () => {
    expect(telephonyKeys.all).toEqual(['telephony']);
    expect(telephonyKeys.outboundPolicy()).toEqual(['telephony', 'outboundPolicy']);
    expect(telephonyKeys.callerIds()).toEqual(['telephony', 'callerIds']);
    expect(telephonyKeys.activeCalls()).toEqual(['telephony', 'activeCalls']);
    expect(telephonyKeys.usage({ limit: 10, offset: 0 })).toEqual([
      'telephony',
      'usage',
      { limit: 10, offset: 0 },
    ]);
  });

  it('constructs deterministic query keys for phone numbers', () => {
    expect(numberKeys.all).toEqual(['phoneNumbers']);
    expect(numberKeys.list()).toEqual(['phoneNumbers', 'list', 'all']);
    expect(numberKeys.list('ACTIVE')).toEqual(['phoneNumbers', 'list', 'ACTIVE']);
    expect(numberKeys.detail('num-123')).toEqual(['phoneNumbers', 'detail', 'num-123']);
    expect(numberKeys.available('US', 'LOCAL')).toEqual([
      'phoneNumbers',
      'available',
      'US',
      'LOCAL',
    ]);
  });

  it('constructs deterministic query keys for routing and voicemails', () => {
    expect(routingKeys.forNumber('num-123')).toEqual(['routingRules', 'forNumber', 'num-123']);
    expect(voicemailKeys.all).toEqual(['voicemails']);
    expect(voicemailKeys.list()).toEqual(['voicemails', 'list']);
    expect(voicemailKeys.unreadCount()).toEqual(['voicemails', 'unreadCount']);
    expect(voicemailKeys.detail('vm-1')).toEqual(['voicemails', 'detail', 'vm-1']);
  });
});
