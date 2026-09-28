import { executeGraphQL } from '../../../services/api';
import {
  PhoneNumberGql,
  RoutingRuleGql,
  VoicemailMessageGql,
  TelephonyUsageGql,
  OutboundTelephonyPolicyGql,
  TelephonyCallResultGql,
  PhoneNumberType,
  PhoneNumberAssignmentType,
  RoutingTargetType,
} from '../types';

const PHONE_NUMBER_FIELDS = `
  id
  e164Number
  displayNumber
  countryCode
  type
  provider
  providerResourceId
  status
  assignedToType
  assignedId
  createdAt
  updatedAt
  releasedAt
`;

const ROUTING_RULE_FIELDS = `
  id
  phoneNumberId
  priority
  name
  targetType
  targetId
  ringDurationSeconds
  businessHoursOnly
  businessHoursStart
  businessHoursEnd
  timezone
  fallbackTargetType
  fallbackTargetId
  enabled
  createdAt
  updatedAt
`;

const VOICEMAIL_FIELDS = `
  id
  callSessionId
  recordingSessionId
  callerNumber
  recipientUserId
  durationSeconds
  transcript
  audioStorageKey
  status
  createdAt
  readAt
`;

export const telephonyApi = {
  async getPhoneNumbers(status?: string): Promise<PhoneNumberGql[]> {
    const query = `
      query GetPhoneNumbers($status: String) {
        phoneNumbers(status: $status) {
          ${PHONE_NUMBER_FIELDS}
        }
      }
    `;
    const res = await executeGraphQL<{ phoneNumbers: PhoneNumberGql[] }>(query, { status });
    return res.phoneNumbers;
  },

  async getAvailableNumbers(country = 'US', type = 'LOCAL'): Promise<string[]> {
    const query = `
      query GetAvailableNumbers($country: String!, $type: String!) {
        availableNumbers(country: $country, type: $type)
      }
    `;
    const res = await executeGraphQL<{ availableNumbers: string[] }>(query, { country, type });
    return res.availableNumbers;
  },

  async provisionPhoneNumber(input: {
    country: string;
    type: PhoneNumberType;
    pattern?: string;
  }): Promise<PhoneNumberGql> {
    const query = `
      mutation ProvisionPhoneNumber($input: ProvisionPhoneNumberInput!) {
        provisionPhoneNumber(input: $input) {
          ${PHONE_NUMBER_FIELDS}
        }
      }
    `;
    const res = await executeGraphQL<{ provisionPhoneNumber: PhoneNumberGql }>(query, { input });
    return res.provisionPhoneNumber;
  },

  async assignPhoneNumber(
    numberId: string,
    assignedToType: PhoneNumberAssignmentType,
    assignedId: string,
  ): Promise<PhoneNumberGql> {
    const query = `
      mutation AssignPhoneNumber($numberId: String!, $assignedToType: String!, $assignedId: String!) {
        assignPhoneNumber(numberId: $numberId, assignedToType: $assignedToType, assignedId: $assignedId) {
          ${PHONE_NUMBER_FIELDS}
        }
      }
    `;
    const res = await executeGraphQL<{ assignPhoneNumber: PhoneNumberGql }>(query, {
      numberId,
      assignedToType,
      assignedId,
    });
    return res.assignPhoneNumber;
  },

  async unassignPhoneNumber(numberId: string): Promise<PhoneNumberGql> {
    const query = `
      mutation UnassignPhoneNumber($numberId: String!) {
        unassignPhoneNumber(numberId: $numberId) {
          ${PHONE_NUMBER_FIELDS}
        }
      }
    `;
    const res = await executeGraphQL<{ unassignPhoneNumber: PhoneNumberGql }>(query, { numberId });
    return res.unassignPhoneNumber;
  },

  async releasePhoneNumber(numberId: string): Promise<PhoneNumberGql> {
    const query = `
      mutation ReleasePhoneNumber($numberId: String!) {
        releasePhoneNumber(numberId: $numberId) {
          ${PHONE_NUMBER_FIELDS}
        }
      }
    `;
    const res = await executeGraphQL<{ releasePhoneNumber: PhoneNumberGql }>(query, { numberId });
    return res.releasePhoneNumber;
  },

  async initiateOutboundPstnCall(to: string, callerId?: string): Promise<TelephonyCallResultGql> {
    const query = `
      mutation InitiatePstnCall($input: InitiateOutboundPstnCallInput!) {
        initiatePstnCall(input: $input) {
          callId
          providerCallId
          status
          destinationNumber
        }
      }
    `;
    const res = await executeGraphQL<{ initiatePstnCall: TelephonyCallResultGql }>(query, {
      input: {
        to,
        from: callerId || undefined,
      },
    });
    return res.initiatePstnCall;
  },

  async sendDtmf(callSessionId: string, digits: string): Promise<boolean> {
    const query = `
      mutation SendPstnDtmf($callId: ID!, $digits: String!) {
        sendPstnDtmf(callId: $callId, digits: $digits)
      }
    `;
    const res = await executeGraphQL<{ sendPstnDtmf: boolean }>(query, {
      callId: callSessionId,
      digits,
    });
    return res.sendPstnDtmf;
  },

  async getInboundRoutingRules(phoneNumberId: string): Promise<RoutingRuleGql[]> {
    const query = `
      query GetInboundRoutingRules($phoneNumberId: String!) {
        inboundRoutingRules(phoneNumberId: $phoneNumberId) {
          ${ROUTING_RULE_FIELDS}
        }
      }
    `;
    const res = await executeGraphQL<{ inboundRoutingRules: RoutingRuleGql[] }>(query, {
      phoneNumberId,
    });
    return res.inboundRoutingRules;
  },

  async setInboundRoutingRule(input: {
    phoneNumberId: string;
    name: string;
    priority?: number;
    targetType: RoutingTargetType;
    targetId: string;
    ringDurationSeconds?: number;
    businessHoursOnly?: boolean;
    businessHoursStart?: string;
    businessHoursEnd?: string;
    timezone?: string;
    fallbackTargetType?: RoutingTargetType;
    fallbackTargetId?: string;
  }): Promise<RoutingRuleGql> {
    const query = `
      mutation SetInboundRoutingRule($input: SetInboundRoutingRuleInput!) {
        setInboundRoutingRule(input: $input) {
          ${ROUTING_RULE_FIELDS}
        }
      }
    `;
    const res = await executeGraphQL<{ setInboundRoutingRule: RoutingRuleGql }>(query, { input });
    return res.setInboundRoutingRule;
  },

  async getVoicemails(): Promise<VoicemailMessageGql[]> {
    const query = `
      query GetVoicemails {
        voicemails {
          ${VOICEMAIL_FIELDS}
        }
      }
    `;
    const res = await executeGraphQL<{ voicemails: VoicemailMessageGql[] }>(query);
    return res.voicemails;
  },

  async markVoicemailAsRead(voicemailId: string): Promise<VoicemailMessageGql> {
    const query = `
      mutation MarkVoicemailAsRead($voicemailId: String!) {
        markVoicemailAsRead(voicemailId: $voicemailId) {
          ${VOICEMAIL_FIELDS}
        }
      }
    `;
    const res = await executeGraphQL<{ markVoicemailAsRead: VoicemailMessageGql }>(query, {
      voicemailId,
    });
    return res.markVoicemailAsRead;
  },

  async deleteVoicemail(voicemailId: string): Promise<boolean> {
    const query = `
      mutation DeleteVoicemail($voicemailId: String!) {
        deleteVoicemail(voicemailId: $voicemailId)
      }
    `;
    const res = await executeGraphQL<{ deleteVoicemail: boolean }>(query, { voicemailId });
    return res.deleteVoicemail;
  },

  async getTelephonyUsage(limit = 20, offset = 0): Promise<TelephonyUsageGql[]> {
    const query = `
      query GetTelephonyUsage($limit: Int, $offset: Int) {
        telephonyUsage(limit: $limit, offset: $offset) {
          id
          callSessionId
          direction
          provider
          providerCallId
          sourceNumber
          destinationNumber
          durationSeconds
          callStatus
          costEstimateCents
          currency
          startedAt
          answeredAt
          endedAt
          createdAt
        }
      }
    `;
    const res = await executeGraphQL<{ telephonyUsage: TelephonyUsageGql[] }>(query, {
      limit,
      offset,
    });
    return res.telephonyUsage;
  },

  async getOutboundTelephonyPolicy(): Promise<OutboundTelephonyPolicyGql> {
    const query = `
      query GetOutboundTelephonyPolicy {
        outboundTelephonyPolicy {
          allowedCountries
          maxCallDurationSeconds
          allowHighRiskDestinations
          maxCallsPerMinute
          maxConcurrentCalls
          defaultCallerId
        }
      }
    `;
    const res = await executeGraphQL<{ outboundTelephonyPolicy: OutboundTelephonyPolicyGql }>(query);
    return res.outboundTelephonyPolicy;
  },
};
