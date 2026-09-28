import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { realtimeService } from '../../../services/realtime';
import { WebRtcPeerService } from '../services/webrtc-peer.service';
import { useLocalMedia } from './use-local-media';
import { useScreenShare } from './use-screen-share';
import { useCallQuery, useCallIceServersQuery } from './use-call-queries';
import { callKeys } from '../../../query/query-keys';
import { WebRtcConnectionState, CallParticipant, CallSession } from '../types';

export function useCallSession(callId: string, currentUserId: string) {
  const queryClient = useQueryClient();
  const { data: call } = useCallQuery(callId);
  const { data: iceServers } = useCallIceServersQuery(callId);

  const [connectionState, setConnectionState] = useState<WebRtcConnectionState>('new');
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [elapsedDurationSeconds, setElapsedDurationSeconds] = useState(0);

  const localMedia = useLocalMedia({ audio: true, video: call?.callType === 'VIDEO' || call?.callType === 'GROUP_VIDEO' });
  const screenShare = useScreenShare(() => {
    // When screen share ends, restore camera track
    if (localMedia.stream) {
      const videoTrack = localMedia.stream.getVideoTracks()[0] || null;
      peerServiceRef.current?.replaceTrack('video', videoTrack);
    }
  });

  const peerServiceRef = useRef<WebRtcPeerService | null>(null);

  // Initialize WebRtcPeerService
  useEffect(() => {
    const peer = new WebRtcPeerService({
      onIceCandidate: (candidate) => {
        const socket = realtimeService.connect();
        socket.emit('call:ice-candidate', {
          callId,
          candidate: candidate.toJSON(),
        });
      },
      onRemoteStream: (stream) => {
        setRemoteStream(stream);
      },
      onConnectionStateChange: (state) => {
        setConnectionState(state);
      },
    });

    peerServiceRef.current = peer;

    return () => {
      peer.close();
    };
  }, [callId]);

  // Connect local media tracks to peer connection
  useEffect(() => {
    if (localMedia.stream && peerServiceRef.current) {
      peerServiceRef.current.attachLocalTracks(localMedia.stream);
    }
  }, [localMedia.stream]);

  // Handle screen share track replacement
  useEffect(() => {
    if (screenShare.screenStream && peerServiceRef.current) {
      const screenTrack = screenShare.screenStream.getVideoTracks()[0];
      if (screenTrack) {
        peerServiceRef.current.replaceTrack('video', screenTrack);
      }
    }
  }, [screenShare.screenStream]);

  // Socket.IO signaling event subscriptions
  useEffect(() => {
    if (!callId) return;

    const socket = realtimeService.connect();
    socket.emit('join-call', { callId, userId: currentUserId });

    // 1. Initial Offer by Host
    const isHost = call?.hostUserId === currentUserId;
    if (isHost && iceServers && peerServiceRef.current) {
      peerServiceRef.current.initialize(iceServers);
      peerServiceRef.current.createOffer().then((offer) => {
        socket.emit('call:offer', { callId, sdp: offer.sdp });
      }).catch((e) => console.warn('Failed to create offer', e));
    }

    // 2. Incoming Offer
    const handleOffer = async (payload: { callId: string; sdp: string; senderId: string }) => {
      if (payload.callId !== callId || payload.senderId === currentUserId) return;
      if (!peerServiceRef.current || !iceServers) return;

      peerServiceRef.current.initialize(iceServers);
      const answer = await peerServiceRef.current.handleOffer({
        type: 'offer',
        sdp: payload.sdp,
      });

      socket.emit('call:answer', {
        callId,
        sdp: answer.sdp,
        targetUserId: payload.senderId,
      });
    };

    // 3. Incoming Answer
    const handleAnswer = async (payload: { callId: string; sdp: string; senderId: string }) => {
      if (payload.callId !== callId || payload.senderId === currentUserId) return;
      if (peerServiceRef.current) {
        await peerServiceRef.current.handleAnswer({
          type: 'answer',
          sdp: payload.sdp,
        });
      }
    };

    // 4. Incoming ICE Candidate
    const handleIceCandidate = async (payload: { callId: string; candidate: RTCIceCandidateInit; senderId: string }) => {
      if (payload.callId !== callId || payload.senderId === currentUserId) return;
      if (peerServiceRef.current && payload.candidate) {
        await peerServiceRef.current.addIceCandidate(payload.candidate);
      }
    };

    // 5. Participant Joined
    const handleParticipantJoined = (payload: { callId: string; userId: string; call?: CallSession }) => {
      if (payload.callId !== callId) return;
      if (payload.call) {
        queryClient.setQueryData(callKeys.detail(callId), payload.call);
      } else {
        queryClient.invalidateQueries({ queryKey: callKeys.detail(callId) });
      }
    };

    // 6. Participant Left
    const handleParticipantLeft = (payload: { callId: string; userId: string }) => {
      if (payload.callId !== callId) return;
      queryClient.setQueryData<CallSession>(callKeys.detail(callId), (old) => {
        if (!old) return old;
        return {
          ...old,
          participants: old.participants.map((p) =>
            p.userId === payload.userId ? { ...p, state: 'LEFT' as any } : p,
          ),
        };
      });
    };

    // 7. Participant Muted
    const handleParticipantMuted = (payload: { callId: string; targetUserId: string; isAudioMuted?: boolean; isVideoMuted?: boolean }) => {
      if (payload.callId !== callId) return;
      queryClient.setQueryData<CallSession>(callKeys.detail(callId), (old) => {
        if (!old) return old;
        return {
          ...old,
          participants: old.participants.map((p) => {
            if (p.userId !== payload.targetUserId) return p;
            return {
              ...p,
              isAudioMuted: payload.isAudioMuted !== undefined ? payload.isAudioMuted : p.isAudioMuted,
              isVideoMuted: payload.isVideoMuted !== undefined ? payload.isVideoMuted : p.isVideoMuted,
            };
          }),
        };
      });
    };

    // 8. Call Ended / Evicted
    const handleCallEnded = () => {
      localMedia.stopMedia();
      screenShare.stopScreenShare();
      peerServiceRef.current?.close();
      queryClient.invalidateQueries({ queryKey: callKeys.detail(callId) });
    };

    socket.on('call.offer', handleOffer);
    socket.on('call.answer', handleAnswer);
    socket.on('call.ice-candidate', handleIceCandidate);
    socket.on('call.participant.joined', handleParticipantJoined);
    socket.on('call.participant.left', handleParticipantLeft);
    socket.on('call.participant.muted', handleParticipantMuted);
    socket.on('call.ended', handleCallEnded);
    socket.on('call.evicted', handleCallEnded);

    return () => {
      socket.off('call.offer', handleOffer);
      socket.off('call.answer', handleAnswer);
      socket.off('call.ice-candidate', handleIceCandidate);
      socket.off('call.participant.joined', handleParticipantJoined);
      socket.off('call.participant.left', handleParticipantLeft);
      socket.off('call.participant.muted', handleParticipantMuted);
      socket.off('call.ended', handleCallEnded);
      socket.off('call.evicted', handleCallEnded);
      socket.emit('leave-call', { callId });
    };
  }, [callId, currentUserId, call?.hostUserId, iceServers, queryClient]);

  // Server-authoritative elapsed timer calculation
  useEffect(() => {
    if (!call?.activeAt && !call?.startedAt) return;
    const startTimeMs = new Date(call.activeAt || call.startedAt).getTime();

    const interval = setInterval(() => {
      if (call.endedAt) {
        const endTimeMs = new Date(call.endedAt).getTime();
        setElapsedDurationSeconds(Math.max(0, Math.floor((endTimeMs - startTimeMs) / 1000)));
        clearInterval(interval);
      } else {
        const nowMs = Date.now();
        setElapsedDurationSeconds(Math.max(0, Math.floor((nowMs - startTimeMs) / 1000)));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [call?.activeAt, call?.startedAt, call?.endedAt]);

  const toggleMic = useCallback(() => {
    localMedia.toggleAudio();
    peerServiceRef.current?.setAudioMuted(!localMedia.isAudioMuted);
  }, [localMedia]);

  const toggleCamera = useCallback(() => {
    localMedia.toggleVideo();
    peerServiceRef.current?.setVideoMuted(!localMedia.isVideoMuted);
  }, [localMedia]);

  const toggleScreen = useCallback(async () => {
    if (screenShare.isSharing) {
      screenShare.stopScreenShare();
      if (localMedia.stream) {
        const videoTrack = localMedia.stream.getVideoTracks()[0] || null;
        await peerServiceRef.current?.replaceTrack('video', videoTrack);
      }
    } else {
      await screenShare.startScreenShare();
    }
  }, [screenShare, localMedia.stream]);

  return {
    call,
    connectionState,
    localStream: localMedia.stream,
    remoteStream,
    isAudioMuted: localMedia.isAudioMuted,
    isVideoMuted: localMedia.isVideoMuted,
    isScreenSharing: screenShare.isSharing,
    permissionError: localMedia.permissionError,
    elapsedDurationSeconds,
    toggleMic,
    toggleCamera,
    toggleScreen,
    participants: (call?.participants || []) as CallParticipant[],
  };
}
