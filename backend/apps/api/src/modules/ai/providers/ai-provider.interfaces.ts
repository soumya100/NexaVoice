import {
  LLMProviderCapabilities,
  STTProviderCapabilities,
  TTSProviderCapabilities,
  RealtimeVoiceProviderCapabilities,
  AIToolDefinition,
  AIToolInvocation,
} from '@nexavoice/domain-types';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolInvocations?: AIToolInvocation[];
}

export interface LLMGenerateOptions {
  model: string;
  systemPrompt: string;
  messages: LLMMessage[];
  temperature?: number;
  availableTools?: AIToolDefinition[];
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  toolInvocations?: AIToolInvocation[];
  inputTokens: number;
  outputTokens: number;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
}

export interface LLMProvider {
  readonly providerName: string;
  readonly llmCapabilities: LLMProviderCapabilities;
  generateResponse(options: LLMGenerateOptions): Promise<LLMResponse>;
  streamResponse(
    options: LLMGenerateOptions,
    onChunk: (chunk: string) => void,
  ): Promise<LLMResponse>;
}

export interface STTTranscribeOptions {
  audioBuffer?: Buffer;
  audioUrl?: string;
  language?: string;
  speakerDiarization?: boolean;
}

export interface STTSegment {
  speakerLabel: string;
  startMs: number;
  endMs: number;
  text: string;
  confidence: number;
}

export interface STTResult {
  fullText: string;
  segments: STTSegment[];
  durationSeconds: number;
  language: string;
}

export interface SpeechToTextProvider {
  readonly providerName: string;
  readonly sttCapabilities: STTProviderCapabilities;
  transcribeAudio(options: STTTranscribeOptions): Promise<STTResult>;
}

export interface TTSSynthesizeOptions {
  text: string;
  voiceId?: string;
  language?: string;
  speed?: number;
}

export interface TTSSynthesisResult {
  audioBuffer: Buffer;
  mimeType: string;
  durationSeconds: number;
}

export interface TextToSpeechProvider {
  readonly providerName: string;
  readonly ttsCapabilities: TTSProviderCapabilities;
  synthesizeSpeech(options: TTSSynthesizeOptions): Promise<TTSSynthesisResult>;
}

export interface RealtimeSessionOptions {
  callSessionId: string;
  voiceId?: string;
  systemPrompt: string;
  tools?: AIToolDefinition[];
  onAudioChunk?: (chunk: Buffer) => void;
  onTranscriptPartial?: (text: string) => void;
  onTranscriptFinal?: (text: string) => void;
  onInterrupted?: () => void;
}

export interface RealtimeSessionResult {
  sessionId: string;
  provider: string;
  status: 'connected' | 'failed';
  error?: string;
}

export interface RealtimeVoiceProvider {
  readonly providerName: string;
  readonly realtimeCapabilities: RealtimeVoiceProviderCapabilities;
  createSession(options: RealtimeSessionOptions): Promise<RealtimeSessionResult>;
  sendAudio(sessionId: string, audioChunk: Buffer): Promise<void>;
  interrupt(sessionId: string): Promise<void>;
  closeSession(sessionId: string): Promise<void>;
}
