import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { conferenceKeys, roomKeys, recordingKeys, scheduleKeys } from '../query/query-keys';
import { CallWaitingBanner } from '../features/calling/components/CallWaitingBanner';
import { RecordingIndicatorBanner } from '../features/calling/components/RecordingIndicatorBanner';
import { DeviceHandoffModal } from '../features/calling/components/DeviceHandoffModal';
import { WaitingRoomModeratorList } from '../features/calling/components/WaitingRoomModeratorList';
import { ScheduledCallsView } from '../features/calling/components/ScheduledCallsView';
import { toastService } from '../services/toast';
import { callApi } from '../features/calling/services/call-api';
import { CallSession, RecordingSession, CallParticipant } from '../features/calling/types';
import {
  CallType,
  CallSessionStatus,
  ParticipantRole,
  ParticipantState,
  WaitingRoomState,
  RecordingStatus,
  RecordingType,
  ConsentState,
  ScheduledCallStatus,
} from '@nexavoice/domain-types';

describe('Advanced Calling Frontend (Milestone 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Query Key Factories', () => {
    it('generates deterministic query keys for conferences, rooms, recordings, and schedule', () => {
      expect(conferenceKeys.all).toEqual(['conferences']);
      expect(conferenceKeys.detail('conf-1')).toEqual(['conferences', 'detail', 'conf-1']);
      expect(conferenceKeys.participants('conf-1')).toEqual(['conferences', 'participants', 'conf-1']);

      expect(roomKeys.all).toEqual(['rooms']);
      expect(roomKeys.detail('room-1')).toEqual(['rooms', 'detail', 'room-1']);
      expect(roomKeys.members('room-1')).toEqual(['rooms', 'members', 'room-1']);

      expect(recordingKeys.all).toEqual(['recordings']);
      expect(recordingKeys.forCall('call-1')).toEqual(['recordings', 'forCall', 'call-1']);
      expect(recordingKeys.playbackUrl('rec-1')).toEqual(['recordings', 'playbackUrl', 'rec-1']);
      expect(recordingKeys.transcripts('rec-1')).toEqual(['recordings', 'transcripts', 'rec-1']);

      expect(scheduleKeys.all).toEqual(['scheduledCalls']);
      expect(scheduleKeys.list()).toEqual(['scheduledCalls', 'list']);
      expect(scheduleKeys.detail('sched-1')).toEqual(['scheduledCalls', 'detail', 'sched-1']);
    });
  });

  describe('CallWaitingBanner Component', () => {
    const mockActive: CallSession = {
      id: 'call-active',
      callType: CallType.VOICE,
      status: CallSessionStatus.ACTIVE,
      hostUserId: 'user-1',
      roomName: 'Design Sync',
      isPersistent: false,
      maxParticipants: 2,
      startedAt: new Date().toISOString(),
      participants: [],
    };

    const mockHeld: CallSession = {
      id: 'call-held',
      callType: CallType.VOICE,
      status: CallSessionStatus.HELD,
      hostUserId: 'user-2',
      roomName: 'Customer Support',
      isPersistent: false,
      maxParticipants: 2,
      startedAt: new Date().toISOString(),
      participants: [],
    };

    it('renders held and active call details with Swap and Merge buttons', () => {
      const onSwap = vi.fn();
      const onMerge = vi.fn();

      render(
        <CallWaitingBanner
          activeCall={mockActive}
          heldCall={mockHeld}
          onSwap={onSwap}
          onMerge={onMerge}
        />,
      );

      expect(screen.getByText(/Call on Hold: Customer Support/i)).toBeDefined();
      expect(screen.getByText(/Active call: Design Sync/i)).toBeDefined();
      expect(screen.getByRole('button', { name: 'Swap Calls' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Merge to Conference' })).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: 'Swap Calls' }));
      expect(onSwap).toHaveBeenCalledWith('call-active', 'call-held');

      fireEvent.click(screen.getByRole('button', { name: 'Merge to Conference' }));
      expect(onMerge).toHaveBeenCalledWith('call-active', 'call-held');
    });

    it('returns null if heldCall is absent', () => {
      const { container } = render(
        <CallWaitingBanner
          activeCall={mockActive}
          heldCall={undefined}
          onSwap={vi.fn()}
          onMerge={vi.fn()}
        />,
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('RecordingIndicatorBanner Component', () => {
    const mockRecording: RecordingSession = {
      id: 'rec-1',
      callSessionId: 'call-1',
      initiatorUserId: 'user-1',
      status: RecordingStatus.RECORDING,
      recordingType: RecordingType.COMBINED,
      durationSeconds: 120,
      createdAt: new Date().toISOString(),
      consents: [
        {
          id: 'c-1',
          recordingSessionId: 'rec-1',
          participantUserId: 'user-2',
          consentState: ConsentState.PENDING,
        },
      ],
    };

    it('renders clear textual indicator and consent prompt', () => {
      const onPause = vi.fn();
      const onResume = vi.fn();
      const onStop = vi.fn();
      const onConsent = vi.fn();

      render(
        <RecordingIndicatorBanner
          recording={mockRecording}
          currentUserId="user-2"
          canRecord={true}
          onPause={onPause}
          onResume={onResume}
          onStop={onStop}
          onConsent={onConsent}
        />,
      );

      // Accessibility: Visual text label must exist (not color alone)
      expect(screen.getByText('RECORDING IN PROGRESS')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Pause' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Stop Recording' })).toBeDefined();

      // Consent banner for user-2
      expect(screen.getByText(/Do you consent to audio, video, and AI transcript generation/i)).toBeDefined();
      expect(screen.getByRole('button', { name: 'Consent' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Decline' })).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: 'Consent' }));
      expect(onConsent).toHaveBeenCalledWith('rec-1', true);
    });

    it('displays RECORDING PAUSED when status is PAUSED', () => {
      const pausedRecording: RecordingSession = {
        ...mockRecording,
        status: RecordingStatus.PAUSED,
      };

      render(
        <RecordingIndicatorBanner
          recording={pausedRecording}
          currentUserId="user-1"
          canRecord={true}
          onPause={vi.fn()}
          onResume={vi.fn()}
          onStop={vi.fn()}
          onConsent={vi.fn()}
        />,
      );

      expect(screen.getByText('RECORDING PAUSED')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Resume' })).toBeDefined();
    });
  });

  describe('DeviceHandoffModal Component', () => {
    const devices = [
      { deviceId: 'dev-current', deviceName: 'MacBook Pro Chrome', deviceType: 'WEB' as const, isCurrentDevice: true },
      { deviceId: 'dev-mobile', deviceName: 'iPhone 15 Pro', deviceType: 'MOBILE' as const, isCurrentDevice: false },
    ];

    it('renders device choices and initiates handoff', () => {
      const onHandoff = vi.fn();
      const onClose = vi.fn();

      render(
        <DeviceHandoffModal
          isOpen={true}
          onClose={onClose}
          availableDevices={devices}
          onHandoff={onHandoff}
        />,
      );

      expect(screen.getByText('Seamless Device Handoff')).toBeDefined();
      expect(screen.getByText('iPhone 15 Pro')).toBeDefined();
      expect(screen.queryByText('MacBook Pro Chrome')).toBeNull(); // Current device filtered out

      const radio = screen.getByRole('radio');
      fireEvent.click(radio);

      const transferBtn = screen.getByRole('button', { name: 'Transfer Call' });
      fireEvent.click(transferBtn);

      expect(onHandoff).toHaveBeenCalledWith('dev-mobile');
    });
  });

  describe('WaitingRoomModeratorList Component', () => {
    const participants: CallParticipant[] = [
      {
        participantId: 'p-1',
        userId: 'user-waiting',
        displayName: 'Waiting Guest',
        role: ParticipantRole.PARTICIPANT,
        state: ParticipantState.INVITED,
        waitingState: WaitingRoomState.WAITING,
        isAudioMuted: false,
        isVideoMuted: false,
        isScreenSharing: false,
        isOnHold: false,
        permissions: {
          canMuteOthers: false,
          canRemoveParticipants: false,
          canInviteParticipants: false,
          canShareScreen: false,
          canRecord: false,
          canEndCall: false,
        },
        joinedAt: new Date().toISOString(),
      },
    ];

    it('renders waiting list and allows moderator to admit or deny', () => {
      const onAdmit = vi.fn();
      const onDeny = vi.fn();

      render(
        <WaitingRoomModeratorList
          participants={participants}
          onAdmit={onAdmit}
          onDeny={onDeny}
        />,
      );

      expect(screen.getByText('Waiting Room (1)')).toBeDefined();
      expect(screen.getByText('Waiting Guest')).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: 'Admit' }));
      expect(onAdmit).toHaveBeenCalledWith('user-waiting');

      fireEvent.click(screen.getByRole('button', { name: 'Deny' }));
      expect(onDeny).toHaveBeenCalledWith('user-waiting');
    });
  });

  describe('ScheduledCallsView Component', () => {
    it('renders scheduled calls and opens the schedule modal', () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });

      render(
        <QueryClientProvider client={queryClient}>
          <ScheduledCallsView onJoinCall={vi.fn()} />
        </QueryClientProvider>,
      );

      expect(screen.getByText('Scheduled Calls & Conferences')).toBeDefined();
      const openBtn = screen.getByRole('button', { name: /Schedule Call/i });
      fireEvent.click(openBtn);

      expect(screen.getByPlaceholderText(/e\.g\. Design Architecture Review/i)).toBeDefined();
      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelBtn);

      expect(screen.queryByPlaceholderText(/e\.g\. Design Architecture Review/i)).toBeNull();
    });

    it('triggers toast warning when submitting empty title or start time', () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const warnSpy = vi.spyOn(toastService, 'warning');

      render(
        <QueryClientProvider client={queryClient}>
          <ScheduledCallsView onJoinCall={vi.fn()} />
        </QueryClientProvider>,
      );

      fireEvent.click(screen.getByRole('button', { name: /Schedule Call/i }));

      const form = screen.getByRole('dialog').querySelector('form')!;
      fireEvent.submit(form);

      expect(warnSpy).toHaveBeenCalledWith('Please specify both a title and scheduled start time.');
    });

    it('schedules a call successfully, fires toast and closes dialog', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const successSpy = vi.spyOn(toastService, 'success');
      vi.spyOn(callApi, 'scheduleCall').mockResolvedValueOnce({
        id: 'sched-new-1',
        organizerId: 'user-1',
        title: 'Sprint Planning',
        scheduledStartTime: new Date(Date.now() + 3600000).toISOString(),
        status: ScheduledCallStatus.SCHEDULED,
        timezone: 'UTC',
        invitees: [],
        reminderMinutes: 15,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      render(
        <QueryClientProvider client={queryClient}>
          <ScheduledCallsView onJoinCall={vi.fn()} />
        </QueryClientProvider>,
      );

      fireEvent.click(screen.getByRole('button', { name: /Schedule Call/i }));

      const titleInput = screen.getByPlaceholderText(/e\.g\. Design Architecture Review/i);
      fireEvent.change(titleInput, { target: { value: 'Sprint Planning' } });

      const dateInput = screen.getByLabelText(/Date & Time/i);
      fireEvent.change(dateInput, { target: { value: '2026-10-01T10:00' } });

      const form = screen.getByRole('dialog').querySelector('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(successSpy).toHaveBeenCalledWith('Call "Sprint Planning" scheduled successfully!');
      });

      expect(screen.queryByPlaceholderText(/e\.g\. Design Architecture Review/i)).toBeNull();
    });
  });
});

