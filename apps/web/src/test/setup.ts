import '@testing-library/jest-dom';
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Polyfills or global test mocks for browser WebRTC APIs
if (typeof window !== 'undefined') {
  window.scrollTo = () => {};

  if (!window.RTCPeerConnection) {
    class MockRTCPeerConnection {
      onicecandidate: any = null;
      ontrack: any = null;
      onconnectionstatechange: any = null;
      connectionState = 'new';
      addTrack = vi.fn().mockReturnValue({ replaceTrack: vi.fn() });
      createOffer = vi.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-offer-sdp' });
      createAnswer = vi.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-answer-sdp' });
      setLocalDescription = vi.fn().mockResolvedValue(undefined);
      setRemoteDescription = vi.fn().mockResolvedValue(undefined);
      addIceCandidate = vi.fn().mockResolvedValue(undefined);
      close = vi.fn();
    }
    (window as any).RTCPeerConnection = MockRTCPeerConnection;
    (globalThis as any).RTCPeerConnection = MockRTCPeerConnection;
  }

  if (!window.MediaStream) {
    class MockMediaStream {
      private tracks: any[] = [];
      addTrack(t: any) {
        this.tracks.push(t);
      }
      getTracks() {
        return this.tracks;
      }
      getAudioTracks() {
        return this.tracks.filter((t) => t.kind === 'audio');
      }
      getVideoTracks() {
        return this.tracks.filter((t) => t.kind === 'video');
      }
    }
    (window as any).MediaStream = MockMediaStream;
    (globalThis as any).MediaStream = MockMediaStream;
  }

  if (!window.RTCSessionDescription) {
    const MockDesc = class {
      constructor(init: any) {
        Object.assign(this, init);
      }
    };
    (window as any).RTCSessionDescription = MockDesc;
    (globalThis as any).RTCSessionDescription = MockDesc;
  }

  if (!window.RTCIceCandidate) {
    const MockCand = class {
      constructor(init: any) {
        Object.assign(this, init);
      }
    };
    (window as any).RTCIceCandidate = MockCand;
    (globalThis as any).RTCIceCandidate = MockCand;
  }
}
