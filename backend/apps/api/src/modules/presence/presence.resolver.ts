import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthorizationSubject, PermissionAction } from '@nexavoice/domain-types';
import { CurrentUser, RequirePermissions } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PresenceService } from './presence.service';
import { UpdatePresenceInput, UserPresenceGql } from './presence.types';

@Resolver()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PresenceResolver {
  constructor(private readonly presenceService: PresenceService) {}

  @Query(() => UserPresenceGql, { description: 'Get presence and availability for current authenticated user' })
  async myPresence(
    @CurrentUser() user: AuthorizationSubject,
  ): Promise<UserPresenceGql> {
    return this.presenceService.getUserPresence(user.id);
  }

  @Query(() => UserPresenceGql, { description: 'Get presence for a contact or target user' })
  @RequirePermissions(PermissionAction.CONTACT_READ)
  async userPresence(
    @CurrentUser() _user: AuthorizationSubject,
    @Args('userId') targetUserId: string,
  ): Promise<UserPresenceGql> {
    return this.presenceService.getUserPresence(targetUserId);
  }

  @Mutation(() => UserPresenceGql, { description: 'Update current user presence status and custom status' })
  async updatePresence(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: UpdatePresenceInput,
  ): Promise<UserPresenceGql> {
    return this.presenceService.updateStatus(user.id, input.status, input.customStatus);
  }
}
