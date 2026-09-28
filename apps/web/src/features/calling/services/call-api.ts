import { executeGraphQL } from '../../../services/api';
import {
  CallSession,
  IceServer,
  ScheduledCall,
  CallDeviceTransfer,
  RecordingSession,
  CallTranscript,
  RecordingPlaybackUrl,
} from '../types';
import { CallType, RecordingType } from '@nexavoice/domain-types';

const CALL_SESSION_FRAGMENT = `
  fragment CallSessionFields on CallSessionGql {
    id
    conversationId
    parentCallSessionId
    callType
    status
    hostUserId
    roomName
    isPersistent
    maxParticipants
    startedAt
    activeAt
    endedAt
    endReason
    participants {
      participantId
      userId
      displayName
      avatarUrl
      role
      state
      waitingState
      admittedAt
      isAudioMuted
      isVideoMuted
      isScreenSharing
      isOnHold
      permissions {
        canMuteOthers
        canRemoveParticipants
        canInviteParticipants
        canShareScreen
        canRecord
        canEndCall
      }
      joinedAt
      leftAt
    }
    legs {
      id
      callSessionId
      userId
      deviceId
      direction
      status
      startedAt
      connectedAt
      endedAt
    }
    mediaSession {
      id
      callSessionId
      provider
      mode
      status
      sfuRoomId
      iceServers {
        urls
        username
        credential
      }
    }
  }
`;

