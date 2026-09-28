# Real-Time AI Voice & Provider Abstractions

## Provider Abstractions
NexaVoice isolates all AI vendor APIs behind four standardized provider interfaces in `backend/apps/api/src/modules/ai/providers/ai-provider.interfaces.ts`:

### 1. LLMProvider
* `providerName`: Unique provider identifier.
* `llmCapabilities`: Capability flags (`streaming`, `toolCalling`, `structuredOutput`, `systemPromptVersion`).
* `generateResponse(options)`: Synchronous turn generation.
* `streamResponse(options, onChunk)`: Low-latency streaming token delivery.

### 2. SpeechToTextProvider (STT)
* `providerName`: Vendor identifier.
* `sttCapabilities`: Capability flags (`streaming`, `partialResults`, `speakerDiarization`, `wordTimestamps`).
* `transcribeAudio(options)`: High-fidelity audio transcription returning timed segments and speaker attribution.

### 3. TextToSpeechProvider (TTS)
* `providerName`: Vendor identifier.
* `ttsCapabilities`: Capability flags (`streaming`, `customVoices`, `speedControl`, `pitchControl`).
* `synthesizeSpeech(options)`: Audio buffer generation with specified persona, speed, and pitch.

### 4. RealtimeVoiceProvider
* `providerName`: Vendor identifier.
* `realtimeCapabilities`: Capability flags (`bargeIn`, `serverVAD`, `clientVAD`, `audioStreaming`).
* `createSession(options)`: Direct bidirectional WebRTC/WebSocket audio session.
* `sendAudio(sessionId, audioChunk)`: Inbound caller audio streaming.
* `interrupt(sessionId)`: Halts ongoing audio playback upon barge-in detection.
* `closeSession(sessionId)`: Session termination.

## Provider Adapters & Classifications

| Adapter | Capability Class | Status | Dependencies |
| :--- | :--- | :--- | :--- |
| `MockAIProvider` | LLM, STT, TTS, Realtime | `🟠 MOCK / TEST DOUBLE` | None (In-memory deterministic test double) |
| `OpenAIAIProvider` | LLM, STT (Whisper), TTS | `🟣 PROVIDER-DEPENDENT` | `OPENAI_API_KEY`, OpenAI REST APIs |
| `AnthropicAIProvider` | LLM (Claude Messages) | `🟣 PROVIDER-DEPENDENT` | `ANTHROPIC_API_KEY`, Anthropic REST APIs |

## Barge-In & Voice Activity Detection (VAD)
When a human caller speaks during AI synthesis:
1. VAD or the media bridge detects inbound speech energy above the noise floor.
2. The orchestrator triggers `interruptSession(sessionId)`.
3. The AI audio buffer stream is halted immediately at the media gateway.
4. An `ai.interruption.detected` event is broadcast over the signaling plane.
5. Inbound caller speech is processed as a fresh dialogue turn without forcing the user to wait for AI completion.
