import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AccountState, AuthorizationSubject, AuthTokenPayload } from '@nexavoice/domain-types';
import { IS_PUBLIC_KEY } from '../decorators/auth.decorators';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RbacService } from '../../modules/authorization/rbac.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = this.getRequest(context);
    const authHeader = request?.headers?.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication token missing or invalid');
    }

    const token = authHeader.substring(7);

    try {
      const secret = this.configService.get<string>('jwt.secret', 'dev-secret-key-32-chars-long-minimum!');
      const payload = await this.jwtService.verifyAsync<AuthTokenPayload>(token, { secret });

      if (!this.prisma.isDatabaseConnected()) {
        throw new UnauthorizedException('Authentication service degraded: session authority unreachable');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          accountState: true,
          tokenVersion: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException('User account no longer exists');
      }

      if (user.tokenVersion !== payload.tokenVersion) {
        throw new UnauthorizedException('Session token was invalidated; please log in again.');
      }

      const accountState = user.accountState as AccountState;
      if (accountState === AccountState.SUSPENDED || accountState === AccountState.LOCKED) {
        throw new UnauthorizedException(`Account is ${accountState}; access denied.`);
      }

      const userPerms = await this.rbacService.getUserPermissions(payload.sub);
      const roles = userPerms.roles;
      const permissions = userPerms.permissions;

      const subject: AuthorizationSubject = {
        id: payload.sub,
        nexaVoiceId: payload.nexaVoiceId,
        accountState,
        roles,
        permissions,
        sessionId: payload.sid,
      };

      // Attach subject to request for subsequent guards and resolvers
      request.user = subject;
      request.session = { id: payload.sid };

      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }

  private getRequest(context: ExecutionContext) {
    const gqlCtx = GqlExecutionContext.create(context);
    const gqlReq = gqlCtx.getContext()?.req;
    if (gqlReq) {
      return gqlReq;
    }
    return context.switchToHttp().getRequest();
  }
}
