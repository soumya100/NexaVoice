import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthorizationSubject, PermissionAction, SystemRole } from '@nexavoice/domain-types';
import { PERMISSIONS_KEY } from '../decorators/auth.decorators';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<PermissionAction[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = this.getRequest(context);
    const user: AuthorizationSubject | undefined = request.user;

    if (!user) {
      throw new ForbiddenException('Access denied: unauthenticated subject');
    }

    // System administrators bypass coarse-grained permission checks
    if (user.roles.includes(SystemRole.SYSTEM_ADMIN)) {
      return true;
    }

    const hasAll = requiredPermissions.every((perm) =>
      user.permissions.includes(perm),
    );

    if (!hasAll) {
      throw new ForbiddenException('Forbidden: insufficient capabilities for requested action');
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
