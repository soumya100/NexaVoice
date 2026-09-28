import { IceServer, WebRtcConnectionState } from '../types';

export interface WebRtcPeerCallbacks {
  onIceCandidate: (candidate: RTCIceCandidate) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange: (state: WebRtcConnectionState) => void;
}

export class WebRtcPeerService {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream = new MediaStream();
  private callbacks: WebRtcPeerCallbacks;
  private senders: Map<string, RTCRtpSender> = new Map();

  constructor(callbacks: WebRtcPeerCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Initializes RTCPeerConnection with configured ICE servers.
   */
  initialize(iceServers: IceServer[]): RTCPeerConnection {
    this.close();

    const rtcIceServers: RTCIceServer[] = iceServers.map((server) => ({
      urls: server.urls,
      username: server.username,
      credential: server.credential,
    }));

    if (rtcIceServers.length === 0) {
      rtcIceServers.push({ urls: 'stun:stun.l.google.com:19302' });
    }

    this.pc = new RTCPeerConnection({
      iceServers: rtcIceServers,
      iceCandidatePoolSize: 2,
    });

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.callbacks.onIceCandidate(event.candidate);
      }
    };

    this.pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        this.remoteStream.addTrack(track);
      });
      this.callbacks.onRemoteStream(this.remoteStream);
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc) {
        this.callbacks.onConnectionStateChange(this.pc.connectionState as WebRtcConnectionState);
      }
    };

    // If local stream already acquired, attach tracks
    if (this.localStream) {
      this.attachLocalTracks(this.localStream);
    }

    return this.pc;
  }

  /**
   * Attaches local audio/video tracks to the peer connection.
   */
  attachLocalTracks(stream: MediaStream): void {
    this.localStream = stream;
    if (!this.pc) return;

    stream.getTracks().forEach((track) => {
      const existing = this.senders.get(track.kind);
      if (!existing) {
        const sender = this.pc!.addTrack(track, stream);
        this.senders.set(track.kind, sender);
      } else {
        existing.replaceTrack(track);
      }
    });
  }

  /**
   * Replaces a specific track (e.g. switching camera to screen share).
   */
  async replaceTrack(kind: 'audio' | 'video', newTrack: MediaStreamTrack | null): Promise<void> {
    const sender = this.senders.get(kind);
    if (sender) {
      await sender.replaceTrack(newTrack);
    }
  }

  /**
   * Creates an SDP Offer.
   */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  /**
   * Handles incoming SDP Offer and generates SDP Answer.
   */
  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  /**
   * Handles incoming SDP Answer.
   */
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  /**
   * Adds an ICE candidate received via signaling.
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc) return;
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('Failed to add ICE candidate', err);
    }
  }

  /**
   * Toggles audio track mute state.
   */
  setAudioMuted(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  /**
   * Toggles video track mute state.
   */
  setVideoMuted(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  /**
   * Cleans up all tracks and closes the peer connection.
   */
  close(): void {
    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.ontrack = null;
      this.pc.onconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
    this.senders.clear();
    this.remoteStream = new MediaStream();
  }
}
