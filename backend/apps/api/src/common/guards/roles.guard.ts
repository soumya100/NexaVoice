import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthorizationSubject, SystemRole } from '@nexavoice/domain-types';
import { ROLES_KEY } from '../decorators/auth.decorators';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<SystemRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = this.getRequest(context);
    const user: AuthorizationSubject | undefined = request.user;

    if (!user) {
      throw new ForbiddenException('Access denied: unauthenticated subject');
    }

    // System administrators bypass role checks
    if (user.roles.includes(SystemRole.SYSTEM_ADMIN)) {
      return true;
    }

    const hasAnyRole = requiredRoles.some((role) => user.roles.includes(role));
    if (!hasAnyRole) {
      throw new ForbiddenException('Forbidden: required role not assigned');
    }

    return true;
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
