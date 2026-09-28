import { Injectable } from '@nestjs/common';
import {
  LLMProvider,
  SpeechToTextProvider,
  TextToSpeechProvider,
  RealtimeVoiceProvider,
  LLMGenerateOptions,
  LLMResponse,
  STTTranscribeOptions,
  STTResult,
  TTSSynthesizeOptions,
  TTSSynthesisResult,
  RealtimeSessionOptions,
  RealtimeSessionResult,
} from './ai-provider.interfaces';
import {
  LLMProviderCapabilities,
  STTProviderCapabilities,
  TTSProviderCapabilities,
  RealtimeVoiceProviderCapabilities,
} from '@nexavoice/domain-types';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service';

/**
 * 🟠 MOCK / TEST DOUBLE
 * Deterministic in-memory AI provider for automated unit, contract, and integration tests.
 * Never reported as production AI infrastructure.
 */
@Injectable()
export class MockAIProvider
  implements LLMProvider, SpeechToTextProvider, TextToSpeechProvider, RealtimeVoiceProvider
{
  readonly providerName = 'mock-ai';
  private readonly logger = new StructuredLogger('MockAIProvider');

  private activeSessions = new Map<string, { isInterrupted: boolean }>();

  // Capability declarations
  readonly llmCapabilities: LLMProviderCapabilities = {
    streaming: true,
    toolCalling: true,
    structuredOutput: true,
    systemPromptVersion: true,
  };

  readonly sttCapabilities: STTProviderCapabilities = {
    streaming: true,
    partialResults: true,
    speakerDiarization: true,
    wordTimestamps: true,
  };

  readonly ttsCapabilities: TTSProviderCapabilities = {
    streaming: true,
    customVoices: true,
    speedControl: true,
    pitchControl: true,
  };

  readonly realtimeCapabilities: RealtimeVoiceProviderCapabilities = {
    bargeIn: true,
    serverVAD: true,
    clientVAD: true,
    audioStreaming: true,
  };

  // ==========================================
  // LLM Implementation
  // ==========================================
  async generateResponse(options: LLMGenerateOptions): Promise<LLMResponse> {
    this.logger.log({ event: 'mock_llm_generate', model: options.model });

    const lastMsg = options.messages[options.messages.length - 1]?.content || '';

    // Check if last message requests a tool
    if (
      lastMsg.toLowerCase().includes('lookup') ||
      lastMsg.toLowerCase().includes('customer') ||
      lastMsg.toLowerCase().includes('account')
    ) {
      return {
        content: 'I will look up that customer account for you.',
        toolInvocations: [
          {
            id: `call_${Date.now()}`,
            toolName: 'lookupCustomer',
            inputJson: JSON.stringify({ query: 'customer-123' }),
            status: 'REQUESTED',
          },
        ],
        inputTokens: 42,
        outputTokens: 28,
        finishReason: 'tool_calls',
      };
    }

    if (lastMsg.toLowerCase().includes('handoff') || lastMsg.toLowerCase().includes('human')) {
      return {
        content: 'I understand you would like to speak with a human specialist. Connecting you now.',
        toolInvocations: [
          {
            id: `call_${Date.now()}`,
            toolName: 'transferToHuman',
            inputJson: JSON.stringify({ reason: 'Customer requested human agent' }),
            status: 'REQUESTED',
          },
        ],
        inputTokens: 35,
        outputTokens: 22,
        finishReason: 'tool_calls',
      };
    }

    return {
      content: `Hello! I am your NexaVoice AI assistant. I heard: "${lastMsg.slice(0, 50)}". How can I assist you today?`,
      inputTokens: 30,
      outputTokens: 35,
      finishReason: 'stop',
    };
  }

  async streamResponse(
    options: LLMGenerateOptions,
    onChunk: (chunk: string) => void,
  ): Promise<LLMResponse> {
    const full = await this.generateResponse(options);
    const tokens = full.content.split(' ');
    for (const t of tokens) {
      onChunk(t + ' ');
    }
    return full;
  }

  // ==========================================
  // STT Implementation
  // ==========================================
  async transcribeAudio(options: STTTranscribeOptions): Promise<STTResult> {
    this.logger.log({ event: 'mock_stt_transcribe', language: options.language });

    return {
      fullText: 'Hello, I am calling regarding my account schedule for next week.',
      segments: [
        {
          speakerLabel: 'Caller',
          startMs: 0,
          endMs: 2800,
          text: 'Hello, I am calling regarding my account schedule for next week.',
          confidence: 0.98,
        },
      ],
      durationSeconds: 3.2,
      language: options.language || 'en-US',
    };
  }

  // ==========================================
  // TTS Implementation
  // ==========================================
  async synthesizeSpeech(options: TTSSynthesizeOptions): Promise<TTSSynthesisResult> {
    this.logger.log({ event: 'mock_tts_synthesize', textLength: options.text.length });

    // Deterministic mock audio payload
    const mockAudio = Buffer.from(`RIFF_MOCK_WAV_${options.text.slice(0, 32)}`);
    return {
      audioBuffer: mockAudio,
      mimeType: 'audio/wav',
      durationSeconds: Math.max(1, Math.round(options.text.length / 15)),
    };
  }

  // ==========================================
  // Realtime Voice Implementation
  // ==========================================
  async createSession(options: RealtimeSessionOptions): Promise<RealtimeSessionResult> {
    const sessionId = `mock-rt-sess-${Date.now()}`;
    this.activeSessions.set(sessionId, { isInterrupted: false });

    this.logger.log({ event: 'mock_realtime_session_created', sessionId, callSessionId: options.callSessionId });

    return {
      sessionId,
      provider: this.providerName,
      status: 'connected',
    };
  }

  async sendAudio(sessionId: string, _audioChunk: Buffer): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) throw new Error(`Realtime session ${sessionId} not found`);
  }

  async interrupt(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.isInterrupted = true;
      this.logger.log({ event: 'mock_realtime_interrupted', sessionId });
    }
  }

  async closeSession(sessionId: string): Promise<void> {
    this.activeSessions.delete(sessionId);
    this.logger.log({ event: 'mock_realtime_session_closed', sessionId });
  }
}
