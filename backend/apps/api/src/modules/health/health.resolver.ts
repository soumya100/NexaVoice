import { Query, Resolver } from '@nestjs/graphql';
import { HealthService } from './health.service';
import { HealthStatusGql } from './health.types';

@Resolver(() => HealthStatusGql)
export class HealthResolver {
  constructor(private readonly healthService: HealthService) {}

  @Query(() => HealthStatusGql, { name: 'health', description: 'Returns system and service health status' })
  async getHealth(): Promise<HealthStatusGql> {
    const health = await this.healthService.checkHealth();
    return health as HealthStatusGql;
  }
}
