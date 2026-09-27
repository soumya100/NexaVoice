import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigService } from '@nestjs/config';
import { ConfigurationModule } from './config/configuration.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { SecurityModule } from './modules/security/security.module';
import { AuthorizationModule } from './modules/authorization/authorization.module';
import { AuthenticationModule } from './modules/authentication/authentication.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigurationModule,
    DatabaseModule,
    CacheModule,
    SecurityModule,
    AuthorizationModule,
    AuthenticationModule,
    RealtimeModule,
    HealthModule,
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      useFactory: (configService: ConfigService) => ({
        autoSchemaFile: true,
        sortSchema: true,
        playground: configService.get<boolean>('graphql.playground', true),
        introspection: true,
        path: '/graphql',
        context: ({ req, res }: { req: unknown; res: unknown }) => ({ req, res }),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
