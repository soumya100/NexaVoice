import { Field, ID, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { NotificationPriority, NotificationType } from '@nexavoice/domain-types';
import { ContactUserSummaryGql } from '../contacts/contacts.types';

registerEnumType(NotificationType, {
  name: 'NotificationType',
  description: 'Types of system and social notifications',
});

registerEnumType(NotificationPriority, {
  name: 'NotificationPriority',
  description: 'Priority level for notifications',
});

@ObjectType('Notification')
export class NotificationGql {
  @Field(() => ID)
  id!: string;

  @Field()
  userId!: string;

  @Field({ nullable: true })
  actorId?: string;

  @Field(() => ContactUserSummaryGql, { nullable: true })
  actor?: ContactUserSummaryGql;

  @Field(() => NotificationType)
  type!: NotificationType;

  @Field()
  title!: string;

  @Field()
  body!: string;

  @Field(() => NotificationPriority)
  priority!: NotificationPriority;

  @Field({ nullable: true })
  dataJson?: string;

  @Field()
  isRead!: boolean;

  @Field({ nullable: true })
  readAt?: string;

  @Field()
  createdAt!: string;
}

@ObjectType('NotificationConnection')
export class NotificationConnectionGql {
  @Field(() => [NotificationGql])
  items!: NotificationGql[];

  @Field(() => Int)
  totalCount!: number;

  @Field(() => Int)
  unreadCount!: number;
}

@ObjectType('NotificationPreference')
export class NotificationPreferenceGql {
  @Field(() => ID)
  id!: string;

  @Field()
  userId!: string;

  @Field()
  messagesInApp!: boolean;

  @Field()
  messagesEmail!: boolean;

  @Field()
  callsInApp!: boolean;

  @Field()
  callsEmail!: boolean;

  @Field()
  contactRequestsInApp!: boolean;

  @Field()
  contactRequestsEmail!: boolean;

  @Field()
  mentionsInApp!: boolean;

  @Field()
  mentionsEmail!: boolean;

  @Field()
  aiSummariesInApp!: boolean;

  @Field()
  aiSummariesEmail!: boolean;

  @Field()
  globalMute!: boolean;

  @Field({ nullable: true })
  muteUntil?: string;
}

@InputType('UpdateNotificationPreferenceInput')
export class UpdateNotificationPreferenceInput {
  @Field({ nullable: true })
  messagesInApp?: boolean;

  @Field({ nullable: true })
  messagesEmail?: boolean;

  @Field({ nullable: true })
  callsInApp?: boolean;

  @Field({ nullable: true })
  callsEmail?: boolean;

  @Field({ nullable: true })
  contactRequestsInApp?: boolean;

  @Field({ nullable: true })
  contactRequestsEmail?: boolean;

  @Field({ nullable: true })
  mentionsInApp?: boolean;

  @Field({ nullable: true })
  mentionsEmail?: boolean;

  @Field({ nullable: true })
  aiSummariesInApp?: boolean;

  @Field({ nullable: true })
  aiSummariesEmail?: boolean;

  @Field({ nullable: true })
  globalMute?: boolean;

  @Field({ nullable: true })
  muteUntil?: string;
}
