import { useState, useCallback, useRef } from 'react';

export function useScreenShare(onEnded?: () => void) {
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startScreenShare = useCallback(async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Screen sharing not supported by this browser');
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      streamRef.current = stream;
      setScreenStream(stream);
      setIsSharing(true);

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopScreenShare();
          onEnded?.();
        };
      }

      return stream;
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        setError(err.message || 'Failed to start screen share');
      }
      setIsSharing(false);
      return null;
    }
  }, [onEnded]);

  const stopScreenShare = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setScreenStream(null);
    setIsSharing(false);
  }, []);

  return {
    screenStream,
    isSharing,
    error,
    startScreenShare,
    stopScreenShare,
  };
}
