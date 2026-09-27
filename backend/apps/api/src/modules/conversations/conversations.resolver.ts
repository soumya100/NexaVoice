import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthorizationSubject, PermissionAction } from '@nexavoice/domain-types';
import { CurrentUser, RequirePermissions } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ConversationsService } from './conversations.service';
import {
  AddParticipantInput,
  ConversationGql,
  CreateDirectConversationInput,
  CreateGroupConversationInput,
  RemoveParticipantInput,
  UpdateConversationInput,
} from './conversations.types';

@Resolver()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ConversationsResolver {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Query(() => [ConversationGql], { description: 'Get all active conversations for the current user' })
  @RequirePermissions(PermissionAction.CONVERSATION_READ)
  async conversations(
    @CurrentUser() user: AuthorizationSubject,
  ): Promise<ConversationGql[]> {
    return this.conversationsService.getUserConversations(user.id);
  }

  @Query(() => ConversationGql, { description: 'Get details for a specific conversation' })
  @RequirePermissions(PermissionAction.CONVERSATION_READ)
  async conversation(
    @CurrentUser() user: AuthorizationSubject,
    @Args('id') conversationId: string,
  ): Promise<ConversationGql> {
    return this.conversationsService.getConversationById(user.id, conversationId);
  }

  @Mutation(() => ConversationGql, { description: 'Get or create deterministic direct conversation' })
  @RequirePermissions(PermissionAction.CONVERSATION_WRITE)
  async createDirectConversation(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: CreateDirectConversationInput,
  ): Promise<ConversationGql> {
    return this.conversationsService.getOrCreateDirectConversation(user.id, input);
  }

  @Mutation(() => ConversationGql, { description: 'Create a new group conversation' })
  @RequirePermissions(PermissionAction.CONVERSATION_WRITE)
  async createGroupConversation(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: CreateGroupConversationInput,
  ): Promise<ConversationGql> {
    return this.conversationsService.createGroupConversation(user.id, input);
  }

  @Mutation(() => ConversationGql, { description: 'Add participant to group conversation' })
  @RequirePermissions(PermissionAction.CONVERSATION_WRITE)
  async addConversationParticipant(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: AddParticipantInput,
  ): Promise<ConversationGql> {
    return this.conversationsService.addParticipant(user.id, input);
  }

  @Mutation(() => Boolean, { description: 'Remove participant from group conversation' })
  @RequirePermissions(PermissionAction.CONVERSATION_WRITE)
  async removeConversationParticipant(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: RemoveParticipantInput,
  ): Promise<boolean> {
    return this.conversationsService.removeParticipant(user.id, input);
  }

  @Mutation(() => Boolean, { description: 'Leave conversation' })
  @RequirePermissions(PermissionAction.CONVERSATION_WRITE)
  async leaveConversation(
    @CurrentUser() user: AuthorizationSubject,
    @Args('conversationId') conversationId: string,
  ): Promise<boolean> {
    return this.conversationsService.removeParticipant(user.id, {
      conversationId,
      userId: user.id,
    });
  }

  @Mutation(() => ConversationGql, { description: 'Update conversation settings' })
  @RequirePermissions(PermissionAction.CONVERSATION_WRITE)
  async updateConversation(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: UpdateConversationInput,
  ): Promise<ConversationGql> {
    return this.conversationsService.updateConversation(user.id, input);
  }
}
