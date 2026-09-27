import { Field, ID, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { ConversationRole, ConversationType } from '@nexavoice/domain-types';
import { ContactUserSummaryGql } from '../contacts/contacts.types';

registerEnumType(ConversationType, {
  name: 'ConversationType',
  description: 'Type of conversation: DIRECT, GROUP, or FUTURE_ROOM',
});

registerEnumType(ConversationRole, {
  name: 'ConversationRole',
  description: 'Role within conversation: OWNER, ADMIN, MEMBER',
});

@ObjectType('ConversationParticipant')
export class ConversationParticipantGql {
  @Field(() => ID)
  id!: string;

  @Field()
  conversationId!: string;

  @Field()
  userId!: string;

  @Field(() => ConversationRole)
  conversationRole!: ConversationRole;

  @Field()
  joinedAt!: string;

  @Field({ nullable: true })
  lastDeliveredMessageId?: string;

  @Field({ nullable: true })
  lastReadMessageId?: string;

  @Field({ nullable: true })
  lastReadAt?: string;

  @Field()
  isMuted!: boolean;

  @Field(() => ContactUserSummaryGql)
  user!: ContactUserSummaryGql;
}

@ObjectType('Conversation')
export class ConversationGql {
  @Field(() => ID)
  id!: string;

  @Field(() => ConversationType)
  type!: ConversationType;

  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  avatarUrl?: string;

  @Field({ nullable: true })
  creatorId?: string;

  @Field(() => Int)
  currentSequence!: number;

  @Field({ nullable: true })
  lastMessageAt?: string;

  @Field({ nullable: true })
  lastMessageSnippet?: string;

  @Field(() => Int)
  unreadCount!: number;

  @Field(() => [ConversationParticipantGql])
  participants!: ConversationParticipantGql[];

  @Field()
  createdAt!: string;

  @Field()
  updatedAt!: string;
}

@InputType('CreateDirectConversationInput')
export class CreateDirectConversationInput {
  @Field({ description: 'Target user ID or NexaVoice ID' })
  targetUserId!: string;
}

@InputType('CreateGroupConversationInput')
export class CreateGroupConversationInput {
  @Field({ description: 'Title or name of the group' })
  title!: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  avatarUrl?: string;

  @Field(() => [String], { description: 'User IDs to invite into the group' })
  participantUserIds!: string[];
}

@InputType('AddParticipantInput')
export class AddParticipantInput {
  @Field(() => ID)
  conversationId!: string;

  @Field(() => ID)
  userId!: string;

  @Field(() => ConversationRole, { nullable: true, defaultValue: ConversationRole.MEMBER })
  role?: ConversationRole;
}

@InputType('RemoveParticipantInput')
export class RemoveParticipantInput {
  @Field(() => ID)
  conversationId!: string;

  @Field(() => ID)
  userId!: string;
}

@InputType('UpdateConversationInput')
export class UpdateConversationInput {
  @Field(() => ID)
  conversationId!: string;

  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  avatarUrl?: string;

  @Field({ nullable: true })
  isMuted?: boolean;
}
