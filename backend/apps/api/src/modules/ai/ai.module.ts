import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { SecurityModule } from '../security/security.module';
import { RealtimeModule } from '../realtime/realtime.module';

import { AIToolRegistryService } from './tools/ai-tool-registry.service';
import { MockAIProvider } from './providers/mock-ai.provider';
import { OpenAIAIProvider } from './providers/openai-ai.provider';
import { AnthropicAIProvider } from './providers/anthropic-ai.provider';
import { AIAgentService } from './services/ai-agent.service';
import { AIOrchestrationService } from './services/ai-orchestration.service';
import { AIHandoffService } from './services/ai-handoff.service';
import { AIIntelligenceService } from './services/ai-intelligence.service';
import { AIWorker } from './workers/ai.worker';
import { AIResolver } from './graphql/ai.resolver';

@Module({
  imports: [DatabaseModule, SecurityModule, RealtimeModule],
  providers: [
    AIToolRegistryService,
    MockAIProvider,
    OpenAIAIProvider,
    AnthropicAIProvider,
    AIAgentService,
    AIOrchestrationService,
    AIHandoffService,
    AIIntelligenceService,
    AIWorker,
    AIResolver,
  ],
  exports: [
    AIAgentService,
    AIOrchestrationService,
    AIHandoffService,
    AIIntelligenceService,
    AIToolRegistryService,
    MockAIProvider,
  ],
})
export class AIModule {}
