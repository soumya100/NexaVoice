import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthorizationSubject, PermissionAction } from '@nexavoice/domain-types';
import { CurrentUser, RequirePermissions } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ContactsService } from './contacts.service';
import {
  AddressBookMatchResultGql,
  BlockedUserEntryGql,
  ContactDiscoveryResultGql,
  ContactRelationshipGql,
  ContactRequestGql,
  SendContactRequestInput,
  SyncAddressBookInput,
  UpdatePrivacySettingsInput,
  UserPrivacySettingsGql,
} from './contacts.types';

@Resolver()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ContactsResolver {
  constructor(private readonly contactsService: ContactsService) {}

  @Query(() => [ContactRelationshipGql], { description: 'Get all accepted contacts' })
  @RequirePermissions(PermissionAction.CONTACT_READ)
  async contacts(
    @CurrentUser() user: AuthorizationSubject,
  ): Promise<ContactRelationshipGql[]> {
    return this.contactsService.getContacts(user.id);
  }

  @Query(() => [ContactRequestGql], { description: 'Get pending contact requests' })
  @RequirePermissions(PermissionAction.CONTACT_READ)
  async contactRequests(
    @CurrentUser() user: AuthorizationSubject,
    @Args('filter', { type: () => String, nullable: true, defaultValue: 'all' })
    filter: 'incoming' | 'outgoing' | 'all',
  ): Promise<ContactRequestGql[]> {
    return this.contactsService.getContactRequests(user.id, filter);
  }

  @Query(() => [BlockedUserEntryGql], { description: 'Get list of blocked users' })
  @RequirePermissions(PermissionAction.CONTACT_READ)
  async blockedUsers(
    @CurrentUser() user: AuthorizationSubject,
  ): Promise<BlockedUserEntryGql[]> {
    return this.contactsService.getBlockedUsers(user.id);
  }

  @Query(() => [ContactDiscoveryResultGql], {
    description: 'Privacy-aware contact and user discovery',
  })
  @RequirePermissions(PermissionAction.CONTACT_READ)
  async discoverUsers(
    @CurrentUser() user: AuthorizationSubject,
    @Args('query') query: string,
  ): Promise<ContactDiscoveryResultGql[]> {
    return this.contactsService.discoverUsers(user.id, query);
  }

  @Query(() => UserPrivacySettingsGql, { description: 'Get current user privacy settings' })
  async myPrivacySettings(
    @CurrentUser() user: AuthorizationSubject,
  ): Promise<UserPrivacySettingsGql> {
    return this.contactsService.getPrivacySettings(user.id);
  }

  @Mutation(() => ContactRelationshipGql, { description: 'Send a contact request' })
  @RequirePermissions(PermissionAction.CONTACT_MANAGE)
  async sendContactRequest(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: SendContactRequestInput,
  ): Promise<ContactRelationshipGql> {
    return this.contactsService.sendContactRequest(user.id, input);
  }

  @Mutation(() => ContactRelationshipGql, { description: 'Accept a contact request' })
  @RequirePermissions(PermissionAction.CONTACT_MANAGE)
  async acceptContactRequest(
    @CurrentUser() user: AuthorizationSubject,
    @Args('requestId') requestId: string,
  ): Promise<ContactRelationshipGql> {
    return this.contactsService.acceptContactRequest(user.id, requestId);
  }

  @Mutation(() => Boolean, { description: 'Reject a contact request' })
  @RequirePermissions(PermissionAction.CONTACT_MANAGE)
  async rejectContactRequest(
    @CurrentUser() user: AuthorizationSubject,
    @Args('requestId') requestId: string,
  ): Promise<boolean> {
    return this.contactsService.rejectContactRequest(user.id, requestId);
  }

  @Mutation(() => Boolean, { description: 'Remove a contact' })
  @RequirePermissions(PermissionAction.CONTACT_MANAGE)
  async removeContact(
    @CurrentUser() user: AuthorizationSubject,
    @Args('contactUserId') contactUserId: string,
  ): Promise<boolean> {
    return this.contactsService.removeContact(user.id, contactUserId);
  }

  @Mutation(() => Boolean, { description: 'Block a user' })
  @RequirePermissions(PermissionAction.CONTACT_MANAGE)
  async blockUser(
    @CurrentUser() user: AuthorizationSubject,
    @Args('userId') targetUserId: string,
    @Args('reason', { nullable: true }) reason?: string,
  ): Promise<boolean> {
    return this.contactsService.blockUser(user.id, targetUserId, reason);
  }

  @Mutation(() => Boolean, { description: 'Unblock a user' })
  @RequirePermissions(PermissionAction.CONTACT_MANAGE)
  async unblockUser(
    @CurrentUser() user: AuthorizationSubject,
    @Args('userId') targetUserId: string,
  ): Promise<boolean> {
    return this.contactsService.unblockUser(user.id, targetUserId);
  }

  @Mutation(() => UserPrivacySettingsGql, { description: 'Update user privacy settings' })
  async updatePrivacySettings(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: UpdatePrivacySettingsInput,
  ): Promise<UserPrivacySettingsGql> {
    return this.contactsService.updatePrivacySettings(user.id, input);
  }

  @Mutation(() => [AddressBookMatchResultGql], {
    description: 'Privacy-preserving address book matching using hashed identifiers',
  })
  @RequirePermissions(PermissionAction.CONTACT_READ)
  async syncAddressBook(
    @CurrentUser() user: AuthorizationSubject,
    @Args('input') input: SyncAddressBookInput,
  ): Promise<AddressBookMatchResultGql[]> {
    return this.contactsService.syncAddressBook(user.id, input);
  }
}
