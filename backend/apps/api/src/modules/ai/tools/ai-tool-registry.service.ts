import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { AIToolDefinition, AIToolInvocation } from '@nexavoice/domain-types';
import { SecurityAuditService } from '../../security/security-audit.service';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service';

export interface ToolExecutionHandler {
  (params: Record<string, any>, context: { userId: string; callSessionId: string }): Promise<Record<string, any>>;
}

@Injectable()
export class AIToolRegistryService {
  private readonly logger = new StructuredLogger('AIToolRegistry');
  private readonly tools = new Map<
    string,
    { definition: AIToolDefinition; handler: ToolExecutionHandler }
  >();

  constructor(
    private readonly auditService: SecurityAuditService,
  ) {
    this.registerBuiltinTools();
  }

  /**
   * Registers standard built-in tools with strict parameter schemas.
   */
  private registerBuiltinTools() {
    this.registerTool(
      {
        name: 'lookupCustomer',
        description: 'Lookup customer account profile and contact details by customerId or email.',
        parametersSchema: {
          type: 'object',
          properties: {
            customerId: { type: 'string' },
            email: { type: 'string' },
          },
          required: [],
        },
        isPrivileged: false,
        requiresConfirmation: false,
      },
      async (params) => {
        const id = params.customerId || 'cust-demo-1';
        return {
          customerId: id,
          fullName: 'Acme Corp Contact',
          tier: 'Enterprise',
          accountStatus: 'Active',
          lastContactDate: new Date().toISOString().split('T')[0],
        };
      },
    );

    this.registerTool(
      {
        name: 'scheduleFollowUp',
        description: 'Schedule a follow-up consultation or call back with the customer.',
        parametersSchema: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'YYYY-MM-DD format' },
            time: { type: 'string', description: 'HH:MM format' },
            topic: { type: 'string' },
          },
          required: ['date', 'topic'],
        },
        isPrivileged: false,
        requiresConfirmation: true,
      },
      async (params) => {
        return {
          scheduledId: `sched-${Date.now()}`,
          date: params.date,
          time: params.time || '10:00',
          topic: params.topic,
          confirmationStatus: 'CONFIRMED',
        };
      },
    );

    this.registerTool(
      {
        name: 'checkAvailability',
        description: 'Check available time slots for customer support or account managers.',
        parametersSchema: {
          type: 'object',
          properties: {
            date: { type: 'string' },
          },
          required: ['date'],
        },
        isPrivileged: false,
        requiresConfirmation: false,
      },
      async (params) => {
        return {
          date: params.date,
          availableSlots: ['09:00 AM', '11:30 AM', '02:00 PM', '04:30 PM'],
          timezone: 'UTC',
        };
      },
    );

    this.registerTool(
      {
        name: 'transferToHuman',
        description: 'Escalate and transfer the active call to a human specialist or queue.',
        parametersSchema: {
          type: 'object',
          properties: {
            reason: { type: 'string' },
            department: { type: 'string' },
          },
          required: ['reason'],
        },
        isPrivileged: true,
        requiresConfirmation: false,
      },
      async (params) => {
        return {
          transferInitiated: true,
          reason: params.reason,
          targetDepartment: params.department || 'General Support',
          timestamp: new Date().toISOString(),
        };
      },
    );

    this.registerTool(
      {
        name: 'transferCall',
        description: 'Transfer active call leg to a human operator or specialist.',
        parametersSchema: {
          type: 'object',
          properties: {
            targetUserId: { type: 'string' },
            reason: { type: 'string' },
          },
          required: [],
        },
        isPrivileged: true,
        requiresConfirmation: false,
      },
      async (params) => {
        return {
          transferRequested: true,
          targetUserId: params.targetUserId || 'agent_pool_tier1',
          timestamp: new Date().toISOString(),
        };
      },
    );
  }

  registerTool(definition: AIToolDefinition, handler: ToolExecutionHandler) {
    this.tools.set(definition.name, { definition, handler });
  }

  getToolDefinitions(allowlist?: string[]): AIToolDefinition[] {
    const list: AIToolDefinition[] = [];
    for (const [name, entry] of this.tools.entries()) {
      if (!allowlist || allowlist.includes(name)) {
        list.push(entry.definition);
      }
    }
    return list;
  }

  /**
   * Executes an authorized tool call with schema validation, allowlist enforcement,
   * and result sanitization.
   */
  async executeTool(
    invocation: AIToolInvocation,
    context: {
      userId: string;
      callSessionId: string;
      agentId: string;
      agentAllowlist: string[];
    },
  ): Promise<{ result: Record<string, any>; sanitizedResult: Record<string, any> }> {
    const toolName = invocation.toolName;
    const entry = this.tools.get(toolName);

    if (!entry) {
      throw new BadRequestException(`Unknown AI tool: ${toolName}`);
    }

    // 1. Enforce agent allowlist: agent can only invoke explicitly allowlisted tools
    if (!context.agentAllowlist.includes(toolName)) {
      await this.auditService.logEvent({
        action: 'AI_UNAUTHORIZED_TOOL_INVOCATION_BLOCKED',
        actorId: context.userId,
        targetType: 'AIAgent',
        targetId: context.agentId,
        result: 'FAILURE',
        metadata: { toolName, invocationId: invocation.id },
      });
      throw new ForbiddenException(
        `Agent is not permitted to execute tool "${toolName}". Tool is not in agent allowlist.`,
      );
    }

    // 2. Validate input parameters against schema
    let parsedInput: Record<string, any>;
    try {
      parsedInput = JSON.parse(invocation.inputJson || '{}');
    } catch {
      throw new BadRequestException(`Malformed JSON input for tool: ${toolName}`);
    }

    const schema = entry.definition.parametersSchema;
    if (schema.required && Array.isArray(schema.required)) {
      for (const reqField of schema.required) {
        if (parsedInput[reqField] === undefined || parsedInput[reqField] === null) {
          throw new BadRequestException(
            `Tool "${toolName}" validation error: missing required parameter "${reqField}"`,
          );
        }
      }
    }

    this.logger.log({
      event: 'ai_tool_executing',
      toolName,
      agentId: context.agentId,
      callSessionId: context.callSessionId,
    });

    // 3. Execute handler
    const rawResult = await entry.handler(parsedInput, {
      userId: context.userId,
      callSessionId: context.callSessionId,
    });

    // 4. Sanitize tool results: strip credentials, secret tokens, and private keys
    const sanitized = this.sanitizeToolOutput(rawResult);

    await this.auditService.logEvent({
      action: 'AI_TOOL_EXECUTED',
      actorId: context.userId,
      targetType: 'CallSession',
      targetId: context.callSessionId,
      result: 'SUCCESS',
      metadata: { toolName, invocationId: invocation.id },
    });

    return { result: rawResult, sanitizedResult: sanitized };
  }

  /**
   * Sanitizes sensitive fields before returning tool results to the LLM context.
   */
  private sanitizeToolOutput(data: Record<string, any>): Record<string, any> {
    const sensitiveKeys = new Set([
      'password',
      'secret',
      'token',
      'apiKey',
      'api_key',
      'authToken',
      'jwt',
      'ssn',
      'creditCard',
    ]);

    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (sensitiveKeys.has(k.toLowerCase())) {
        sanitized[k] = '[REDACTED]';
      } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        sanitized[k] = this.sanitizeToolOutput(v);
      } else {
        sanitized[k] = v;
      }
    }
    return sanitized;
  }
}
