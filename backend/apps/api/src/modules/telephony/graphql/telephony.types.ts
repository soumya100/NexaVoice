import { Field, ID, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  PhoneNumberType,
  PhoneNumberStatus,
  PhoneNumberAssignmentType,
  RoutingTargetType,
  VoicemailStatus,
} from '@nexavoice/domain-types';

registerEnumType(PhoneNumberType, { name: 'PhoneNumberType' });
registerEnumType(PhoneNumberStatus, { name: 'PhoneNumberStatus' });
registerEnumType(PhoneNumberAssignmentType, { name: 'PhoneNumberAssignmentType' });
registerEnumType(RoutingTargetType, { name: 'RoutingTargetType' });
registerEnumType(VoicemailStatus, { name: 'VoicemailStatus' });

@ObjectType()
export class PhoneNumberGql {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  e164Number!: string;

  @Field(() => String)
  displayNumber!: string;

  @Field(() => String)
  countryCode!: string;

  @Field(() => PhoneNumberType)
  type!: PhoneNumberType;

  @Field(() => PhoneNumberStatus)
  status!: PhoneNumberStatus;

  @Field(() => String)
  provider!: string;

  @Field(() => PhoneNumberAssignmentType, { nullable: true })
  assignedType?: PhoneNumberAssignmentType;

  @Field(() => String, { nullable: true })
  assignedId?: string;

  @Field(() => [String])
  capabilities!: string[];

  @Field(() => String)
  createdAt!: string;

  @Field(() => String, { nullable: true })
  releasedAt?: string;
}

@ObjectType()
export class RoutingRuleGql {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  phoneNumberId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => Int)
  priority!: number;

  @Field(() => RoutingTargetType)
  targetType!: RoutingTargetType;

  @Field(() => String, { nullable: true })
  targetId?: string;

  @Field(() => RoutingTargetType, { nullable: true })
  fallbackTargetType?: RoutingTargetType;

  @Field(() => String, { nullable: true })
  fallbackTargetId?: string;

  @Field(() => Int)
  ringDurationSeconds!: number;

  @Field(() => Boolean)
  businessHoursOnly!: boolean;

  @Field(() => Boolean)
  enabled!: boolean;

  @Field(() => String)
  createdAt!: string;
}

@ObjectType()
export class VoicemailMessageGql {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  callSessionId!: string;

  @Field(() => String)
  callerNumber!: string;

  @Field(() => String, { nullable: true })
  callerName?: string;

  @Field(() => ID)
  recipientUserId!: string;

  @Field(() => Int)
  durationSeconds!: number;

  @Field(() => VoicemailStatus)
  status!: VoicemailStatus;

  @Field(() => String, { nullable: true })
  transcript?: string;

  @Field(() => String, { nullable: true })
  audioUrl?: string;

  @Field(() => String)
  createdAt!: string;
}

@ObjectType()
export class TelephonyUsageGql {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  callSessionId!: string;

  @Field(() => String)
  provider!: string;

  @Field(() => String, { nullable: true })
  providerCallId?: string;

  @Field(() => String)
  sourceNumber!: string;

  @Field(() => String)
  destinationNumber!: string;

  @Field(() => String)
  direction!: string;

  @Field(() => Int)
  durationSeconds!: number;

  @Field(() => String)
  callStatus!: string;

  @Field(() => String, { nullable: true })
  region?: string;

  @Field(() => String)
  startedAt!: string;

  @Field(() => String, { nullable: true })
  endedAt?: string;
}

@ObjectType()
export class InitiatePstnCallPayloadGql {
  @Field(() => ID)
  callId!: string;

  @Field(() => String, { nullable: true })
  providerCallId?: string;

  @Field(() => String)
  status!: string;

  @Field(() => String)
  destinationNumber!: string;
}

@InputType()
export class InitiateOutboundPstnCallInput {
  @Field(() => String)
  to!: string;

  @Field(() => String, { nullable: true })
  from?: string;

  @Field(() => ID, { nullable: true })
  conversationId?: string;
}

@InputType()
export class ProvisionNumberInput {
  @Field(() => String)
  countryCode!: string;

  @Field(() => PhoneNumberType, { nullable: true })
  type?: PhoneNumberType;

  @Field(() => String, { nullable: true })
  areaCode?: string;

  @Field(() => String, { nullable: true })
  desiredNumber?: string;
}

@InputType()
export class AssignNumberInput {
  @Field(() => ID)
  numberId!: string;

  @Field(() => PhoneNumberAssignmentType)
  targetType!: PhoneNumberAssignmentType;

  @Field(() => String)
  targetId!: string;
}

@InputType()
export class CreateRoutingRuleInput {
  @Field(() => ID)
  phoneNumberId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => Int, { nullable: true })
  priority?: number;

  @Field(() => RoutingTargetType)
  targetType!: RoutingTargetType;

  @Field(() => String, { nullable: true })
  targetId?: string;

  @Field(() => RoutingTargetType, { nullable: true })
  fallbackTargetType?: RoutingTargetType;

  @Field(() => String, { nullable: true })
  fallbackTargetId?: string;

  @Field(() => Int, { nullable: true })
  ringDurationSeconds?: number;

  @Field(() => Boolean, { nullable: true })
  businessHoursOnly?: boolean;
}
