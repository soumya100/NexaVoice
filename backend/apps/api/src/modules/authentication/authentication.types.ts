import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

@InputType()
export class DeviceInput {
  @Field(() => String)
  @IsNotEmpty()
  deviceId!: string;

  @Field(() => String, { defaultValue: 'WEB' })
  @IsString()
  deviceType!: string;

  @Field(() => String, { defaultValue: 'Web Browser' })
  @IsString()
  deviceName!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  platform?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  appVersion?: string;
}

@InputType()
export class RegisterInput {
  @Field(() => String)
  @IsNotEmpty()
  @MinLength(3)
  username!: string;

  @Field(() => String)
  @IsNotEmpty()
  displayName!: string;

  @Field(() => String)
  @IsNotEmpty()
  @MinLength(8)
  password!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  email?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  phone?: string;

  @Field(() => DeviceInput, { nullable: true })
  @IsOptional()
  device?: DeviceInput;
}

@InputType()
export class LoginInput {
  @Field(() => String)
  @IsNotEmpty()
  identifier!: string; // Username, Email, or NexaVoice ID

  @Field(() => String)
  @IsNotEmpty()
  password!: string;

  @Field(() => DeviceInput, { nullable: true })
  @IsOptional()
  device?: DeviceInput;
}

@ObjectType()
export class UserProfileGql {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  nexaVoiceId!: string;

  @Field(() => String)
  username!: string;

  @Field(() => String)
  displayName!: string;

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => String, { nullable: true })
  phone?: string;

  @Field(() => String, { nullable: true })
  avatarUrl?: string;

  @Field(() => String)
  status!: string;

  @Field(() => String)
  accountState!: string;

  @Field(() => Boolean)
  isEmailVerified!: boolean;

  @Field(() => Boolean)
  isPhoneVerified!: boolean;

  @Field(() => [String])
  roles!: string[];

  @Field(() => [String])
  permissions!: string[];

  @Field(() => String)
  createdAt!: string;
}

@ObjectType()
export class AuthPayloadGql {
  @Field(() => String)
  accessToken!: string;

  @Field(() => String)
  refreshToken!: string;

  @Field(() => String)
  tokenType!: string;

  @Field(() => Int)
  expiresIn!: number;

  @Field(() => UserProfileGql)
  user!: UserProfileGql;
}

@ObjectType()
export class SessionDtoGql {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  deviceId?: string;

  @Field(() => String, { nullable: true })
  deviceName?: string;

  @Field(() => Boolean)
  isCurrent!: boolean;

  @Field(() => String, { nullable: true })
  ipAddress?: string;

  @Field(() => String)
  lastActiveAt!: string;

  @Field(() => String)
  createdAt!: string;
}

@ObjectType()
export class DeviceDtoGql {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  deviceId!: string;

  @Field(() => String)
  deviceType!: string;

  @Field(() => String)
  deviceName!: string;

  @Field(() => String, { nullable: true })
  platform?: string;

  @Field(() => Boolean)
  isTrusted!: boolean;

  @Field(() => String)
  lastActiveAt!: string;
}

@ObjectType()
export class SecurityEventDtoGql {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  action!: string;

  @Field(() => String)
  result!: string;

  @Field(() => String, { nullable: true })
  reason?: string;

  @Field(() => String)
  createdAt!: string;
}
