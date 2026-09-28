import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LLMProvider,
  LLMGenerateOptions,
  LLMResponse,
} from './ai-provider.interfaces';
import { LLMProviderCapabilities } from '@nexavoice/domain-types';

/**
 * 🟣 PROVIDER-DEPENDENT
 * Carrier/Vendor adapter integrating with Anthropic Claude Messages API.
 * Requires valid ANTHROPIC_API_KEY.
 */
@Injectable()
export class AnthropicAIProvider implements LLMProvider {
  readonly providerName = 'anthropic';
  private readonly apiKey?: string;

  readonly llmCapabilities: LLMProviderCapabilities = {
    streaming: true,
    toolCalling: true,
    structuredOutput: true,
    systemPromptVersion: true,
  };

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('ai.anthropic.apiKey') || process.env.ANTHROPIC_API_KEY;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async generateResponse(options: LLMGenerateOptions): Promise<LLMResponse> {
    if (!this.isConfigured()) {
      throw new Error('Anthropic API key is unconfigured on server');
    }

    const messages = options.messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

    const body: Record<string, any> = {
      model: options.model || 'claude-3-5-sonnet-20241022',
      max_tokens: options.maxTokens || 1024,
      system: options.systemPrompt,
      messages,
      temperature: options.temperature ?? 0.7,
    };

    if (options.availableTools && options.availableTools.length > 0) {
      body.tools = options.availableTools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parametersSchema,
      }));
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic HTTP ${response.status}: ${err}`);
    }

    const json = (await response.json()) as any;
    let content = '';
    const toolInvocations: any[] = [];

    for (const block of json.content || []) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use') {
        toolInvocations.push({
          id: block.id,
          toolName: block.name,
          inputJson: JSON.stringify(block.input),
          status: 'REQUESTED' as const,
        });
      }
    }

    return {
      content,
      toolInvocations: toolInvocations.length > 0 ? toolInvocations : undefined,
      inputTokens: json.usage?.input_tokens || 0,
      outputTokens: json.usage?.output_tokens || 0,
      finishReason: json.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
    };
  }

  async streamResponse(
    options: LLMGenerateOptions,
    onChunk: (chunk: string) => void,
  ): Promise<LLMResponse> {
    const full = await this.generateResponse(options);
    onChunk(full.content);
    return full;
  }
}
