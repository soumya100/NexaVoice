import { Field, ID, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  ContactRelationshipStatus,
  PrivacyLevel,
} from '@nexavoice/domain-types';

registerEnumType(ContactRelationshipStatus, {
  name: 'ContactRelationshipStatus',
  description: 'Status of contact relationship between two users',
});

registerEnumType(PrivacyLevel, {
  name: 'PrivacyLevel',
  description: 'Privacy boundary level (EVERYONE, CONTACTS_ONLY, NOBODY)',
});

@ObjectType('ContactUserSummary')
export class ContactUserSummaryGql {
  @Field(() => ID)
  id!: string;

  @Field()
  nexaVoiceId!: string;

  @Field()
  username!: string;

  @Field()
  displayName!: string;

  @Field({ nullable: true })
  avatarUrl?: string;

  @Field({ nullable: true })
  isOnline?: boolean;
}

@ObjectType('ContactRelationship')
export class ContactRelationshipGql {
  @Field(() => ID)
  id!: string;

  @Field()
  requesterId!: string;

  @Field()
  recipientId!: string;

  @Field(() => ContactRelationshipStatus)
  status!: ContactRelationshipStatus;

  @Field({ nullable: true })
  nickname?: string;

  @Field()
  createdAt!: string;

  @Field({ nullable: true })
  acceptedAt?: string;

  @Field(() => ContactUserSummaryGql)
  contact!: ContactUserSummaryGql;
}

@ObjectType('ContactRequest')
export class ContactRequestGql {
  @Field(() => ID)
  id!: string;

  @Field()
  requesterId!: string;

  @Field()
  recipientId!: string;

  @Field(() => ContactRelationshipStatus)
  status!: ContactRelationshipStatus;

  @Field()
  createdAt!: string;

  @Field(() => ContactUserSummaryGql)
  requester!: ContactUserSummaryGql;

  @Field(() => ContactUserSummaryGql)
  recipient!: ContactUserSummaryGql;
}

@ObjectType('BlockedUserEntry')
export class BlockedUserEntryGql {
  @Field(() => ID)
  id!: string;

  @Field()
  blockedId!: string;

  @Field({ nullable: true })
  reason?: string;

  @Field()
  createdAt!: string;

  @Field(() => ContactUserSummaryGql)
  user!: ContactUserSummaryGql;
}

@ObjectType('UserPrivacySettings')
export class UserPrivacySettingsGql {
  @Field(() => ID)
  id!: string;

  @Field()
  userId!: string;

  @Field()
  discoverableByNexaVoiceId!: boolean;

  @Field()
  discoverableByUsername!: boolean;

  @Field()
  discoverableByEmail!: boolean;

  @Field()
  discoverableByPhone!: boolean;

  @Field(() => PrivacyLevel)
  whoCanMessageMe!: PrivacyLevel;

  @Field(() => PrivacyLevel)
  whoCanAddMeToGroups!: PrivacyLevel;

  @Field()
  readReceiptsEnabled!: boolean;

  @Field()
  typingIndicatorsEnabled!: boolean;

  @Field()
  updatedAt!: string;
}

@ObjectType('ContactDiscoveryResult')
export class ContactDiscoveryResultGql {
  @Field(() => ID)
  id!: string;

  @Field()
  nexaVoiceId!: string;

  @Field()
  username!: string;

  @Field()
  displayName!: string;

  @Field({ nullable: true })
  avatarUrl?: string;

  @Field(() => ContactRelationshipStatus, { nullable: true })
  relationshipStatus?: ContactRelationshipStatus;

  @Field()
  isBlocked!: boolean;
}

@InputType('SendContactRequestInput')
export class SendContactRequestInput {
  @Field({ description: 'NexaVoice ID or username of recipient' })
  identifier!: string;

  @Field({ nullable: true, description: 'Optional contact nickname/label' })
  nickname?: string;
}

@InputType('UpdatePrivacySettingsInput')
export class UpdatePrivacySettingsInput {
  @Field({ nullable: true })
  discoverableByNexaVoiceId?: boolean;

  @Field({ nullable: true })
  discoverableByUsername?: boolean;

  @Field({ nullable: true })
  discoverableByEmail?: boolean;

  @Field({ nullable: true })
  discoverableByPhone?: boolean;

  @Field(() => PrivacyLevel, { nullable: true })
  whoCanMessageMe?: PrivacyLevel;

  @Field(() => PrivacyLevel, { nullable: true })
  whoCanAddMeToGroups?: PrivacyLevel;

  @Field({ nullable: true })
  readReceiptsEnabled?: boolean;

  @Field({ nullable: true })
  typingIndicatorsEnabled?: boolean;
}

@InputType('AddressBookEntryInput')
export class AddressBookEntryInput {
  @Field({ description: 'SHA256 hash of normalized phone number or email' })
  identifierHash!: string;

  @Field({ nullable: true, description: 'Client-side contact name' })
  clientContactName?: string;
}

@InputType('SyncAddressBookInput')
export class SyncAddressBookInput {
  @Field(() => [AddressBookEntryInput])
  entries!: AddressBookEntryInput[];
}

@ObjectType('AddressBookMatchResult')
export class AddressBookMatchResultGql {
  @Field()
  identifierHash!: string;

  @Field(() => ContactUserSummaryGql, { nullable: true })
  matchedUser?: ContactUserSummaryGql;
}
