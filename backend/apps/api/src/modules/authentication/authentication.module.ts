import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthenticationService } from './authentication.service';
import { AuthenticationResolver } from './authentication.resolver';
import { SessionService } from './session.service';
import { SecurityModule } from '../security/security.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@Module({
  imports: [
    SecurityModule,
    AuthorizationModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret', 'dev-secret-key-32-chars-long-minimum!'),
        signOptions: {
          expiresIn: `${configService.get<number>('jwt.accessExpiration', 900)}s`,
        },
      }),
    }),
  ],
  providers: [
    AuthenticationService,
    SessionService,
    AuthenticationResolver,
    JwtAuthGuard,
    PermissionsGuard,
    RolesGuard,
  ],
  exports: [
    AuthenticationService,
    SessionService,
    JwtModule,
    JwtAuthGuard,
    PermissionsGuard,
    RolesGuard,
  ],
})
export class AuthenticationModule {}
