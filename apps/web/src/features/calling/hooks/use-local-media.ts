import { useState, useEffect, useCallback, useRef } from 'react';

export interface LocalMediaOptions {
  audio?: boolean;
  video?: boolean;
  audioDeviceId?: string;
  videoDeviceId?: string;
}

export function useLocalMedia(options: LocalMediaOptions = { audio: true, video: true }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(!options.video);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const startMedia = useCallback(async (opts?: LocalMediaOptions) => {
    setIsLoading(true);
    setPermissionError(null);

    const audioConstraints: boolean | MediaTrackConstraints = opts?.audioDeviceId
      ? { deviceId: { exact: opts.audioDeviceId } }
      : (opts?.audio ?? options.audio ?? true);

    const videoConstraints: boolean | MediaTrackConstraints = opts?.videoDeviceId
      ? { deviceId: { exact: opts.videoDeviceId } }
      : (opts?.video ?? options.video ?? true);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Media devices API not supported in this browser');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: videoConstraints,
      });

      // Stop previous tracks if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsLoading(false);
      return mediaStream;
    } catch (err: any) {
      setIsLoading(false);
      let errorMsg = 'Failed to access camera or microphone';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Camera and microphone access was denied. Please update your browser permissions.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'No camera or microphone found on this device.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMsg = 'Hardware is already in use by another application.';
      }
      setPermissionError(errorMsg);
      return null;
    }
  }, [options.audio, options.video]);

  const toggleAudio = useCallback(() => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      const nextMuted = !isAudioMuted;
      audioTracks.forEach((track) => {
        track.enabled = !nextMuted;
      });
      setIsAudioMuted(nextMuted);
    }
  }, [isAudioMuted]);

  const toggleVideo = useCallback(() => {
    if (streamRef.current) {
      const videoTracks = streamRef.current.getVideoTracks();
      const nextMuted = !isVideoMuted;
      videoTracks.forEach((track) => {
        track.enabled = !nextMuted;
      });
      setIsVideoMuted(nextMuted);
    }
  }, [isVideoMuted]);

  const stopMedia = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
    }
  }, []);

  useEffect(() => {
    startMedia();
    return () => {
      stopMedia();
    };
  }, [startMedia, stopMedia]);

  return {
    stream,
    isAudioMuted,
    isVideoMuted,
    isLoading,
    permissionError,
    toggleAudio,
    toggleVideo,
    startMedia,
    stopMedia,
  };
}
