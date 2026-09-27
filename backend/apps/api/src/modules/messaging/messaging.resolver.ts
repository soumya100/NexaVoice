import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthorizationSubject, PermissionAction } from '@nexavoice/domain-types';
import { CurrentUser, RequirePermissions } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { MessagingService } from './messaging.service';
import { AttachmentsService } from './attachments.service';
import { LinkPreviewService } from './link-preview.service';
import { SearchService } from './search.service';
import {
  EditMessageInput,
  LinkPreviewResultGql,
  MessageConnectionGql,
  MessageGql,
  MessagesPaginationInput,
  ReportContentInput,
  ReportResultGql,
  SendMessageInput,
  UploadAttachmentInitInput,
  UploadAttachmentInitResultGql,
} from './messaging.types';

@Resolver()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MessagingResolver {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly attachmentsService: AttachmentsService,
    private readonly linkPreviewService: LinkPreviewService,
    private readonly searchService: SearchService,
  ) {}

  @Query(() => MessageConnectionGql, { description: 'Get paginated messages for a conversation' })
  @RequirePermissions(PermissionAction.MESSAGE_READ)
  async messages(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: MessagesPaginationInput,
  ): Promise<MessageConnectionGql> {
    return this.messagingService.getMessages(user.id, input);
  }

  @Query(() => [MessageGql], { description: 'Search messages across user conversations' })
  @RequirePermissions(PermissionAction.MESSAGE_READ)
  async searchMessages(
    @CurrentUser() user: AuthorizationSubject,
    @Args('query') query: string,
    @Args('conversationId', { nullable: true }) conversationId?: string,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 20 }) limit?: number,
  ): Promise<MessageGql[]> {
    return this.searchService.searchMessages(user.id, query, { conversationId, limit });
  }

  @Query(() => LinkPreviewResultGql, { description: 'Generate SSRF-safe link preview metadata' })
  async linkPreview(@Args('url') url: string): Promise<LinkPreviewResultGql> {
    return this.linkPreviewService.getLinkPreview(url);
  }

  @Mutation(() => MessageGql, { description: 'Send a message with client-side idempotency' })
  @RequirePermissions(PermissionAction.MESSAGE_SEND)
  async sendMessage(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: SendMessageInput,
  ): Promise<MessageGql> {
    return this.messagingService.sendMessage(user.id, input);
  }

  @Mutation(() => MessageGql, { description: 'Edit message content' })
  @RequirePermissions(PermissionAction.MESSAGE_EDIT)
  async editMessage(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: EditMessageInput,
  ): Promise<MessageGql> {
    return this.messagingService.editMessage(user.id, input);
  }

  @Mutation(() => Boolean, { description: 'Soft-delete message for everyone' })
  @RequirePermissions(PermissionAction.MESSAGE_DELETE)
  async deleteMessage(
    @CurrentUser() user: AuthorizationSubject,
    @Args('messageId') messageId: string,
  ): Promise<boolean> {
    return this.messagingService.deleteMessage(user.id, messageId);
  }

  @Mutation(() => MessageGql, { description: 'Add reaction emoji to a message' })
  @RequirePermissions(PermissionAction.MESSAGE_SEND)
  async addReaction(
    @CurrentUser() user: AuthorizationSubject,
    @Args('messageId') messageId: string,
    @Args('reaction') reaction: string,
  ): Promise<MessageGql> {
    return this.messagingService.addReaction(user.id, messageId, reaction);
  }

  @Mutation(() => MessageGql, { description: 'Remove reaction emoji from a message' })
  @RequirePermissions(PermissionAction.MESSAGE_SEND)
  async removeReaction(
    @CurrentUser() user: AuthorizationSubject,
    @Args('messageId') messageId: string,
    @Args('reaction') reaction: string,
  ): Promise<MessageGql> {
    return this.messagingService.removeReaction(user.id, messageId, reaction);
  }

  @Mutation(() => Boolean, { description: 'Update conversation read cursor' })
  @RequirePermissions(PermissionAction.MESSAGE_READ)
  async markConversationRead(
    @CurrentUser() user: AuthorizationSubject,
    @Args('conversationId') conversationId: string,
    @Args('lastMessageId', { nullable: true }) lastMessageId?: string,
  ): Promise<boolean> {
    return this.messagingService.markConversationRead(user.id, conversationId, lastMessageId);
  }

  @Mutation(() => UploadAttachmentInitResultGql, {
    description: 'Initialize secure pre-signed attachment upload target',
  })
  @RequirePermissions(PermissionAction.MESSAGE_SEND)
  async initAttachmentUpload(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: UploadAttachmentInitInput,
  ): Promise<UploadAttachmentInitResultGql> {
    return this.attachmentsService.initializeUpload(user.id, input);
  }

  @Mutation(() => ReportResultGql, { description: 'File content or user moderation report' })
  async reportContent(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: ReportContentInput,
  ): Promise<ReportResultGql> {
    return this.messagingService.reportContent(user.id, input);
  }
}
