import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthorizationSubject } from '@nexavoice/domain-types';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { NotificationsService } from './notifications.service';
import {
  NotificationConnectionGql,
  NotificationGql,
  NotificationPreferenceGql,
  UpdateNotificationPreferenceInput,
} from './notifications.types';

@Resolver()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsResolver {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Query(() => NotificationConnectionGql, { description: 'Get paginated notifications for current user' })
  async notifications(
    @CurrentUser() user: AuthorizationSubject,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 20 }) limit: number,
    @Args('offset', { type: () => Int, nullable: true, defaultValue: 0 }) offset: number,
    @Args('unreadOnly', { type: () => Boolean, nullable: true, defaultValue: false }) unreadOnly: boolean,
  ): Promise<NotificationConnectionGql> {
    return this.notificationsService.getUserNotifications(user.id, limit, offset, unreadOnly);
  }

  @Query(() => Int, { description: 'Get unread notification count for current user' })
  async unreadNotificationCount(
    @CurrentUser() user: AuthorizationSubject,
  ): Promise<number> {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Query(() => NotificationPreferenceGql, { description: 'Get notification preferences for current user' })
  async notificationPreferences(
    @CurrentUser() user: AuthorizationSubject,
  ): Promise<NotificationPreferenceGql> {
    return this.notificationsService.getNotificationPreferences(user.id);
  }

  @Mutation(() => NotificationGql, { description: 'Mark a notification as read' })
  async markNotificationAsRead(
    @CurrentUser() user: AuthorizationSubject,
    @Args('id', { type: () => ID }) notificationId: string,
  ): Promise<NotificationGql> {
    return this.notificationsService.markAsRead(user.id, notificationId);
  }

  @Mutation(() => Int, { description: 'Mark all notifications as read for current user' })
  async markAllNotificationsAsRead(
    @CurrentUser() user: AuthorizationSubject,
  ): Promise<number> {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Mutation(() => NotificationPreferenceGql, { description: 'Update notification preferences for current user' })
  async updateNotificationPreferences(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: UpdateNotificationPreferenceInput,
  ): Promise<NotificationPreferenceGql> {
    return this.notificationsService.updateNotificationPreferences(user.id, input);
  }
}
