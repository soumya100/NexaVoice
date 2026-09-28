import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { callKeys } from '../query/query-keys';
import { formatDuration } from '../features/calling/components/ActiveCallView';
import { CallModal } from '../features/calling/components/CallModal';
import { CallControls } from '../features/calling/components/CallControls';
import { CallHistoryView } from '../features/calling/components/CallHistoryView';
import { WebRtcPeerService } from '../features/calling/services/webrtc-peer.service';
import { CallSession } from '../features/calling/types';
import { toastService } from '../services/toast';

describe('Calling Frontend Integration & Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('callKeys Query Factory', () => {
    it('generates consistent and deterministic query keys', () => {
      expect(callKeys.all).toEqual(['calls']);
      expect(callKeys.detail('call-123')).toEqual(['calls', 'detail', 'call-123']);
      expect(callKeys.active()).toEqual(['calls', 'active']);
      expect(callKeys.history(10, 0)).toEqual(['calls', 'history', { limit: 10, offset: 0 }]);
      expect(callKeys.iceServers('call-123')).toEqual(['calls', 'iceServers', 'call-123']);
    });
  });

  describe('formatDuration helper', () => {
    it('formats seconds into mm:ss and hh:mm:ss accurately', () => {
      expect(formatDuration(0)).toBe('00:00');
      expect(formatDuration(45)).toBe('00:45');
      expect(formatDuration(65)).toBe('01:05');
      expect(formatDuration(3665)).toBe('01:01:05');
    });
  });

  describe('CallModal Component', () => {
    const mockCall: CallSession = {
      id: 'call-xyz',
      callType: 'VIDEO' as any,
      status: 'RINGING' as any,
      hostUserId: 'host-1',
      isPersistent: false,
      maxParticipants: 2,
      startedAt: new Date().toISOString(),
      participants: [
        {
          participantId: 'p-1',
          userId: 'host-1',
          displayName: 'Sarah Connor',
          role: 'HOST' as any,
          state: 'CONNECTED' as any,
          isAudioMuted: false,
          isVideoMuted: false,
          isScreenSharing: false,
          isOnHold: false,
          permissions: {
            canMuteOthers: true,
            canRemoveParticipants: true,
            canInviteParticipants: true,
            canShareScreen: true,
            canRecord: false,
            canEndCall: true,
          },
          joinedAt: new Date().toISOString(),
        },
      ],
    };

    it('renders caller information and accessibility labels', () => {
      render(
        <CallModal
          call={mockCall}
          onAccept={vi.fn()}
          onDecline={vi.fn()}
        />,
      );

      expect(screen.getByText('Sarah Connor')).toBeDefined();
      expect(screen.getByText('NexaVoice Video Call')).toBeDefined();
      expect(screen.getByRole('dialog', { name: 'Sarah Connor' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Accept Call' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Decline Call' })).toBeDefined();
    });

    it('fires onAccept and onDecline callbacks', () => {
      const onAccept = vi.fn();
      const onDecline = vi.fn();

      render(
        <CallModal
          call={mockCall}
          onAccept={onAccept}
          onDecline={onDecline}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Accept Call' }));
      expect(onAccept).toHaveBeenCalledOnce();

      fireEvent.click(screen.getByRole('button', { name: 'Decline Call' }));
      expect(onDecline).toHaveBeenCalledOnce();
    });
  });

  describe('CallControls Component', () => {
    it('renders all call action buttons with accessible labels', () => {
      const onToggleAudio = vi.fn();
      const onToggleVideo = vi.fn();
      const onToggleScreenShare = vi.fn();
      const onToggleHold = vi.fn();
      const onOpenParticipants = vi.fn();
      const onOpenSettings = vi.fn();
      const onEndCall = vi.fn();

      render(
        <CallControls
          isAudioMuted={false}
          isVideoMuted={false}
          isScreenSharing={false}
          isOnHold={false}
          participantCount={3}
          onToggleAudio={onToggleAudio}
          onToggleVideo={onToggleVideo}
          onToggleScreenShare={onToggleScreenShare}
          onToggleHold={onToggleHold}
          onOpenParticipants={onOpenParticipants}
          onOpenSettings={onOpenSettings}
          onEndCall={onEndCall}
        />,
      );

      const muteBtn = screen.getByRole('button', { name: 'Mute Microphone' });
      expect(muteBtn).toBeDefined();
      fireEvent.click(muteBtn);
      expect(onToggleAudio).toHaveBeenCalledOnce();

      const endBtn = screen.getByRole('button', { name: 'End Call' });
      expect(endBtn).toBeDefined();
      fireEvent.click(endBtn);
      expect(onEndCall).toHaveBeenCalledOnce();
    });

    it('displays non-color-only text and accessible labels when muted or on hold', () => {
      render(
        <CallControls
          isAudioMuted={true}
          isVideoMuted={true}
          isScreenSharing={true}
          isOnHold={true}
          participantCount={5}
          onToggleAudio={vi.fn()}
          onToggleVideo={vi.fn()}
          onToggleScreenShare={vi.fn()}
          onToggleHold={vi.fn()}
          onOpenParticipants={vi.fn()}
          onOpenSettings={vi.fn()}
          onEndCall={vi.fn()}
        />,
      );

      expect(screen.getByRole('button', { name: 'Unmute Microphone' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Turn on Camera' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Stop Screen Share' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Resume Call' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Participants (5)' })).toBeDefined();
    });
  });

  describe('WebRtcPeerService', () => {
    it('initializes and closes cleanly', () => {
      const mockCallbacks = {
        onIceCandidate: vi.fn(),
        onRemoteStream: vi.fn(),
        onConnectionStateChange: vi.fn(),
      };

      const peer = new WebRtcPeerService(mockCallbacks);
      expect(peer).toBeDefined();

      // Test close does not crash even without connection
      expect(() => peer.close()).not.toThrow();
    });
  });

  describe('CallHistoryView Component', () => {
    it('renders the Calling Studio header, telemetry badges, and action deck', () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const onJoinCall = vi.fn();

      render(
        <QueryClientProvider client={queryClient}>
          <CallHistoryView onJoinCall={onJoinCall} />
        </QueryClientProvider>,
      );

      expect(screen.getByText('NexaVoice Calling Studio')).toBeDefined();
      expect(screen.getByText('Instant Voice Room')).toBeDefined();
      expect(screen.getByText('HD Video Conference')).toBeDefined();
      expect(screen.getByText('Deploy War Room')).toBeDefined();
      expect(screen.getByText('Direct Frequency Hop')).toBeDefined();
    });

    it('opens and closes the Deploy Custom Room modal and displays form controls', () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });

      render(
        <QueryClientProvider client={queryClient}>
          <CallHistoryView onJoinCall={vi.fn()} />
        </QueryClientProvider>,
      );

      const configBtn = screen.getByRole('button', { name: /Configure Room/i });
      fireEvent.click(configBtn);

      expect(screen.getByText('Deploy Custom Room')).toBeDefined();
      expect(screen.getByPlaceholderText(/e\.g\. Q4 Growth Sprint/i)).toBeDefined();

      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelBtn);

      expect(screen.queryByPlaceholderText(/e\.g\. Q4 Growth Sprint/i)).toBeNull();
    });

    it('triggers sync toast on Sync Frequencies click', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const toastSpy = vi.spyOn(toastService, 'info');

      render(
        <QueryClientProvider client={queryClient}>
          <CallHistoryView onJoinCall={vi.fn()} />
        </QueryClientProvider>,
      );

      const syncBtn = screen.getByRole('button', { name: /Sync Frequencies/i });
      fireEvent.click(syncBtn);

      await waitFor(() => {
        expect(toastSpy).toHaveBeenCalledWith('All call frequencies & telemetry refreshed.');
      });
    });

    it('warns with toast when trying to direct hop with empty ID', () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const warnSpy = vi.spyOn(toastService, 'warning');

      render(
        <QueryClientProvider client={queryClient}>
          <CallHistoryView onJoinCall={vi.fn()} />
        </QueryClientProvider>,
      );

      const warpBtn = screen.getByRole('button', { name: /Warp In/i });
      fireEvent.click(warpBtn);

      expect(warnSpy).toHaveBeenCalledWith('Please enter a valid Call ID or room link.');
    });
  });
});

