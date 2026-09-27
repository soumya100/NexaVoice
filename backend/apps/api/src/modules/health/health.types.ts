import { Field, Float, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class HealthComponentStatusGql {
  @Field(() => String)
  status!: string;

  @Field(() => String, { nullable: true })
  message?: string;

  @Field(() => Float, { nullable: true })
  latencyMs?: number;
}

@ObjectType()
export class HealthServicesGql {
  @Field(() => HealthComponentStatusGql)
  database!: HealthComponentStatusGql;

  @Field(() => HealthComponentStatusGql)
  redis!: HealthComponentStatusGql;

  @Field(() => HealthComponentStatusGql)
  signaling!: HealthComponentStatusGql;
}

@ObjectType()
export class HealthStatusGql {
  @Field(() => String)
  status!: string;

  @Field(() => String)
  timestamp!: string;

  @Field(() => Float)
  uptimeSeconds!: number;

  @Field(() => String)
  version!: string;

  @Field(() => String)
  environment!: string;

  @Field(() => HealthServicesGql)
  services!: HealthServicesGql;
}
