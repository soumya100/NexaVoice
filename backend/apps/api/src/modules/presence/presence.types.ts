import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { PresenceStatus, UserAvailability } from '@nexavoice/domain-types';

registerEnumType(PresenceStatus, {
  name: 'PresenceStatus',
  description: 'Realtime user presence status',
});

registerEnumType(UserAvailability, {
  name: 'UserAvailability',
  description: 'User availability for communication and call routing',
});

@ObjectType()
export class UserPresenceGql {
  @Field()
  userId!: string;

  @Field(() => PresenceStatus)
  status!: PresenceStatus;

  @Field({ nullable: true })
  customStatus?: string;

  @Field()
  activeDeviceCount!: number;

  @Field()
  lastHeartbeatAt!: string;

  @Field()
  isOnline!: boolean;

  @Field(() => UserAvailability)
  availability!: UserAvailability;
}

@InputType()
export class UpdatePresenceInput {
  @Field(() => PresenceStatus)
  status!: PresenceStatus;

  @Field({ nullable: true })
  customStatus?: string;
}
