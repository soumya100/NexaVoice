export interface TranscriptSegmentData {
  speakerUserId?: string;
  speakerLabel: string;
  startMs: number;
  endMs: number;
  text: string;
  confidence: number;
}

export interface TranscriptionResult {
  fullText: string;
  segments: TranscriptSegmentData[];
  durationSeconds: number;
  language: string;
}

export interface TranscriptionProvider {
  readonly providerName: string;

  /**
   * Process an audio stream or recorded file and generate a diarized transcription.
   */
  processAudio(params: {
    callSessionId: string;
    recordingId?: string;
    audioUrl?: string;
    language?: string;
    participantMap?: Record<string, string>; // userId -> displayName
  }): Promise<TranscriptionResult>;
}