export const callApi = {
  async getCall(id: string): Promise<CallSession> {
    const data = await executeGraphQL<{ call: CallSession }>(
      `
      query GetCall($id: ID!) {
        call(id: $id) {
          ...CallSessionFields
        }
      }
      ${CALL_SESSION_FRAGMENT}
      `,
      { id },
    );
    return data.call;
  },

  async getActiveCalls(): Promise<CallSession[]> {
    const data = await executeGraphQL<{ activeCalls: CallSession[] }>(
      `
      query GetActiveCalls {
        activeCalls {
          ...CallSessionFields
        }
      }
      ${CALL_SESSION_FRAGMENT}
      `,
    );
    return data.activeCalls;
  },

  async getCallHistory(limit = 20, offset = 0): Promise<CallSession[]> {
    const data = await executeGraphQL<{ callHistory: CallSession[] }>(
      `
      query GetCallHistory($limit: Int, $offset: Int) {
        callHistory(limit: $limit, offset: $offset) {
          ...CallSessionFields
        }
      }
      ${CALL_SESSION_FRAGMENT}
      `,
      { limit, offset },
    );
    return data.callHistory;
  },

  async getCallIceServers(callId: string): Promise<IceServer[]> {
    const data = await executeGraphQL<{ callIceServers: IceServer[] }>(
      `
      query GetCallIceServers($callId: ID!) {
        callIceServers(callId: $callId) {
          urls
          username
          credential
        }
      }
      `,
      { callId },
    );
    return data.callIceServers;
  },

  async initiateCall(input: {
    callType: CallType;
    inviteeUserIds: string[];
    conversationId?: string;
    roomName?: string;
    maxParticipants?: number;
  }): Promise<CallSession> {
    const data = await executeGraphQL<{ initiateCall: CallSession }>(
      `
      mutation InitiateCall($input: InitiateCallInput!) {
        initiateCall(input: $input) {
          ...CallSessionFields
        }
      }
      ${CALL_SESSION_FRAGMENT}
      `,
      { input },
    );
    return data.initiateCall;
  },

  async acceptCall(callId: string, deviceId?: string): Promise<CallSession> {
    const data = await executeGraphQL<{ acceptCall: CallSession }>(
      `
      mutation AcceptCall($callId: ID!, $deviceId: String) {
        acceptCall(callId: $callId, deviceId: $deviceId) {
          ...CallSessionFields
        }
      }
      ${CALL_SESSION_FRAGMENT}
      `,
      { callId, deviceId },
    );
    return data.acceptCall;
  },

  async declineCall(callId: string, reason?: string): Promise<boolean> {
    const data = await executeGraphQL<{ declineCall: boolean }>(
      `
      mutation DeclineCall($callId: ID!, $reason: String) {
        declineCall(callId: $callId, reason: $reason)
      }
      `,
      { callId, reason },
    );
    return data.declineCall;
  },

  async cancelCall(callId: string): Promise<boolean> {
    const data = await executeGraphQL<{ cancelCall: boolean }>(
      `
      mutation CancelCall($callId: ID!) {
        cancelCall(callId: $callId)
      }
      `,
      { callId },
    );
    return data.cancelCall;
  },

  async joinCall(callId: string, deviceId?: string): Promise<CallSession> {
    const data = await executeGraphQL<{ joinCall: CallSession }>(
      `
      mutation JoinCall($callId: ID!, $deviceId: String) {
        joinCall(callId: $callId, deviceId: $deviceId) {
          ...CallSessionFields
        }
      }
      ${CALL_SESSION_FRAGMENT}
      `,
      { callId, deviceId },
    );
    return data.joinCall;
  },

  async leaveCall(callId: string): Promise<boolean> {
    const data = await executeGraphQL<{ leaveCall: boolean }>(
      `
      mutation LeaveCall($callId: ID!) {
        leaveCall(callId: $callId)
      }
      `,
      { callId },
    );
    return data.leaveCall;
  },

  async endCall(callId: string, reason?: string): Promise<boolean> {
    const data = await executeGraphQL<{ endCall: boolean }>(
      `
      mutation EndCall($callId: ID!, $reason: String) {
        endCall(callId: $callId, reason: $reason)
      }
      `,
      { callId, reason },
    );
    return data.endCall;
  },

  async muteParticipant(input: {
    callId: string;
    targetUserId: string;
    isAudioMuted?: boolean;
    isVideoMuted?: boolean;
  }): Promise<boolean> {
    const data = await executeGraphQL<{ muteParticipant: boolean }>(
      `
      mutation MuteParticipant($input: MuteParticipantInput!) {
        muteParticipant(input: $input)
      }
      `,
      { input },
    );
    return data.muteParticipant;
  },

  async removeParticipant(input: {
    callId: string;
    targetUserId: string;
    reason?: string;
  }): Promise<boolean> {
    const data = await executeGraphQL<{ removeParticipant: boolean }>(
      `
      mutation RemoveParticipant($input: RemoveCallParticipantInput!) {
        removeParticipant(input: $input)
      }
      `,
      { input },
    );
    return data.removeParticipant;
  },

  async holdCall(callId: string): Promise<boolean> {
    const data = await executeGraphQL<{ holdCall: boolean }>(
      `
      mutation HoldCall($callId: ID!) {
        holdCall(callId: $callId)
      }
      `,
      { callId },
    );
    return data.holdCall;
  },

  async resumeCall(callId: string): Promise<boolean> {
    const data = await executeGraphQL<{ resumeCall: boolean }>(
      `
      mutation ResumeCall($callId: ID!) {
        resumeCall(callId: $callId)
      }
      `,
      { callId },
    );
    return data.resumeCall;
  },

  async swapCalls(holdCallId: string, resumeCallId: string): Promise<boolean> {
    const data = await executeGraphQL<{ swapCalls: boolean }>(
      `
      mutation SwapCalls($input: SwapCallsInput!) {
        swapCalls(input: $input)
      }
      `,
      { input: { holdCallId, resumeCallId } },
    );
    return data.swapCalls;
  },

  async blindTransfer(callId: string, targetUserId: string): Promise<boolean> {
    const data = await executeGraphQL<{ blindTransfer: boolean }>(
      `
      mutation BlindTransfer($input: BlindTransferInput!) {
        blindTransfer(input: $input)
      }
      `,
      { input: { callId, targetUserId } },
    );
    return data.blindTransfer;
  },

  async initiateAttendedTransfer(originalCallId: string, targetUserId: string): Promise<CallSession> {
    const data = await executeGraphQL<{ initiateAttendedTransfer: CallSession }>(
      `
      mutation InitiateAttendedTransfer($input: InitiateAttendedTransferInput!) {
        initiateAttendedTransfer(input: $input) {
          ...CallSessionFields
        }
      }
      ${CALL_SESSION_FRAGMENT}
      `,
      { input: { originalCallId, targetUserId } },
    );
    return data.initiateAttendedTransfer;
  },

  async completeAttendedTransfer(transferCallId: string): Promise<boolean> {
    const data = await executeGraphQL<{ completeAttendedTransfer: boolean }>(
      `
      mutation CompleteAttendedTransfer($input: CompleteAttendedTransferInput!) {
        completeAttendedTransfer(input: $input)
      }
      `,
      { input: { transferCallId } },
    );
    return data.completeAttendedTransfer;
  },

  async cancelAttendedTransfer(transferCallId: string): Promise<boolean> {
    const data = await executeGraphQL<{ cancelAttendedTransfer: boolean }>(
      `
      mutation CancelAttendedTransfer($input: CancelAttendedTransferInput!) {
        cancelAttendedTransfer(input: $input)
      }
      `,
      { input: { transferCallId } },
    );
    return data.cancelAttendedTransfer;
  },

  async mergeCalls(callIdA: string, callIdB: string): Promise<CallSession> {
    const data = await executeGraphQL<{ mergeCalls: CallSession }>(
      `
      mutation MergeCalls($input: MergeCallsInput!) {
        mergeCalls(input: $input) {
          ...CallSessionFields
        }
      }
      ${CALL_SESSION_FRAGMENT}
      `,
      { input: { callIdA, callIdB } },
    );
    return data.mergeCalls;
  },

  async splitConferenceCall(conferenceId: string, participantUserId: string): Promise<CallSession> {
    const data = await executeGraphQL<{ splitConferenceCall: CallSession }>(
      `
      mutation SplitConferenceCall($input: SplitConferenceCallInput!) {
        splitConferenceCall(input: $input) {
          ...CallSessionFields
        }
      }
      ${CALL_SESSION_FRAGMENT}
      `,
      { input: { conferenceId, participantUserId } },
    );
    return data.splitConferenceCall;
  },

  async admitParticipant(callId: string, targetUserId: string): Promise<boolean> {
    const data = await executeGraphQL<{ admitParticipant: boolean }>(
      `
      mutation AdmitParticipant($input: AdmitParticipantInput!) {
        admitParticipant(input: $input)
      }
      `,
      { input: { callId, targetUserId } },
    );
    return data.admitParticipant;
  },

  async denyParticipant(callId: string, targetUserId: string): Promise<boolean> {
    const data = await executeGraphQL<{ denyParticipant: boolean }>(
      `
      mutation DenyParticipant($input: DenyParticipantInput!) {
        denyParticipant(input: $input)
      }
      `,
      { input: { callId, targetUserId } },
    );
    return data.denyParticipant;
  },

  async lockConference(callId: string, isLocked: boolean): Promise<boolean> {
    const data = await executeGraphQL<{ lockConference: boolean }>(
      `
      mutation LockConference($input: LockConferenceInput!) {
        lockConference(input: $input)
      }
      `,
      { input: { callId, isLocked } },
    );
    return data.lockConference;
  },

  async startScreenShare(callId: string): Promise<boolean> {
    const data = await executeGraphQL<{ startScreenShare: boolean }>(
      `
      mutation StartScreenShare($input: ScreenShareInput!) {
        startScreenShare(input: $input)
      }
      `,
      { input: { callId } },
    );
    return data.startScreenShare;
  },

  async stopScreenShare(callId: string): Promise<boolean> {
    const data = await executeGraphQL<{ stopScreenShare: boolean }>(
      `
      mutation StopScreenShare($input: ScreenShareInput!) {
        stopScreenShare(input: $input)
      }
      `,
      { input: { callId } },
    );
    return data.stopScreenShare;
  },

  async initiateDeviceTransfer(callId: string, targetDeviceId: string): Promise<CallDeviceTransfer> {
    const data = await executeGraphQL<{ initiateDeviceTransfer: CallDeviceTransfer }>(
      `
      mutation InitiateDeviceTransfer($input: InitiateDeviceTransferInput!) {
        initiateDeviceTransfer(input: $input) {
          id
          callSessionId
          userId
          sourceDeviceId
          targetDeviceId
          status
          failureReason
          initiatedAt
          completedAt
        }
      }
      `,
      { input: { callId, targetDeviceId } },
    );
    return data.initiateDeviceTransfer;
  },

  async completeDeviceTransfer(callId: string, transferId: string, sourceDeviceId: string, targetDeviceId: string): Promise<boolean> {
    const data = await executeGraphQL<{ completeDeviceTransfer: boolean }>(
      `
      mutation CompleteDeviceTransfer($input: CompleteDeviceTransferInput!) {
        completeDeviceTransfer(input: $input)
      }
      `,
      { input: { callId, transferId, sourceDeviceId, targetDeviceId } },
    );
    return data.completeDeviceTransfer;
  },

  async startRecording(callId: string, recordingType = RecordingType.COMBINED): Promise<RecordingSession> {
    const data = await executeGraphQL<{ startRecording: RecordingSession }>(
      `
      mutation StartRecording($input: StartRecordingInput!) {
        startRecording(input: $input) {
          id
          callSessionId
          initiatorUserId
          status
          recordingType
          durationSeconds
          startedAt
          createdAt
        }
      }
      `,
      { input: { callId, recordingType } },
    );
    return data.startRecording;
  },

  async pauseRecording(callId: string, recordingId: string): Promise<boolean> {
    const data = await executeGraphQL<{ pauseRecording: boolean }>(
      `
      mutation PauseRecording($input: PauseRecordingInput!) {
        pauseRecording(input: $input)
      }
      `,
      { input: { callId, recordingId } },
    );
    return data.pauseRecording;
  },

  async resumeRecording(callId: string, recordingId: string): Promise<boolean> {
    const data = await executeGraphQL<{ resumeRecording: boolean }>(
      `
      mutation ResumeRecording($input: ResumeRecordingInput!) {
        resumeRecording(input: $input)
      }
      `,
      { input: { callId, recordingId } },
    );
    return data.resumeRecording;
  },

  async stopRecording(callId: string, recordingId: string): Promise<boolean> {
    const data = await executeGraphQL<{ stopRecording: boolean }>(
      `
      mutation StopRecording($input: StopRecordingInput!) {
        stopRecording(input: $input)
      }
      `,
      { input: { callId, recordingId } },
    );
    return data.stopRecording;
  },

  async submitRecordingConsent(callId: string, recordingId: string, consented: boolean): Promise<boolean> {
    const data = await executeGraphQL<{ submitRecordingConsent: boolean }>(
      `
      mutation SubmitRecordingConsent($input: SubmitRecordingConsentInput!) {
        submitRecordingConsent(input: $input)
      }
      `,
      { input: { callId, recordingId, consented } },
    );
    return data.submitRecordingConsent;
  },

  async deleteRecording(recordingId: string): Promise<boolean> {
    const data = await executeGraphQL<{ deleteRecording: boolean }>(
      `
      mutation DeleteRecording($recordingId: ID!) {
        deleteRecording(recordingId: $recordingId)
      }
      `,
      { recordingId },
    );
    return data.deleteRecording;
  },

  async getRecordingPlaybackUrl(recordingId: string): Promise<RecordingPlaybackUrl> {
    const data = await executeGraphQL<{ recordingPlaybackUrl: RecordingPlaybackUrl }>(
      `
      query RecordingPlaybackUrl($recordingId: ID!) {
        recordingPlaybackUrl(recordingId: $recordingId) {
          recordingId
          playbackUrl
          expiresInSeconds
        }
      }
      `,
      { recordingId },
    );
    return data.recordingPlaybackUrl;
  },

  async getCallRecordings(callId: string): Promise<RecordingSession[]> {
    const data = await executeGraphQL<{ callRecordings: RecordingSession[] }>(
      `
      query CallRecordings($callId: ID!) {
        callRecordings(callId: $callId) {
          id
          callSessionId
          initiatorUserId
          status
          recordingType
          durationSeconds
          startedAt
          pausedAt
          stoppedAt
          createdAt
        }
      }
      `,
      { callId },
    );
    return data.callRecordings;
  },

  async getScheduledCalls(): Promise<ScheduledCall[]> {
    const data = await executeGraphQL<{ scheduledCalls: ScheduledCall[] }>(
      `
      query ScheduledCalls {
        scheduledCalls {
          id
          organizerId
          roomId
          callSessionId
          title
          description
          scheduledStartTime
          scheduledEndTime
          timezone
          status
          reminderMinutes
          createdAt
          updatedAt
        }
      }
      `,
    );
    return data.scheduledCalls;
  },

  async scheduleCall(input: {
    title: string;
    description?: string;
    scheduledStartTime: string;
    scheduledEndTime?: string;
    timezone?: string;
    inviteeUserIds?: string[];
    roomId?: string;
    reminderMinutes?: number;
  }): Promise<ScheduledCall> {
    const data = await executeGraphQL<{ scheduleCall: ScheduledCall }>(
      `
      mutation ScheduleCall($input: ScheduleCallInput!) {
        scheduleCall(input: $input) {
          id
          organizerId
          roomId
          callSessionId
          title
          description
          scheduledStartTime
          scheduledEndTime
          timezone
          status
          reminderMinutes
          createdAt
          updatedAt
        }
      }
      `,
      { input },
    );
    return data.scheduleCall;
  },

  async cancelScheduledCall(scheduledCallId: string): Promise<boolean> {
    const data = await executeGraphQL<{ cancelScheduledCall: boolean }>(
      `
      mutation CancelScheduledCall($scheduledCallId: ID!) {
        cancelScheduledCall(scheduledCallId: $scheduledCallId)
      }
      `,
      { scheduledCallId },
    );
    return data.cancelScheduledCall;
  },

  async transcribeCall(callId: string, recordingId?: string): Promise<CallTranscript> {
    const data = await executeGraphQL<{ transcribeCall: CallTranscript }>(
      `
      mutation TranscribeCall($callId: ID!, $recordingId: ID) {
        transcribeCall(callId: $callId, recordingId: $recordingId) {
          id
          callSessionId
          recordingSessionId
          status
          language
          fullText
          createdAt
          segments {
            id
            speakerUserId
            speakerLabel
            startMs
            endMs
            text
            confidence
          }
        }
      }
      `,
      { callId, recordingId },
    );
    return data.transcribeCall;
  },

  async getCallTranscripts(recordingId: string): Promise<CallTranscript[]> {
    const data = await executeGraphQL<{ callTranscripts: CallTranscript[] }>(
      `
      query CallTranscripts($recordingId: ID!) {
        callTranscripts(recordingId: $recordingId) {
          id
          callSessionId
          recordingSessionId
          status
          language
          fullText
          createdAt
          segments {
            id
            speakerUserId
            speakerLabel
            startMs
            endMs
            text
            confidence
          }
        }
      }
      `,
      { recordingId },
    );
    return data.callTranscripts;
  },
};
